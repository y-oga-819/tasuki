use tauri::{AppHandle, State};

use crate::error::TasukiError;
use crate::pty::PtyState;
use crate::state::AppState;

/// Spawn a terminal PTY session
#[tauri::command]
pub async fn spawn_terminal(
    app: AppHandle,
    state: State<'_, AppState>,
    pty_state: State<'_, PtyState>,
    cols: u16,
    rows: u16,
) -> Result<(), TasukiError> {
    let cwd = state.repo_path.clone();
    pty_state.spawn(&app, cols, rows, &cwd)
}

/// Write data to the terminal PTY
#[tauri::command]
pub async fn write_terminal(
    pty_state: State<'_, PtyState>,
    data: String,
) -> Result<(), TasukiError> {
    pty_state.write(&data)
}

/// Resize the terminal PTY
#[tauri::command]
pub async fn resize_terminal(
    pty_state: State<'_, PtyState>,
    cols: u16,
    rows: u16,
) -> Result<(), TasukiError> {
    pty_state.resize(cols, rows)
}

/// Kill the terminal PTY session
#[tauri::command]
pub async fn kill_terminal(pty_state: State<'_, PtyState>) -> Result<(), TasukiError> {
    pty_state.kill();
    Ok(())
}

/// Check whether a terminal PTY session is currently running
#[tauri::command]
pub async fn is_terminal_alive(pty_state: State<'_, PtyState>) -> Result<bool, TasukiError> {
    Ok(pty_state.is_alive())
}
