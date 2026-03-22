from __future__ import annotations

import asyncio
import time
from collections.abc import Callable
from copy import deepcopy
from dataclasses import dataclass
from typing import Any, Protocol

from .document_store import (
    clone_document,
    create_empty_graph_document,
    normalize_document_for_compare,
)

DocumentListener = Callable[[dict[str, Any]], None]
RuntimeFeedbackListener = Callable[[dict[str, Any]], None]
NodeExecutor = Callable[[dict[str, Any], dict[str, Any]], dict[str, Any]]

SYSTEM_ON_PLAY_NODE_TYPE = "system/on-play"
SYSTEM_TIMER_NODE_TYPE = "system/timer"
SYSTEM_TIMER_DEFAULT_INTERVAL_MS = 1000
SYSTEM_TIMER_INTERVAL_WIDGET_NAME = "intervalMs"
SYSTEM_TIMER_IMMEDIATE_WIDGET_NAME = "immediate"
STRUCTURAL_DOCUMENT_UPDATE_IMPACT = "structural"
LIVE_SAFE_DOCUMENT_UPDATE_IMPACT = "live-safe"
RUNTIME_DOCUMENT_UPDATE_IMPACT = "runtime"


def _clone_value(value: Any) -> Any:
    return deepcopy(value)


def _now_ms() -> int:
    return int(time.time() * 1000)


def _create_idle_graph_execution_state() -> dict[str, Any]:
    return {"status": "idle", "queueSize": 0, "stepCount": 0}


def _ensure_node_properties(node: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(node.get("properties"), dict):
        node["properties"] = {}
    return node["properties"]


def _resolve_first_defined_input_value(input_values: list[Any]) -> Any:
    for value in input_values:
        if value is not None:
            return value
    return None


def _format_runtime_value(value: Any) -> str:
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return str(value)
    if isinstance(value, str):
        trimmed = value.strip()
        return trimmed if trimmed else "EMPTY"
    if value is None:
        return "EMPTY"
    return "OBJECT"


def _resolve_timer_interval_ms(value: Any) -> int:
    try:
        next_value = float(value)
    except (TypeError, ValueError):
        return SYSTEM_TIMER_DEFAULT_INTERVAL_MS
    if next_value <= 0:
        return SYSTEM_TIMER_DEFAULT_INTERVAL_MS
    return max(1, int(next_value))


def _resolve_timer_immediate(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    return True


def _resolve_timer_widget_value(node: dict[str, Any], widget_name: str) -> Any:
    for widget in node.get("widgets", []):
        if isinstance(widget, dict) and widget.get("name") == widget_name:
            return widget.get("value")
    return None


def _sync_timer_widget_value(node: dict[str, Any], widget_name: str, value: Any) -> None:
    for widget in node.get("widgets", []):
        if isinstance(widget, dict) and widget.get("name") == widget_name:
            widget["value"] = value
            return


def _coerce_slot_index(value: Any) -> int:
    if isinstance(value, bool):
        return 0
    if isinstance(value, int):
        return max(0, value)
    if isinstance(value, float):
        return max(0, int(value))
    if isinstance(value, str) and value.isdigit():
        return int(value)
    return 0


def _build_input_values(slot_index: int, payload: Any) -> list[Any]:
    values: list[Any] = [None] * (slot_index + 1)
    values[slot_index] = _clone_value(payload)
    return values


def _default_timer_executor(node: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
    properties = _ensure_node_properties(node)
    interval_widget_value = _resolve_timer_widget_value(
        node, SYSTEM_TIMER_INTERVAL_WIDGET_NAME
    )
    immediate_widget_value = _resolve_timer_widget_value(
        node, SYSTEM_TIMER_IMMEDIATE_WIDGET_NAME
    )
    interval_ms = _resolve_timer_interval_ms(
        interval_widget_value
        if interval_widget_value is not None
        else properties.get("intervalMs")
    )
    immediate = _resolve_timer_immediate(
        immediate_widget_value
        if immediate_widget_value is not None
        else properties.get("immediate")
    )
    source = context["source"]
    run_id = context.get("runId")
    timer_runtime = context.get("timerRuntime")
    is_graph_source = source in ("graph-play", "graph-step")
    can_register_timer = bool(
        is_graph_source
        and isinstance(run_id, str)
        and isinstance(timer_runtime, dict)
        and callable(timer_runtime.get("registerTimer"))
    )
    is_periodic_tick = bool(
        isinstance(timer_runtime, dict)
        and timer_runtime.get("timerTickNodeId") == node["id"]
    )

    if can_register_timer:
        timer_runtime["registerTimer"](
            {
                "nodeId": node["id"],
                "source": source,
                "runId": run_id,
                "startedAt": context["startedAt"],
                "intervalMs": interval_ms,
                "immediate": immediate,
            }
        )

    should_emit_tick = (
        source == "node-play" or is_periodic_tick or immediate or not can_register_timer
    )

    properties["intervalMs"] = interval_ms
    properties["immediate"] = immediate
    _sync_timer_widget_value(node, SYSTEM_TIMER_INTERVAL_WIDGET_NAME, interval_ms)
    _sync_timer_widget_value(node, SYSTEM_TIMER_IMMEDIATE_WIDGET_NAME, immediate)
    node["title"] = "Timer"

    if not should_emit_tick:
        properties["status"] = f"WAIT {interval_ms}ms"
        if "runCount" not in properties:
            properties["runCount"] = 0
        return {
            "documentChanged": True,
            "outputPayloads": [],
        }

    previous_tick = properties.get("runCount", 0)
    next_tick = (
        previous_tick + 1
        if isinstance(previous_tick, (int, float)) and not isinstance(previous_tick, bool)
        else 1
    )
    timestamp = context["now"]()
    properties["runCount"] = next_tick
    properties["status"] = f"TICK {next_tick}"
    node["title"] = f"Timer {next_tick}"
    return {
        "documentChanged": True,
        "outputPayloads": [
            {
                "slot": 0,
                "payload": {
                    "timerNodeId": node["id"],
                    "tick": next_tick,
                    "intervalMs": interval_ms,
                    "timestamp": timestamp,
                    "source": source,
                    "runId": run_id,
                },
            }
        ],
    }


def _default_counter_executor(node: dict[str, Any], _: dict[str, Any]) -> dict[str, Any]:
    properties = _ensure_node_properties(node)
    previous_count = properties.get("count", 0)
    next_count = (
        previous_count + 1
        if isinstance(previous_count, (int, float)) and not isinstance(previous_count, bool)
        else 1
    )
    properties["count"] = next_count
    properties["subtitle"] = "可从节点菜单起跑，也可接到 On Play 作为图级入口"
    properties["status"] = f"RUN {next_count}"
    node["title"] = f"Counter {next_count}"
    return {
        "documentChanged": True,
        "outputPayloads": [{"slot": 0, "payload": next_count}],
    }


def _default_display_executor(node: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
    properties = _ensure_node_properties(node)
    input_value = _resolve_first_defined_input_value(context["inputValues"])
    display_value = _format_runtime_value(input_value)
    properties["lastValue"] = _clone_value(input_value)
    properties["subtitle"] = "显示上游通过正式连线传播过来的值"
    properties["status"] = f"VALUE {display_value}"
    node["title"] = f"Display {display_value}"
    return {"documentChanged": True, "outputPayloads": []}


def _create_default_executors() -> dict[str, NodeExecutor]:
    return {
        SYSTEM_TIMER_NODE_TYPE: _default_timer_executor,
        "template/execute-counter": _default_counter_executor,
        "template/execute-display": _default_display_executor,
    }


@dataclass(slots=True)
class ExecutionRun:
    run_id: str
    source: str
    started_at: int
    queue: list[str]
    step_count: int
    loop: asyncio.AbstractEventLoop | None = None
    handle: asyncio.Handle | None = None


class RuntimeController(Protocol):
    def get_state(self) -> dict[str, Any]:
        ...

    def get_document(self) -> dict[str, Any]:
        ...

    def replace_document(
        self,
        document: dict[str, Any],
        *,
        impact: str = STRUCTURAL_DOCUMENT_UPDATE_IMPACT,
    ) -> None:
        ...

    def control(
        self,
        request: dict[str, Any],
        document: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        ...

    def subscribe(self, listener: RuntimeFeedbackListener) -> Callable[[], None]:
        ...

    def subscribe_document(self, listener: DocumentListener) -> Callable[[], None]:
        ...


class NoopRuntimeController:
    def __init__(self) -> None:
        self._document = create_empty_graph_document()
        self._state = _create_idle_graph_execution_state()
        self._listeners: set[RuntimeFeedbackListener] = set()
        self._document_listeners: set[DocumentListener] = set()

    def get_state(self) -> dict[str, Any]:
        return _clone_value(self._state)

    def get_document(self) -> dict[str, Any]:
        return clone_document(self._document)

    def replace_document(
        self,
        document: dict[str, Any],
        *,
        impact: str = STRUCTURAL_DOCUMENT_UPDATE_IMPACT,
    ) -> None:
        self._document = clone_document(document)

    def control(
        self,
        request: dict[str, Any],
        document: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        if document is not None:
            self.replace_document(document)
        request_type = request["type"]
        if request_type == "graph.stop":
            return {
                "accepted": True,
                "changed": False,
                "reason": "默认模板当前未安装执行内核，运行态保持空闲",
                "state": self.get_state(),
            }
        return {
            "accepted": False,
            "changed": False,
            "reason": "默认模板未安装执行内核，请注入自定义 RuntimeController",
            "state": self.get_state(),
        }

    def subscribe(self, listener: RuntimeFeedbackListener) -> Callable[[], None]:
        self._listeners.add(listener)

        def dispose() -> None:
            self._listeners.discard(listener)

        return dispose

    def subscribe_document(self, listener: DocumentListener) -> Callable[[], None]:
        self._document_listeners.add(listener)

        def dispose() -> None:
            self._document_listeners.discard(listener)

        return dispose


class InMemoryGraphRuntimeController:
    def __init__(
        self,
        *,
        authority_name: str = "python-openrpc-authority-template",
        executors_by_node_type: dict[str, NodeExecutor] | None = None,
    ) -> None:
        self.authority_name = authority_name
        self._document = create_empty_graph_document()
        self._graph_execution_state = _create_idle_graph_execution_state()
        self._node_execution_state_by_id: dict[str, dict[str, Any]] = {}
        self._runtime_feedback_listeners: set[RuntimeFeedbackListener] = set()
        self._document_listeners: set[DocumentListener] = set()
        self._executors_by_node_type = _create_default_executors()
        if executors_by_node_type:
            self._executors_by_node_type.update(executors_by_node_type)
        self._active_play_run: ExecutionRun | None = None
        self._active_graph_timers_by_key: dict[str, dict[str, Any]] = {}
        self._timer_activated_in_current_graph_step_tick = False
        self._generated_run_sequence = 0
        self._step_cursor = 0

    def get_state(self) -> dict[str, Any]:
        return _clone_value(self._graph_execution_state)

    def get_document(self) -> dict[str, Any]:
        return clone_document(self._document)

    def replace_document(
        self,
        document: dict[str, Any],
        *,
        impact: str = STRUCTURAL_DOCUMENT_UPDATE_IMPACT,
    ) -> None:
        next_document = clone_document(document)
        if normalize_document_for_compare(self._document) == normalize_document_for_compare(
            next_document
        ):
            self._document = next_document
            return
        self._document = next_document
        if impact != STRUCTURAL_DOCUMENT_UPDATE_IMPACT:
            return
        self._stop_all_runs_without_event()
        self._node_execution_state_by_id.clear()
        self._graph_execution_state = _create_idle_graph_execution_state()
        self._step_cursor = 0

    def control(
        self,
        request: dict[str, Any],
        document: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        if document is not None:
            self.replace_document(document)
        request_type = request["type"]
        if request_type == "node.play":
            return self._control_node_play(request["nodeId"])
        if request_type == "graph.play":
            return self._control_graph_play()
        if request_type == "graph.step":
            return self._control_graph_step()
        if request_type == "graph.stop":
            return self._control_graph_stop()
        return {
            "accepted": False,
            "changed": False,
            "reason": f"不支持的运行控制请求: {request_type}",
            "state": self.get_state(),
        }

    def subscribe(self, listener: RuntimeFeedbackListener) -> Callable[[], None]:
        self._runtime_feedback_listeners.add(listener)

        def dispose() -> None:
            self._runtime_feedback_listeners.discard(listener)

        return dispose

    def subscribe_document(self, listener: DocumentListener) -> Callable[[], None]:
        self._document_listeners.add(listener)

        def dispose() -> None:
            self._document_listeners.discard(listener)

        return dispose

    def _control_node_play(self, node_id: str) -> dict[str, Any]:
        if self._active_play_run is not None:
            return {
                "accepted": False,
                "changed": False,
                "reason": "图级运行中，无法从单节点开始运行",
                "state": self.get_state(),
            }
        execution_result = self._execute_node_chain(
            root_node_id=node_id,
            source="node-play",
            started_at=_now_ms(),
        )
        return {
            "accepted": execution_result["changed"],
            "changed": execution_result["changed"],
            "reason": None if execution_result["changed"] else "节点不存在",
            "state": self.get_state(),
        }

    def _control_graph_play(self) -> dict[str, Any]:
        if self._active_play_run is not None:
            return {
                "accepted": True,
                "changed": False,
                "reason": "图已在运行中",
                "state": self.get_state(),
            }

        queue = self._collect_graph_root_node_ids()
        if not queue:
            return {
                "accepted": True,
                "changed": False,
                "reason": "图中没有可执行节点",
                "state": self.get_state(),
            }

        started_at = _now_ms()
        run = ExecutionRun(
            run_id=self._create_run_id("graph-play"),
            source="graph-play",
            started_at=started_at,
            queue=queue,
            step_count=0,
            loop=self._resolve_event_loop(),
        )
        self._active_play_run = run
        self._step_cursor = 0
        self._set_graph_execution_state(
            status="running",
            run_id=run.run_id,
            queue_size=len(run.queue),
            step_count=0,
            started_at=started_at,
            last_source="graph-play",
        )
        self._emit_graph_execution("started", run)
        self._schedule_next_graph_play_tick()
        return {
            "accepted": True,
            "changed": True,
            "state": self.get_state(),
        }

    def _control_graph_step(self) -> dict[str, Any]:
        if self._active_play_run is not None:
            return {
                "accepted": False,
                "changed": False,
                "reason": "图级运行中，无法单步推进",
                "state": self.get_state(),
            }

        root_node_ids = self._collect_graph_root_node_ids()
        if not root_node_ids:
            return {
                "accepted": True,
                "changed": False,
                "reason": "图中没有可执行节点",
                "state": self.get_state(),
            }

        if self._step_cursor >= len(root_node_ids):
            self._step_cursor = 0
        root_node_id = root_node_ids[self._step_cursor]
        self._step_cursor = (self._step_cursor + 1) % len(root_node_ids)

        started_at = _now_ms()
        run = ExecutionRun(
            run_id=self._create_run_id("graph-step"),
            source="graph-step",
            started_at=started_at,
            queue=[root_node_id],
            step_count=0,
        )
        self._set_graph_execution_state(
            status="stepping",
            run_id=run.run_id,
            queue_size=1,
            step_count=0,
            started_at=started_at,
            last_source="graph-step",
        )
        self._emit_graph_execution("started", run)

        self._timer_activated_in_current_graph_step_tick = False
        execution_result = self._execute_node_chain(
            root_node_id=root_node_id,
            source="graph-step",
            run_id=run.run_id,
            started_at=started_at,
        )
        if not execution_result["changed"]:
            self._set_graph_execution_state(status="idle", queue_size=0, step_count=0)
            return {
                "accepted": False,
                "changed": False,
                "reason": "节点不存在",
                "state": self.get_state(),
            }

        promoted_to_running = self._timer_activated_in_current_graph_step_tick and (
            self._has_active_graph_timers_for_run(run.run_id)
        )
        if promoted_to_running:
            self._active_play_run = ExecutionRun(
                run_id=run.run_id,
                source="graph-step",
                started_at=started_at,
                queue=[],
                step_count=1,
                loop=self._resolve_event_loop(),
            )
            self._update_running_graph_execution_state(self._active_play_run)
            self._emit_graph_execution("advanced", run, node_id=root_node_id)
            return {
                "accepted": True,
                "changed": True,
                "state": self.get_state(),
            }

        timestamp = _now_ms()
        self._set_graph_execution_state(
            status="idle",
            queue_size=0,
            step_count=1,
            started_at=started_at,
            stopped_at=timestamp,
            last_source="graph-step",
        )
        run.step_count = 1
        self._emit_graph_execution(
            "advanced",
            run,
            node_id=root_node_id,
            timestamp=timestamp,
        )
        self._emit_graph_execution("drained", run, timestamp=timestamp)
        return {
            "accepted": True,
            "changed": True,
            "state": self.get_state(),
        }

    def _control_graph_stop(self) -> dict[str, Any]:
        if self._active_play_run is None:
            return {
                "accepted": True,
                "changed": False,
                "reason": "当前没有活动中的图运行",
                "state": self.get_state(),
            }

        self._finalize_graph_play_run(self._active_play_run, "stopped")
        return {
            "accepted": True,
            "changed": True,
            "state": self.get_state(),
        }

    def _collect_graph_root_node_ids(self) -> list[str]:
        node_ids = [
            node["id"]
            for node in self._document["nodes"]
            if isinstance(node, dict) and isinstance(node.get("id"), str)
        ]
        if not node_ids:
            return []

        on_play_node_ids = [
            node["id"]
            for node in self._document["nodes"]
            if node.get("type") == SYSTEM_ON_PLAY_NODE_TYPE and isinstance(node.get("id"), str)
        ]
        if on_play_node_ids:
            return on_play_node_ids

        incoming_node_ids = {
            link["target"]["nodeId"]
            for link in self._document["links"]
            if isinstance(link, dict)
            and isinstance(link.get("target"), dict)
            and isinstance(link["target"].get("nodeId"), str)
        }
        root_node_ids = [node_id for node_id in node_ids if node_id not in incoming_node_ids]
        if root_node_ids:
            return root_node_ids
        return node_ids

    def _resolve_event_loop(self) -> asyncio.AbstractEventLoop:
        try:
            return asyncio.get_running_loop()
        except RuntimeError:
            policy = asyncio.get_event_loop_policy()
            try:
                return policy.get_event_loop()
            except RuntimeError:
                loop = policy.new_event_loop()
                asyncio.set_event_loop(loop)
                return loop

    def _get_node(self, node_id: str) -> dict[str, Any] | None:
        return next(
            (
                node
                for node in self._document["nodes"]
                if isinstance(node, dict) and node.get("id") == node_id
            ),
            None,
        )

    def _create_run_id(self, prefix: str) -> str:
        self._generated_run_sequence += 1
        return f"{self.authority_name}:{prefix}:{_now_ms()}:{self._generated_run_sequence}"

    def _create_chain_id(self, source: str, root_node_id: str, started_at: int) -> str:
        return f"{self.authority_name}:{source}:{root_node_id}:{started_at}"

    def _create_chain_payload(self) -> dict[str, Any]:
        return {"authority": self.authority_name}

    def _set_graph_execution_state(
        self,
        *,
        status: str,
        queue_size: int,
        step_count: int,
        run_id: str | None = None,
        started_at: int | None = None,
        stopped_at: int | None = None,
        last_source: str | None = None,
    ) -> None:
        next_state: dict[str, Any] = {
            "status": status,
            "queueSize": queue_size,
            "stepCount": step_count,
        }
        if run_id is not None:
            next_state["runId"] = run_id
        if started_at is not None:
            next_state["startedAt"] = started_at
        if stopped_at is not None:
            next_state["stoppedAt"] = stopped_at
        if last_source is not None:
            next_state["lastSource"] = last_source
        self._graph_execution_state = next_state

    def _update_running_graph_execution_state(self, run: ExecutionRun) -> None:
        self._set_graph_execution_state(
            status="running",
            run_id=run.run_id,
            queue_size=len(run.queue),
            step_count=run.step_count,
            started_at=run.started_at,
            last_source=run.source,
        )

    def _emit_runtime_feedback(self, event: dict[str, Any]) -> None:
        for listener in list(self._runtime_feedback_listeners):
            listener(_clone_value(event))

    def _emit_document(self) -> None:
        snapshot = clone_document(self._document)
        for listener in list(self._document_listeners):
            listener(clone_document(snapshot))

    def _emit_graph_execution(
        self,
        event_type: str,
        run: ExecutionRun,
        *,
        node_id: str | None = None,
        timestamp: int | None = None,
    ) -> None:
        emitted_at = timestamp or _now_ms()
        event: dict[str, Any] = {
            "type": "graph.execution",
            "event": {
                "type": event_type,
                "state": self.get_state(),
                "runId": run.run_id,
                "source": run.source,
                "timestamp": emitted_at,
            },
        }
        if node_id is not None:
            event["event"]["nodeId"] = node_id
        self._emit_runtime_feedback(event)

    def _emit_node_state(self, node_id: str, reason: str, exists: bool) -> None:
        self._emit_runtime_feedback(
            {
                "type": "node.state",
                "event": {
                    "nodeId": node_id,
                    "exists": exists,
                    "reason": reason,
                    "timestamp": _now_ms(),
                },
            }
        )

    def _get_or_create_node_execution_state(self, node_id: str) -> dict[str, Any]:
        state = self._node_execution_state_by_id.get(node_id)
        if state is None:
            state = {"status": "idle", "runCount": 0}
            self._node_execution_state_by_id[node_id] = state
        return state

    def _create_execution_context(
        self,
        *,
        source: str,
        root_node_id: str,
        started_at: int,
        sequence: int,
        payload: Any,
        run_id: str | None = None,
    ) -> dict[str, Any]:
        context: dict[str, Any] = {
            "source": source,
            "entryNodeId": root_node_id,
            "stepIndex": sequence,
            "startedAt": started_at,
            "payload": _clone_value(payload),
        }
        if run_id is not None:
            context["runId"] = run_id
        return context

    def _emit_node_execution(
        self,
        *,
        chain_id: str,
        source: str,
        root_node: dict[str, Any],
        node: dict[str, Any],
        depth: int,
        sequence: int,
        trigger: str,
        timestamp: int,
        execution_context: dict[str, Any],
        state: dict[str, Any],
    ) -> None:
        self._emit_runtime_feedback(
            {
                "type": "node.execution",
                "event": {
                    "chainId": chain_id,
                    "rootNodeId": root_node["id"],
                    "rootNodeType": root_node["type"],
                    "rootNodeTitle": root_node.get("title") or root_node["id"],
                    "nodeId": node["id"],
                    "nodeType": node["type"],
                    "nodeTitle": node.get("title") or node["id"],
                    "depth": depth,
                    "sequence": sequence,
                    "source": source,
                    "trigger": trigger,
                    "timestamp": timestamp,
                    "executionContext": _clone_value(execution_context),
                    "state": _clone_value(state),
                },
            }
        )

    def _emit_link_propagation(
        self,
        *,
        chain_id: str,
        link: dict[str, Any],
        source_slot: int,
        target_slot: int,
        payload: Any,
        timestamp: int,
    ) -> None:
        self._emit_runtime_feedback(
            {
                "type": "link.propagation",
                "event": {
                    "linkId": link["id"],
                    "chainId": chain_id,
                    "sourceNodeId": link["source"]["nodeId"],
                    "sourceSlot": source_slot,
                    "targetNodeId": link["target"]["nodeId"],
                    "targetSlot": target_slot,
                    "payload": _clone_value(payload),
                    "timestamp": timestamp,
                },
            }
        )

    def _collect_outgoing_source_slots(self, node_id: str) -> list[int]:
        source_slots = {
            _coerce_slot_index(link["source"].get("slot"))
            for link in self._document["links"]
            if isinstance(link, dict)
            and isinstance(link.get("source"), dict)
            and link["source"].get("nodeId") == node_id
        }
        return sorted(source_slots)

    def _create_default_execution_result(self, node: dict[str, Any], source: str) -> dict[str, Any]:
        source_slots = self._collect_outgoing_source_slots(node["id"])
        if not source_slots:
            return {"documentChanged": False, "outputPayloads": []}
        payload = {
            "authority": self.authority_name,
            "source": source,
        }
        return {
            "documentChanged": False,
            "outputPayloads": [
                {"slot": slot, "payload": payload} for slot in source_slots
            ],
        }

    def _execute_node(
        self,
        *,
        node: dict[str, Any],
        source: str,
        root_node_id: str,
        run_id: str | None,
        started_at: int,
        sequence: int,
        input_values: list[Any],
        timer_tick_node_id: str | None,
        chain_payload: Any,
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        execution_context = self._create_execution_context(
            source=source,
            root_node_id=root_node_id,
            started_at=started_at,
            sequence=sequence,
            payload=chain_payload,
            run_id=run_id,
        )
        runtime_context: dict[str, Any] = {
            "source": source,
            "startedAt": started_at,
            "inputValues": _clone_value(input_values),
            "now": _now_ms,
        }
        if run_id is not None:
            runtime_context["runId"] = run_id
        if source in {"graph-play", "graph-step"}:
            timer_runtime: dict[str, Any] = {"registerTimer": self._register_timer}
            if timer_tick_node_id is not None:
                timer_runtime["timerTickNodeId"] = timer_tick_node_id
            runtime_context["timerRuntime"] = timer_runtime

        if node.get("type") == SYSTEM_ON_PLAY_NODE_TYPE:
            return (
                {
                    "documentChanged": False,
                    "outputPayloads": [{"slot": 0, "payload": execution_context}],
                },
                execution_context,
            )

        executor = self._executors_by_node_type.get(node.get("type"))
        if executor is None:
            return self._create_default_execution_result(node, source), execution_context

        return executor(node, runtime_context), execution_context

    def _execute_node_chain(
        self,
        *,
        root_node_id: str,
        source: str,
        started_at: int,
        run_id: str | None = None,
        timer_tick_node_id: str | None = None,
    ) -> dict[str, Any]:
        root_node = self._get_node(root_node_id)
        if root_node is None:
            return {
                "changed": False,
                "additionalAdvancedNodeIds": [],
            }

        chain_id = self._create_chain_id(source, root_node_id, started_at)
        chain_payload = self._create_chain_payload()
        additional_advanced_node_ids: list[str] = []
        visited: set[str] = set()
        document_changed = False
        sequence = 0

        def walk(
            node_id: str,
            depth: int,
            trigger: str,
            input_values: list[Any] | None = None,
        ) -> None:
            nonlocal document_changed, sequence
            if node_id in visited:
                return
            node = self._get_node(node_id)
            if node is None:
                return
            visited.add(node_id)
            current_sequence = sequence
            sequence += 1
            next_input_values = _clone_value(input_values or [])
            execution_result, execution_context = self._execute_node(
                node=node,
                source=source,
                root_node_id=root_node_id,
                run_id=run_id,
                started_at=started_at,
                sequence=current_sequence,
                input_values=next_input_values,
                timer_tick_node_id=timer_tick_node_id if node_id == timer_tick_node_id else None,
                chain_payload=chain_payload,
            )
            if execution_result.get("documentChanged"):
                document_changed = True

            timestamp = _now_ms()
            node_state = self._get_or_create_node_execution_state(node["id"])
            node_state["status"] = "success"
            node_state["runCount"] = int(node_state.get("runCount", 0)) + 1
            node_state["lastExecutedAt"] = timestamp
            node_state["lastSucceededAt"] = timestamp
            node_state.pop("lastFailedAt", None)
            node_state.pop("lastErrorMessage", None)
            self._emit_node_execution(
                chain_id=chain_id,
                source=source,
                root_node=root_node,
                node=node,
                depth=depth,
                sequence=current_sequence,
                trigger=trigger,
                timestamp=timestamp,
                execution_context=execution_context,
                state=node_state,
            )
            self._emit_node_state(node["id"], "execution", True)

            if (
                node.get("type") == SYSTEM_TIMER_NODE_TYPE
                and execution_result.get("outputPayloads")
                and node["id"] != root_node_id
            ):
                additional_advanced_node_ids.append(node["id"])

            for output in execution_result.get("outputPayloads", []):
                source_slot = _coerce_slot_index(output.get("slot"))
                payload = output.get("payload")
                for link in self._document["links"]:
                    if not isinstance(link, dict):
                        continue
                    if not isinstance(link.get("source"), dict) or not isinstance(
                        link.get("target"), dict
                    ):
                        continue
                    if link["source"].get("nodeId") != node["id"]:
                        continue
                    if _coerce_slot_index(link["source"].get("slot")) != source_slot:
                        continue
                    target_node_id = link["target"].get("nodeId")
                    if not isinstance(target_node_id, str) or self._get_node(target_node_id) is None:
                        continue
                    target_slot = _coerce_slot_index(link["target"].get("slot"))
                    self._emit_link_propagation(
                        chain_id=chain_id,
                        link=link,
                        source_slot=source_slot,
                        target_slot=target_slot,
                        payload=payload,
                        timestamp=timestamp,
                    )
                    walk(
                        target_node_id,
                        depth + 1,
                        "propagated",
                        _build_input_values(target_slot, payload),
                    )

        walk(root_node_id, 0, "direct")
        if document_changed:
            self._emit_document()
        return {
            "changed": True,
            "additionalAdvancedNodeIds": additional_advanced_node_ids,
        }

    def _create_graph_timer_key(self, run_id: str, node_id: str) -> str:
        return f"{run_id}::{node_id}"

    def _register_timer(self, input: dict[str, Any]) -> None:
        run_id = input.get("runId")
        node_id = input.get("nodeId")
        source = input.get("source")
        if not isinstance(run_id, str) or not isinstance(node_id, str):
            return
        if source not in ("graph-play", "graph-step"):
            return

        has_active_run = bool(
            (self._active_play_run is not None and self._active_play_run.run_id == run_id)
            or self._graph_execution_state.get("runId") == run_id
        )
        if not has_active_run:
            return

        started_at = input.get("startedAt")
        if isinstance(started_at, bool) or not isinstance(started_at, (int, float)):
            started_at = _now_ms()

        interval_ms = _resolve_timer_interval_ms(input.get("intervalMs"))
        timer_key = self._create_graph_timer_key(run_id, node_id)
        self._stop_graph_timer_by_key(timer_key)

        run = self._active_play_run
        loop = (
            run.loop
            if run is not None and run.run_id == run_id and run.loop is not None
            else self._resolve_event_loop()
        )
        handle = loop.call_later(
            interval_ms / 1000,
            self._handle_graph_timer_tick,
            timer_key,
        )
        self._active_graph_timers_by_key[timer_key] = {
            "timerKey": timer_key,
            "runId": run_id,
            "nodeId": node_id,
            "source": source,
            "startedAt": int(started_at),
            "intervalMs": interval_ms,
            "handle": handle,
        }
        self._timer_activated_in_current_graph_step_tick = True

    def _handle_graph_timer_tick(self, timer_key: str) -> None:
        timer = self._active_graph_timers_by_key.get(timer_key)
        if timer is None:
            return

        run = self._active_play_run
        if (
            run is None
            or run.run_id != timer["runId"]
            or run.source != timer["source"]
        ):
            self._stop_graph_timer_by_key(timer_key)
            return

        loop = run.loop or self._resolve_event_loop()
        timer["handle"] = loop.call_later(
            timer["intervalMs"] / 1000,
            self._handle_graph_timer_tick,
            timer_key,
        )
        self._active_graph_timers_by_key[timer_key] = timer

        execution_result = self._execute_node_chain(
            root_node_id=timer["nodeId"],
            source=timer["source"],
            run_id=timer["runId"],
            started_at=timer["startedAt"],
            timer_tick_node_id=timer["nodeId"],
        )
        if not execution_result["changed"]:
            self._stop_graph_timer_by_key(timer_key)
            return

        active_run = self._active_play_run
        if active_run is not None and active_run.run_id == timer["runId"]:
            active_run.step_count += 1
            self._update_running_graph_execution_state(active_run)
            self._emit_graph_execution(
                "advanced",
                active_run,
                node_id=timer["nodeId"],
            )
            self._emit_additional_graph_execution_advances(
                active_run,
                execution_result["additionalAdvancedNodeIds"],
            )

    def _emit_additional_graph_execution_advances(
        self,
        run: ExecutionRun,
        node_ids: list[str],
    ) -> None:
        for node_id in node_ids:
            run.step_count += 1
            self._update_running_graph_execution_state(run)
            self._emit_graph_execution("advanced", run, node_id=node_id)

    def _stop_graph_timer_by_key(self, timer_key: str) -> None:
        timer = self._active_graph_timers_by_key.pop(timer_key, None)
        if timer is None:
            return
        handle = timer.get("handle")
        if handle is not None:
            handle.cancel()

    def _stop_graph_timers_for_run(self, run_id: str) -> None:
        timer_keys = [
            timer_key
            for timer_key, timer in self._active_graph_timers_by_key.items()
            if timer.get("runId") == run_id
        ]
        for timer_key in timer_keys:
            self._stop_graph_timer_by_key(timer_key)

    def _has_active_graph_timers_for_run(self, run_id: str) -> bool:
        return any(
            timer.get("runId") == run_id
            for timer in self._active_graph_timers_by_key.values()
        )

    def _schedule_next_graph_play_tick(self) -> None:
        run = self._active_play_run
        if run is None:
            return
        if run.handle is not None:
            run.handle.cancel()
        run.loop = run.loop or self._resolve_event_loop()
        run.handle = run.loop.call_later(0, self._advance_graph_play_run, run.run_id)

    def _advance_graph_play_run(self, expected_run_id: str) -> None:
        active_run = self._active_play_run
        if active_run is None or active_run.run_id != expected_run_id:
            return

        active_run.handle = None
        root_node_id = active_run.queue.pop(0) if active_run.queue else None
        if root_node_id is None:
            if not self._has_active_graph_timers_for_run(active_run.run_id):
                self._finalize_graph_play_run(active_run, "drained")
            else:
                self._update_running_graph_execution_state(active_run)
            return

        execution_result = self._execute_node_chain(
            root_node_id=root_node_id,
            source=active_run.source,
            run_id=active_run.run_id,
            started_at=active_run.started_at,
        )
        active_run.step_count += 1

        timestamp = _now_ms()
        has_more = bool(active_run.queue) or self._has_active_graph_timers_for_run(
            active_run.run_id
        )
        if has_more:
            self._update_running_graph_execution_state(active_run)
        else:
            self._set_graph_execution_state(
                status="idle",
                queue_size=0,
                step_count=active_run.step_count,
                started_at=active_run.started_at,
                stopped_at=timestamp,
                last_source=active_run.source,
            )
        self._emit_graph_execution(
            "advanced",
            active_run,
            node_id=root_node_id,
            timestamp=timestamp,
        )
        self._emit_additional_graph_execution_advances(
            active_run,
            execution_result["additionalAdvancedNodeIds"],
        )

        if active_run.queue:
            self._schedule_next_graph_play_tick()
            return

        if not self._has_active_graph_timers_for_run(active_run.run_id):
            self._finalize_graph_play_run(active_run, "drained")

    def _finalize_graph_play_run(self, run: ExecutionRun, event_type: str) -> None:
        if self._active_play_run is None or self._active_play_run.run_id != run.run_id:
            return

        self._stop_graph_timers_for_run(run.run_id)
        if run.handle is not None:
            run.handle.cancel()
            run.handle = None
        self._active_play_run = None

        timestamp = _now_ms()
        self._set_graph_execution_state(
            status="idle",
            queue_size=0,
            step_count=run.step_count,
            started_at=run.started_at,
            stopped_at=timestamp,
            last_source=run.source,
        )
        self._emit_graph_execution(event_type, run, timestamp=timestamp)

    def _stop_all_runs_without_event(self) -> None:
        if self._active_play_run is not None and self._active_play_run.handle is not None:
            self._active_play_run.handle.cancel()
            self._active_play_run.handle = None
        self._active_play_run = None
        for timer in self._active_graph_timers_by_key.values():
            handle = timer.get("handle")
            if handle is not None:
                handle.cancel()
        self._active_graph_timers_by_key.clear()
        self._timer_activated_in_current_graph_step_tick = False
