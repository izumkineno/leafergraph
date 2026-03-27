//! Tauri authority demo 核心后端模块。
//!
//! 当前实现固定提供一份单文档 authority：
//! - 文档真相与 revision 只由 Rust 侧维护
//! - `graph.play / graph.step / graph.stop` 走后端最小模拟执行
//! - 文档快照与运行反馈通过 Tauri event 回推到前端

use std::{
    fs,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex, MutexGuard,
    },
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager};

const SNAPSHOT_EVENT_NAME: &str = "sync:snapshot";
const FEEDBACK_EVENT_NAME: &str = "sync:feedback";
const STORAGE_FILENAME: &str = "authority-document.json";
const PLAY_INTERVAL_MS: u64 = 800;
const SEED_DOCUMENT_JSON: &str = include_str!("../../../shared/demo_seed_document.json");
const ON_PLAY_NODE_ID: &str = "on-play-1";
const COUNTER_NODE_ID: &str = "counter-1";
const WATCH_NODE_ID: &str = "watch-1";
const ON_PLAY_NODE_TYPE: &str = "system/on-play";
const COUNTER_NODE_TYPE: &str = "example/counter";
const WATCH_NODE_TYPE: &str = "example/watch";

/// 前端提交给 authority 的最小同步命令集合。
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum SyncCommandInput {
    #[serde(rename = "document.apply-operation")]
    DocumentApplyOperation {
        #[serde(rename = "commandId")]
        command_id: String,
        #[serde(rename = "issuedAt")]
        _issued_at: u64,
        operation: Value,
    },
    #[serde(rename = "document.replace")]
    DocumentReplace {
        #[serde(rename = "commandId")]
        command_id: String,
        #[serde(rename = "issuedAt")]
        _issued_at: u64,
        snapshot: Value,
    },
    #[serde(rename = "runtime.control")]
    RuntimeControl {
        #[serde(rename = "commandId")]
        command_id: String,
        #[serde(rename = "issuedAt")]
        _issued_at: u64,
        request: RuntimeControlRequest,
    },
}

/// `runtime.control` 的最小请求集合。
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum RuntimeControlRequest {
    #[serde(rename = "node.play")]
    NodePlay {
        #[serde(rename = "nodeId")]
        node_id: String,
    },
    #[serde(rename = "graph.play")]
    GraphPlay,
    #[serde(rename = "graph.step")]
    GraphStep,
    #[serde(rename = "graph.stop")]
    GraphStop,
}

/// demo 当前接收的最小图操作集合。
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
enum GraphOperationInput {
    #[serde(rename = "node.update")]
    NodeUpdate {
        #[serde(rename = "nodeId")]
        node_id: String,
        input: NodeUpdateInput,
    },
    #[serde(rename = "node.move")]
    NodeMove {
        #[serde(rename = "nodeId")]
        node_id: String,
        input: NodeMoveInput,
    },
    #[serde(rename = "node.resize")]
    NodeResize {
        #[serde(rename = "nodeId")]
        node_id: String,
        input: NodeResizeInput,
    },
    #[serde(rename = "link.create")]
    LinkCreate { input: LinkCreateInput },
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NodeMoveInput {
    x: f64,
    y: f64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NodeResizeInput {
    width: f64,
    height: f64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NodeUpdateInput {
    title: Option<String>,
    x: Option<f64>,
    y: Option<f64>,
    width: Option<f64>,
    height: Option<f64>,
    properties: Option<serde_json::Map<String, Value>>,
    property_specs: Option<Value>,
    inputs: Option<Value>,
    outputs: Option<Value>,
    widgets: Option<Value>,
    data: Option<serde_json::Map<String, Value>>,
    flags: Option<serde_json::Map<String, Value>>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LinkCreateInput {
    id: Option<String>,
    source: LinkEndpointInput,
    target: LinkEndpointInput,
    label: Option<String>,
    data: Option<Value>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LinkEndpointInput {
    node_id: String,
    slot: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct GraphExecutionState {
    status: &'static str,
    run_id: Option<String>,
    queue_size: u64,
    step_count: u64,
    started_at: Option<u64>,
    stopped_at: Option<u64>,
    last_source: Option<&'static str>,
}

#[derive(Debug)]
struct ActivePlay {
    run_id: String,
    stop_flag: Arc<AtomicBool>,
}

#[derive(Debug)]
struct AuthorityState {
    document: Value,
    revision_counter: u64,
    runtime_state: GraphExecutionState,
    active_play: Option<ActivePlay>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SnapshotEventPayload {
    snapshot: Value,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct FeedbackEventPayload {
    feedback: Value,
}

#[derive(Debug, Clone, Copy)]
enum ExecutionSource {
    GraphPlay,
    GraphStep,
}

impl ExecutionSource {
    fn as_runtime_source(self) -> &'static str {
        match self {
            Self::GraphPlay => "graph-play",
            Self::GraphStep => "graph-step",
        }
    }
}

/// 单文档 authority 控制器。
///
/// 负责持有文档真相、运行状态、定时 play 循环与持久化路径，
/// 并向外暴露可直接挂到 Tauri command 的最小操作入口。
pub struct AuthorityController {
    app: AppHandle,
    storage_path: PathBuf,
    inner: Mutex<AuthorityState>,
}

impl AuthorityController {
    /// 创建 authority 控制器并恢复持久化文档。
    pub fn new(app: AppHandle) -> Result<Self, String> {
        let storage_dir = app
            .path()
            .app_data_dir()
            .map_err(|error| format!("解析应用数据目录失败: {error}"))?;
        fs::create_dir_all(&storage_dir)
            .map_err(|error| format!("创建应用数据目录失败: {error}"))?;
        let storage_path = storage_dir.join(STORAGE_FILENAME);

        let (document, recovered_from_storage) = load_initial_document(&storage_path)?;
        if !recovered_from_storage {
            save_document(&storage_path, &document)?;
        }

        let revision_counter = read_revision(&document).unwrap_or(1);

        Ok(Self {
            app,
            storage_path,
            inner: Mutex::new(AuthorityState {
                document,
                revision_counter,
                runtime_state: create_idle_runtime_state(0, None, None),
                active_play: None,
            }),
        })
    }

    /// 读取当前 authority 正式快照。
    pub fn get_document(&self) -> Value {
        self.state().document.clone()
    }

    /// 提交一条同步命令并返回最小确认。
    pub fn submit_command(self: &Arc<Self>, command: SyncCommandInput) -> Result<Value, String> {
        match command {
            SyncCommandInput::DocumentApplyOperation {
                command_id,
                _issued_at: _,
                operation,
            } => self.handle_document_apply_operation(&command_id, operation),
            SyncCommandInput::DocumentReplace {
                command_id,
                _issued_at: _,
                snapshot,
            } => self.handle_document_replace(&command_id, snapshot),
            SyncCommandInput::RuntimeControl {
                command_id,
                _issued_at: _,
                request,
            } => self.handle_runtime_control(&command_id, request),
        }
    }

    fn handle_document_apply_operation(
        self: &Arc<Self>,
        command_id: &str,
        operation_value: Value,
    ) -> Result<Value, String> {
        let operation = match serde_json::from_value::<GraphOperationInput>(operation_value) {
            Ok(operation) => operation,
            Err(error) => {
                return Ok(rejected_document_ack(
                    command_id,
                    "document.apply-operation",
                    &format!("无法解析 GraphOperation: {error}"),
                ))
            }
        };

        let (changed, snapshot, revision, rejected_reason) = {
            let mut inner = self.state();
            match apply_graph_operation(&mut inner.document, &operation) {
                Ok(changed) => {
                    let revision = if changed {
                        inner.revision_counter += 1;
                        let next_revision = inner.revision_counter;
                        if let Err(error) =
                            set_document_revision(&mut inner.document, next_revision)
                        {
                            return Err(error);
                        }
                        next_revision
                    } else {
                        inner.revision_counter
                    };

                    (
                        changed,
                        changed.then(|| inner.document.clone()),
                        revision,
                        None,
                    )
                }
                Err(reason) => (false, None, inner.revision_counter, Some(reason)),
            }
        };

        if let Some(reason) = rejected_reason {
            return Ok(rejected_document_ack(
                command_id,
                "document.apply-operation",
                &reason,
            ));
        }

        if let Some(snapshot) = snapshot.as_ref() {
            save_document(&self.storage_path, snapshot)?;
            self.emit_snapshot(snapshot)?;
        }

        Ok(accepted_document_ack(
            command_id,
            "document.apply-operation",
            changed,
            Some(json!(revision)),
        ))
    }

    fn handle_document_replace(
        self: &Arc<Self>,
        command_id: &str,
        snapshot: Value,
    ) -> Result<Value, String> {
        if !is_graph_document(&snapshot) {
            return Ok(rejected_document_ack(
                command_id,
                "document.replace",
                "document.replace 的 snapshot 不是合法 GraphDocument",
            ));
        }

        let incoming_document_id = read_document_id(&snapshot)
            .ok_or_else(|| "document.replace 缺少 documentId".to_string())?;
        let current_document_id = {
            let inner = self.state();
            read_document_id(&inner.document)
                .ok_or_else(|| "authority 当前文档缺少 documentId".to_string())?
                .to_string()
        };
        if incoming_document_id != current_document_id {
            return Ok(rejected_document_ack(
                command_id,
                "document.replace",
                "documentId 不匹配，authority 拒绝替换其它逻辑文档",
            ));
        }

        let now = now_millis();
        if let Some(feedback) = self.stop_active_play(now)? {
            self.emit_feedback(&feedback)?;
        }

        let (snapshot_to_emit, revision) = {
            let mut inner = self.state();
            inner.document = snapshot;
            inner.revision_counter += 1;
            let next_revision = inner.revision_counter;
            set_document_revision(&mut inner.document, next_revision)?;
            inner.runtime_state = create_idle_runtime_state(
                inner.runtime_state.step_count,
                Some(now),
                inner.runtime_state.last_source,
            );
            (inner.document.clone(), inner.revision_counter)
        };

        save_document(&self.storage_path, &snapshot_to_emit)?;
        self.emit_snapshot(&snapshot_to_emit)?;

        Ok(accepted_document_ack(
            command_id,
            "document.replace",
            true,
            Some(json!(revision)),
        ))
    }

    fn handle_runtime_control(
        self: &Arc<Self>,
        command_id: &str,
        request: RuntimeControlRequest,
    ) -> Result<Value, String> {
        match request {
            RuntimeControlRequest::NodePlay { node_id } => Ok(rejected_runtime_ack(
                command_id,
                &format!("v1 demo 不支持 node.play({node_id})，请改用 graph.play"),
            )),
            RuntimeControlRequest::GraphPlay => self.handle_graph_play(command_id),
            RuntimeControlRequest::GraphStep => self.handle_graph_step(command_id),
            RuntimeControlRequest::GraphStop => self.handle_graph_stop(command_id),
        }
    }

    fn handle_graph_play(self: &Arc<Self>, command_id: &str) -> Result<Value, String> {
        let now = now_millis();
        let run_id = create_run_id("graph-play");
        let (runtime_state, start_feedback, stop_flag) = {
            let mut inner = self.state();
            if let Some(active_play) = inner.active_play.as_ref() {
                return Ok(accepted_runtime_ack(
                    command_id,
                    false,
                    Some(inner.runtime_state.clone()),
                    Some(format!("当前已有活动运行 {}", active_play.run_id)),
                ));
            }

            let stop_flag = Arc::new(AtomicBool::new(false));
            let runtime_state = create_running_runtime_state(run_id.clone(), now, 0);
            inner.runtime_state = runtime_state.clone();
            inner.active_play = Some(ActivePlay {
                run_id: run_id.clone(),
                stop_flag: stop_flag.clone(),
            });

            let feedback = graph_execution_feedback(
                "started",
                &runtime_state,
                Some(run_id.as_str()),
                Some("graph-play"),
                None,
                now,
            );

            (runtime_state, feedback, stop_flag)
        };

        self.emit_feedback(&start_feedback)?;

        let controller = Arc::clone(self);
        let spawned_run_id = run_id.clone();
        thread::spawn(move || {
            controller.run_play_loop(spawned_run_id, stop_flag);
        });

        Ok(accepted_runtime_ack(
            command_id,
            true,
            Some(runtime_state),
            None,
        ))
    }

    fn handle_graph_step(self: &Arc<Self>, command_id: &str) -> Result<Value, String> {
        let now = now_millis();
        let run_id = create_run_id("graph-step");

        let (feedbacks, snapshot, runtime_state) = {
            let mut inner = self.state();
            if inner.active_play.is_some() {
                return Ok(rejected_runtime_ack(
                    command_id,
                    "当前已有活动运行，需先 stop 再执行 graph.step",
                ));
            }

            let started_state =
                create_stepping_runtime_state(run_id.clone(), now, inner.runtime_state.step_count);
            inner.runtime_state = started_state.clone();

            let mut feedbacks = vec![graph_execution_feedback(
                "started",
                &started_state,
                Some(run_id.as_str()),
                Some("graph-step"),
                None,
                now,
            )];

            let (mut advanced_feedbacks, snapshot) =
                advance_document_once(&mut inner, ExecutionSource::GraphStep, &run_id, now)?;
            feedbacks.append(&mut advanced_feedbacks);

            let drained_state = create_idle_runtime_state(
                inner.runtime_state.step_count,
                Some(now),
                Some("graph-step"),
            );
            inner.runtime_state = drained_state.clone();
            feedbacks.push(graph_execution_feedback(
                "drained",
                &drained_state,
                None,
                Some("graph-step"),
                None,
                now,
            ));

            (feedbacks, snapshot, drained_state)
        };

        save_document(&self.storage_path, &snapshot)?;
        self.emit_feedbacks(&feedbacks)?;
        self.emit_snapshot(&snapshot)?;

        Ok(accepted_runtime_ack(
            command_id,
            true,
            Some(runtime_state),
            None,
        ))
    }

    fn handle_graph_stop(&self, command_id: &str) -> Result<Value, String> {
        let now = now_millis();
        let feedback = self.stop_active_play(now)?;
        let runtime_state = self.state().runtime_state.clone();

        if let Some(feedback) = feedback {
            self.emit_feedback(&feedback)?;
            return Ok(accepted_runtime_ack(
                command_id,
                true,
                Some(runtime_state),
                None,
            ));
        }

        Ok(accepted_runtime_ack(
            command_id,
            false,
            Some(runtime_state),
            Some("当前没有活动运行可停止".to_string()),
        ))
    }

    fn run_play_loop(self: Arc<Self>, run_id: String, stop_flag: Arc<AtomicBool>) {
        loop {
            thread::sleep(Duration::from_millis(PLAY_INTERVAL_MS));

            if stop_flag.load(Ordering::SeqCst) {
                break;
            }

            if let Err(error) = self.advance_play_tick(&run_id) {
                eprintln!("play loop advance failed: {error}");
                let _ = self.force_stop_after_error(&run_id, now_millis());
                break;
            }
        }
    }

    fn advance_play_tick(&self, run_id: &str) -> Result<(), String> {
        let now = now_millis();
        let (feedbacks, snapshot) = {
            let mut inner = self.state();
            match inner.active_play.as_ref() {
                Some(active_play) if active_play.run_id == run_id => {}
                _ => return Ok(()),
            }

            let (feedbacks, snapshot) =
                advance_document_once(&mut inner, ExecutionSource::GraphPlay, run_id, now)?;
            (feedbacks, snapshot)
        };

        save_document(&self.storage_path, &snapshot)?;
        self.emit_feedbacks(&feedbacks)?;
        self.emit_snapshot(&snapshot)?;
        Ok(())
    }

    fn stop_active_play(&self, now: u64) -> Result<Option<Value>, String> {
        let mut inner = self.state();
        let Some(active_play) = inner.active_play.take() else {
            return Ok(None);
        };

        active_play.stop_flag.store(true, Ordering::SeqCst);
        let stopped_state = create_idle_runtime_state(
            inner.runtime_state.step_count,
            Some(now),
            Some("graph-play"),
        );
        inner.runtime_state = stopped_state.clone();

        Ok(Some(graph_execution_feedback(
            "stopped",
            &stopped_state,
            Some(active_play.run_id.as_str()),
            Some("graph-play"),
            None,
            now,
        )))
    }

    fn force_stop_after_error(&self, run_id: &str, now: u64) -> Result<(), String> {
        let feedback = {
            let mut inner = self.state();
            match inner.active_play.as_ref() {
                Some(active_play) if active_play.run_id == run_id => {}
                _ => return Ok(()),
            }

            if let Some(active_play) = inner.active_play.take() {
                active_play.stop_flag.store(true, Ordering::SeqCst);
                let stopped_state = create_idle_runtime_state(
                    inner.runtime_state.step_count,
                    Some(now),
                    Some("graph-play"),
                );
                inner.runtime_state = stopped_state.clone();

                Some(graph_execution_feedback(
                    "stopped",
                    &stopped_state,
                    Some(run_id),
                    Some("graph-play"),
                    None,
                    now,
                ))
            } else {
                None
            }
        };

        if let Some(feedback) = feedback {
            self.emit_feedback(&feedback)?;
        }

        Ok(())
    }

    fn emit_snapshot(&self, snapshot: &Value) -> Result<(), String> {
        self.app
            .emit(
                SNAPSHOT_EVENT_NAME,
                SnapshotEventPayload {
                    snapshot: snapshot.clone(),
                },
            )
            .map_err(|error| format!("广播 snapshot 事件失败: {error}"))
    }

    fn emit_feedback(&self, feedback: &Value) -> Result<(), String> {
        self.app
            .emit(
                FEEDBACK_EVENT_NAME,
                FeedbackEventPayload {
                    feedback: feedback.clone(),
                },
            )
            .map_err(|error| format!("广播 feedback 事件失败: {error}"))
    }

    fn emit_feedbacks(&self, feedbacks: &[Value]) -> Result<(), String> {
        for feedback in feedbacks {
            self.emit_feedback(feedback)?;
        }

        Ok(())
    }

    fn state(&self) -> MutexGuard<'_, AuthorityState> {
        self.inner
            .lock()
            .unwrap_or_else(|poison| poison.into_inner())
    }
}

fn load_initial_document(path: &Path) -> Result<(Value, bool), String> {
    if let Some(snapshot) = load_document_if_valid(path)? {
        return Ok((snapshot, true));
    }

    let seed = serde_json::from_str::<Value>(SEED_DOCUMENT_JSON)
        .map_err(|error| format!("解析共享 seed 文档失败: {error}"))?;
    if !is_graph_document(&seed) {
        return Err("共享 seed 文档不是合法 GraphDocument".to_string());
    }

    Ok((seed, false))
}

fn load_document_if_valid(path: &Path) -> Result<Option<Value>, String> {
    if !path.exists() {
        return Ok(None);
    }

    let text = fs::read_to_string(path)
        .map_err(|error| format!("读取持久化 authority 文档失败: {error}"))?;
    let snapshot = match serde_json::from_str::<Value>(&text) {
        Ok(snapshot) => snapshot,
        Err(_) => return Ok(None),
    };

    if !is_graph_document(&snapshot) {
        return Ok(None);
    }

    Ok(Some(snapshot))
}

fn save_document(path: &Path, snapshot: &Value) -> Result<(), String> {
    let text = serde_json::to_string_pretty(snapshot)
        .map_err(|error| format!("序列化 authority 文档失败: {error}"))?;
    fs::write(path, text).map_err(|error| format!("写入 authority 文档失败: {error}"))
}

fn advance_document_once(
    inner: &mut AuthorityState,
    source: ExecutionSource,
    run_id: &str,
    timestamp: u64,
) -> Result<(Vec<Value>, Value), String> {
    let started_at = inner.runtime_state.started_at.unwrap_or(timestamp);
    let step_index = inner.runtime_state.step_count;
    let next_count = update_counter_and_watch(&mut inner.document)?;

    inner.revision_counter += 1;
    let next_revision = inner.revision_counter;
    set_document_revision(&mut inner.document, next_revision)?;

    inner.runtime_state.step_count += 1;
    inner.runtime_state.queue_size = 1;
    inner.runtime_state.run_id = Some(run_id.to_string());
    inner.runtime_state.started_at = Some(started_at);
    inner.runtime_state.stopped_at = None;
    inner.runtime_state.last_source = Some(source.as_runtime_source());
    inner.runtime_state.status = match source {
        ExecutionSource::GraphPlay => "running",
        ExecutionSource::GraphStep => "stepping",
    };

    let chain_id = format!("{run_id}:step:{step_index}");
    let root_node_title =
        read_node_title(&inner.document, ON_PLAY_NODE_ID).unwrap_or_else(|| "On Play".to_string());
    let counter_title = read_node_title(&inner.document, COUNTER_NODE_ID)
        .unwrap_or_else(|| format!("Counter {next_count}"));
    let watch_title = read_node_title(&inner.document, WATCH_NODE_ID)
        .unwrap_or_else(|| format!("Watch {next_count}"));
    let counter_state = node_execution_state(next_count as u64, timestamp);
    let watch_state = node_execution_state(next_count as u64, timestamp);
    let execution_context =
        execution_context_json(source.as_runtime_source(), run_id, step_index, started_at);

    let feedbacks = vec![
        node_execution_feedback(
            &chain_id,
            &root_node_title,
            COUNTER_NODE_ID,
            COUNTER_NODE_TYPE,
            &counter_title,
            1,
            0,
            source.as_runtime_source(),
            "direct",
            timestamp,
            execution_context.clone(),
            counter_state,
        ),
        link_propagation_feedback(&chain_id, next_count, timestamp),
        node_execution_feedback(
            &chain_id,
            &root_node_title,
            WATCH_NODE_ID,
            WATCH_NODE_TYPE,
            &watch_title,
            2,
            1,
            source.as_runtime_source(),
            "propagated",
            timestamp,
            execution_context,
            watch_state,
        ),
        graph_execution_feedback(
            "advanced",
            &inner.runtime_state,
            Some(run_id),
            Some(source.as_runtime_source()),
            Some(WATCH_NODE_ID),
            timestamp,
        ),
    ];

    Ok((feedbacks, inner.document.clone()))
}

fn update_counter_and_watch(document: &mut Value) -> Result<i64, String> {
    let counter_step = read_node_property_i64(document, COUNTER_NODE_ID, "step").unwrap_or(1);
    let current_count = read_node_property_i64(document, COUNTER_NODE_ID, "count").unwrap_or(0);
    let next_count = current_count + counter_step;

    write_node_property(document, COUNTER_NODE_ID, "count", json!(next_count))?;
    write_node_property(
        document,
        COUNTER_NODE_ID,
        "note",
        json!(format!("当前输出 {next_count}")),
    )?;
    write_node_title(document, COUNTER_NODE_ID, &format!("Counter {next_count}"))?;

    write_node_property(
        document,
        WATCH_NODE_ID,
        "preview",
        json!(next_count.to_string()),
    )?;
    write_node_property(document, WATCH_NODE_ID, "status", json!("RECEIVED"))?;
    write_node_title(document, WATCH_NODE_ID, &format!("Watch {next_count}"))?;

    Ok(next_count)
}

fn apply_graph_operation(
    document: &mut Value,
    operation: &GraphOperationInput,
) -> Result<bool, String> {
    match operation {
        GraphOperationInput::NodeUpdate { node_id, input } => {
            apply_node_update(document, node_id, input)
        }
        GraphOperationInput::NodeMove { node_id, input } => {
            apply_node_move(document, node_id, input)
        }
        GraphOperationInput::NodeResize { node_id, input } => {
            apply_node_resize(document, node_id, input)
        }
        GraphOperationInput::LinkCreate { input } => apply_link_create(document, input),
    }
}

fn apply_node_move(
    document: &mut Value,
    node_id: &str,
    input: &NodeMoveInput,
) -> Result<bool, String> {
    let node = find_node_mut(document, node_id)?;
    let layout = ensure_object_field(
        node,
        "layout",
        &format!("节点 {node_id} 的 layout 不是对象"),
    )?;
    let changed_x = set_number_field(layout, "x", input.x)?;
    let changed_y = set_number_field(layout, "y", input.y)?;
    Ok(changed_x || changed_y)
}

fn apply_node_resize(
    document: &mut Value,
    node_id: &str,
    input: &NodeResizeInput,
) -> Result<bool, String> {
    let node = find_node_mut(document, node_id)?;
    let layout = ensure_object_field(
        node,
        "layout",
        &format!("节点 {node_id} 的 layout 不是对象"),
    )?;
    let changed_width = set_number_field(layout, "width", input.width)?;
    let changed_height = set_number_field(layout, "height", input.height)?;
    Ok(changed_width || changed_height)
}

fn apply_node_update(
    document: &mut Value,
    node_id: &str,
    input: &NodeUpdateInput,
) -> Result<bool, String> {
    let node = find_node_mut(document, node_id)?;
    let mut changed = false;

    if let Some(title) = input.title.as_ref() {
        changed |= set_string_field(node, "title", title);
    }

    if input.x.is_some() || input.y.is_some() || input.width.is_some() || input.height.is_some() {
        let layout = ensure_object_field(
            node,
            "layout",
            &format!("节点 {node_id} 的 layout 不是对象"),
        )?;
        if let Some(x) = input.x {
            changed |= set_number_field(layout, "x", x)?;
        }
        if let Some(y) = input.y {
            changed |= set_number_field(layout, "y", y)?;
        }
        if let Some(width) = input.width {
            changed |= set_number_field(layout, "width", width)?;
        }
        if let Some(height) = input.height {
            changed |= set_number_field(layout, "height", height)?;
        }
    }

    if let Some(properties_patch) = input.properties.as_ref() {
        let properties = ensure_object_field(
            node,
            "properties",
            &format!("节点 {node_id} 的 properties 不是对象"),
        )?;
        for (key, next_value) in properties_patch {
            if properties.get(key) != Some(next_value) {
                properties.insert(key.clone(), next_value.clone());
                changed = true;
            }
        }
    }

    if let Some(flags_patch) = input.flags.as_ref() {
        let flags =
            ensure_object_field(node, "flags", &format!("节点 {node_id} 的 flags 不是对象"))?;
        for (key, next_value) in flags_patch {
            if flags.get(key) != Some(next_value) {
                flags.insert(key.clone(), next_value.clone());
                changed = true;
            }
        }
    }

    if let Some(property_specs) = input.property_specs.as_ref() {
        changed |= replace_value_field(node, "propertySpecs", property_specs.clone());
    }

    if let Some(inputs) = input.inputs.as_ref() {
        changed |= replace_value_field(node, "inputs", inputs.clone());
    }

    if let Some(outputs) = input.outputs.as_ref() {
        changed |= replace_value_field(node, "outputs", outputs.clone());
    }

    if let Some(widgets) = input.widgets.as_ref() {
        changed |= replace_value_field(node, "widgets", widgets.clone());
    }

    if let Some(data) = input.data.as_ref() {
        changed |= replace_value_field(node, "data", Value::Object(data.clone()));
    }

    Ok(changed)
}

fn apply_link_create(document: &mut Value, input: &LinkCreateInput) -> Result<bool, String> {
    if find_node(document, &input.source.node_id).is_none() {
        return Err(format!("连线起点节点不存在：{}", input.source.node_id));
    }
    if find_node(document, &input.target.node_id).is_none() {
        return Err(format!("连线终点节点不存在：{}", input.target.node_id));
    }

    if has_same_link_endpoint(document, input) {
        return Err(format!(
            "相同端点连线已存在：{}#{} -> {}#{}",
            input.source.node_id, input.source.slot, input.target.node_id, input.target.slot
        ));
    }

    let link_id = input
        .id
        .clone()
        .unwrap_or_else(|| format!("authority:link:{}", now_millis()));
    if find_link(document, &link_id).is_some() {
        return Err(format!("连线已存在：{link_id}"));
    }

    let links = ensure_links_array_mut(document)?;
    let mut link = serde_json::Map::new();
    link.insert("id".to_string(), json!(link_id));
    link.insert(
        "source".to_string(),
        json!({
            "nodeId": input.source.node_id.clone(),
            "slot": input.source.slot,
        }),
    );
    link.insert(
        "target".to_string(),
        json!({
            "nodeId": input.target.node_id.clone(),
            "slot": input.target.slot,
        }),
    );
    if let Some(label) = input.label.as_ref() {
        link.insert("label".to_string(), json!(label));
    }
    if let Some(data) = input.data.as_ref() {
        link.insert("data".to_string(), data.clone());
    }
    links.push(Value::Object(link));

    Ok(true)
}

fn ensure_object_field<'a>(
    object: &'a mut serde_json::Map<String, Value>,
    key: &str,
    invalid_message: &str,
) -> Result<&'a mut serde_json::Map<String, Value>, String> {
    let value = object
        .entry(key.to_string())
        .or_insert_with(|| Value::Object(Default::default()));
    value
        .as_object_mut()
        .ok_or_else(|| invalid_message.to_string())
}

fn set_number_field(
    object: &mut serde_json::Map<String, Value>,
    key: &str,
    next_value: f64,
) -> Result<bool, String> {
    let next_number = serde_json::Number::from_f64(next_value)
        .ok_or_else(|| format!("字段 {key} 不是有限数字"))?;
    let next_json = Value::Number(next_number);
    if object.get(key) == Some(&next_json) {
        return Ok(false);
    }

    object.insert(key.to_string(), next_json);
    Ok(true)
}

fn set_string_field(
    object: &mut serde_json::Map<String, Value>,
    key: &str,
    next_value: &str,
) -> bool {
    let next_json = json!(next_value);
    if object.get(key) == Some(&next_json) {
        return false;
    }

    object.insert(key.to_string(), next_json);
    true
}

fn replace_value_field(
    object: &mut serde_json::Map<String, Value>,
    key: &str,
    next_value: Value,
) -> bool {
    if object.get(key) == Some(&next_value) {
        return false;
    }

    object.insert(key.to_string(), next_value);
    true
}

fn is_graph_document(value: &Value) -> bool {
    matches!(
        value,
        Value::Object(map)
            if matches!(map.get("documentId"), Some(Value::String(_)))
                && matches!(map.get("revision"), Some(Value::Number(_) | Value::String(_)))
                && matches!(map.get("appKind"), Some(Value::String(_)))
                && matches!(map.get("nodes"), Some(Value::Array(_)))
                && matches!(map.get("links"), Some(Value::Array(_)))
    )
}

fn read_document_id(value: &Value) -> Option<&str> {
    value.get("documentId")?.as_str()
}

fn read_revision(value: &Value) -> Option<u64> {
    match value.get("revision") {
        Some(Value::Number(number)) => number.as_u64(),
        Some(Value::String(text)) => text.parse::<u64>().ok(),
        _ => None,
    }
}

fn set_document_revision(value: &mut Value, revision: u64) -> Result<(), String> {
    let document = value
        .as_object_mut()
        .ok_or_else(|| "GraphDocument 顶层必须是对象".to_string())?;
    document.insert("revision".to_string(), json!(revision));
    Ok(())
}

fn find_node<'a>(document: &'a Value, node_id: &str) -> Option<&'a serde_json::Map<String, Value>> {
    document
        .get("nodes")?
        .as_array()?
        .iter()
        .find_map(|node| match node {
            Value::Object(node_object)
                if node_object
                    .get("id")
                    .and_then(Value::as_str)
                    .is_some_and(|current_id| current_id == node_id) =>
            {
                Some(node_object)
            }
            _ => None,
        })
}

fn find_link<'a>(document: &'a Value, link_id: &str) -> Option<&'a serde_json::Map<String, Value>> {
    document
        .get("links")?
        .as_array()?
        .iter()
        .find_map(|link| match link {
            Value::Object(link_object)
                if link_object
                    .get("id")
                    .and_then(Value::as_str)
                    .is_some_and(|current_id| current_id == link_id) =>
            {
                Some(link_object)
            }
            _ => None,
        })
}

fn ensure_links_array_mut(document: &mut Value) -> Result<&mut Vec<Value>, String> {
    document
        .get_mut("links")
        .and_then(Value::as_array_mut)
        .ok_or_else(|| "GraphDocument 缺少 links 数组".to_string())
}

fn has_same_link_endpoint(document: &Value, input: &LinkCreateInput) -> bool {
    document
        .get("links")
        .and_then(Value::as_array)
        .is_some_and(|links| {
            links.iter().any(|link| {
                let Value::Object(link_object) = link else {
                    return false;
                };
                let source = link_object.get("source").and_then(Value::as_object);
                let target = link_object.get("target").and_then(Value::as_object);

                let source_matches = source.is_some_and(|source| {
                    source.get("nodeId").and_then(Value::as_str)
                        == Some(input.source.node_id.as_str())
                        && source.get("slot").and_then(Value::as_i64) == Some(input.source.slot)
                });
                let target_matches = target.is_some_and(|target| {
                    target.get("nodeId").and_then(Value::as_str)
                        == Some(input.target.node_id.as_str())
                        && target.get("slot").and_then(Value::as_i64) == Some(input.target.slot)
                });

                source_matches && target_matches
            })
        })
}

fn find_node_mut<'a>(
    document: &'a mut Value,
    node_id: &str,
) -> Result<&'a mut serde_json::Map<String, Value>, String> {
    let nodes = document
        .get_mut("nodes")
        .and_then(Value::as_array_mut)
        .ok_or_else(|| "GraphDocument 缺少 nodes 数组".to_string())?;

    for node in nodes {
        if let Value::Object(node_object) = node {
            if node_object
                .get("id")
                .and_then(Value::as_str)
                .is_some_and(|current_id| current_id == node_id)
            {
                return Ok(node_object);
            }
        }
    }

    Err(format!("文档中缺少节点 {node_id}"))
}

fn read_node_title(document: &Value, node_id: &str) -> Option<String> {
    find_node(document, node_id)?
        .get("title")?
        .as_str()
        .map(ToString::to_string)
}

fn write_node_title(document: &mut Value, node_id: &str, title: &str) -> Result<(), String> {
    let node = find_node_mut(document, node_id)?;
    node.insert("title".to_string(), json!(title));
    Ok(())
}

fn read_node_property_i64(document: &Value, node_id: &str, key: &str) -> Option<i64> {
    find_node(document, node_id)?
        .get("properties")?
        .as_object()?
        .get(key)
        .and_then(|value| match value {
            Value::Number(number) => number.as_i64(),
            Value::String(text) => text.parse::<i64>().ok(),
            _ => None,
        })
}

fn write_node_property(
    document: &mut Value,
    node_id: &str,
    key: &str,
    next_value: Value,
) -> Result<(), String> {
    let node = find_node_mut(document, node_id)?;
    let properties = node
        .entry("properties")
        .or_insert_with(|| Value::Object(Default::default()))
        .as_object_mut()
        .ok_or_else(|| format!("节点 {node_id} 的 properties 不是对象"))?;
    properties.insert(key.to_string(), next_value);
    Ok(())
}

fn create_idle_runtime_state(
    step_count: u64,
    stopped_at: Option<u64>,
    last_source: Option<&'static str>,
) -> GraphExecutionState {
    GraphExecutionState {
        status: "idle",
        run_id: None,
        queue_size: 0,
        step_count,
        started_at: None,
        stopped_at,
        last_source,
    }
}

fn create_running_runtime_state(
    run_id: String,
    started_at: u64,
    step_count: u64,
) -> GraphExecutionState {
    GraphExecutionState {
        status: "running",
        run_id: Some(run_id),
        queue_size: 1,
        step_count,
        started_at: Some(started_at),
        stopped_at: None,
        last_source: Some("graph-play"),
    }
}

fn create_stepping_runtime_state(
    run_id: String,
    started_at: u64,
    step_count: u64,
) -> GraphExecutionState {
    GraphExecutionState {
        status: "stepping",
        run_id: Some(run_id),
        queue_size: 1,
        step_count,
        started_at: Some(started_at),
        stopped_at: None,
        last_source: Some("graph-step"),
    }
}

fn node_execution_state(run_count: u64, timestamp: u64) -> Value {
    json!({
        "status": "success",
        "runCount": run_count,
        "lastExecutedAt": timestamp,
        "lastSucceededAt": timestamp
    })
}

fn execution_context_json(source: &str, run_id: &str, step_index: u64, started_at: u64) -> Value {
    json!({
        "source": source,
        "runId": run_id,
        "entryNodeId": ON_PLAY_NODE_ID,
        "stepIndex": step_index,
        "startedAt": started_at
    })
}

fn node_execution_feedback(
    chain_id: &str,
    root_node_title: &str,
    node_id: &str,
    node_type: &str,
    node_title: &str,
    depth: u64,
    sequence: u64,
    source: &str,
    trigger: &str,
    timestamp: u64,
    execution_context: Value,
    state: Value,
) -> Value {
    json!({
        "type": "node.execution",
        "event": {
            "chainId": chain_id,
            "rootNodeId": ON_PLAY_NODE_ID,
            "rootNodeType": ON_PLAY_NODE_TYPE,
            "rootNodeTitle": root_node_title,
            "nodeId": node_id,
            "nodeType": node_type,
            "nodeTitle": node_title,
            "depth": depth,
            "sequence": sequence,
            "source": source,
            "trigger": trigger,
            "timestamp": timestamp,
            "executionContext": execution_context,
            "state": state
        }
    })
}

fn link_propagation_feedback(chain_id: &str, payload: i64, timestamp: u64) -> Value {
    json!({
        "type": "link.propagation",
        "event": {
            "linkId": "link-counter-watch",
            "chainId": chain_id,
            "sourceNodeId": COUNTER_NODE_ID,
            "sourceSlot": 0,
            "targetNodeId": WATCH_NODE_ID,
            "targetSlot": 0,
            "payload": payload,
            "timestamp": timestamp
        }
    })
}

fn graph_execution_feedback(
    event_type: &str,
    state: &GraphExecutionState,
    run_id: Option<&str>,
    source: Option<&str>,
    node_id: Option<&str>,
    timestamp: u64,
) -> Value {
    json!({
        "type": "graph.execution",
        "event": {
            "type": event_type,
            "state": state,
            "runId": run_id,
            "source": source,
            "nodeId": node_id,
            "timestamp": timestamp
        }
    })
}

fn accepted_document_ack(
    command_id: &str,
    ack_type: &str,
    changed: bool,
    document_revision: Option<Value>,
) -> Value {
    let mut ack = serde_json::Map::new();
    ack.insert("commandId".to_string(), json!(command_id));
    ack.insert("type".to_string(), json!(ack_type));
    ack.insert("status".to_string(), json!("accepted"));
    ack.insert("changed".to_string(), json!(changed));
    if let Some(revision) = document_revision {
        ack.insert("documentRevision".to_string(), revision);
    }
    Value::Object(ack)
}

fn rejected_document_ack(command_id: &str, ack_type: &str, reason: &str) -> Value {
    json!({
        "commandId": command_id,
        "type": ack_type,
        "status": "rejected",
        "reason": reason
    })
}

fn accepted_runtime_ack(
    command_id: &str,
    changed: bool,
    runtime_state: Option<GraphExecutionState>,
    reason: Option<String>,
) -> Value {
    let mut ack = serde_json::Map::new();
    ack.insert("commandId".to_string(), json!(command_id));
    ack.insert("type".to_string(), json!("runtime.control"));
    ack.insert("status".to_string(), json!("accepted"));
    ack.insert("changed".to_string(), json!(changed));
    if let Some(runtime_state) = runtime_state {
        ack.insert("runtimeState".to_string(), json!(runtime_state));
    }
    if let Some(reason) = reason {
        ack.insert("reason".to_string(), json!(reason));
    }
    Value::Object(ack)
}

fn rejected_runtime_ack(command_id: &str, reason: &str) -> Value {
    json!({
        "commandId": command_id,
        "type": "runtime.control",
        "status": "rejected",
        "reason": reason
    })
}

fn create_run_id(prefix: &str) -> String {
    format!("{prefix}:{}", now_millis())
}

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}
