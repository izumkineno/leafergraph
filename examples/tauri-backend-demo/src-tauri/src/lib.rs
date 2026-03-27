//! Tauri authority demo 后端入口。
//!
//! 负责组装 authority 状态、注册命令，并把 Tauri 应用启动收口到统一入口。

mod authority;

use std::sync::Arc;

use authority::{AuthorityController, SyncCommandInput};
use tauri::Manager;

/// 返回当前 authority 持有的正式文档快照。
#[tauri::command]
fn sync_get_document(
    state: tauri::State<'_, Arc<AuthorityController>>,
) -> Result<serde_json::Value, String> {
    Ok(state.get_document())
}

/// 提交一条同步命令，并等待 authority 给出最小确认。
#[tauri::command]
fn sync_submit_command(
    state: tauri::State<'_, Arc<AuthorityController>>,
    command: SyncCommandInput,
) -> Result<serde_json::Value, String> {
    state.submit_command(command)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let authority = Arc::new(AuthorityController::new(app.handle().clone())?);
            app.manage(authority);
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            sync_get_document,
            sync_submit_command
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
