use tauri::State;

use crate::cli::CliArgs;
use crate::error::TasukiError;
use crate::git;
use crate::state::AppState;

/// Send review rejection to Claude Code via cmux.
///
/// Writes the review text to `/tmp/tasuki/{repo}/review-prompt.md`
/// and sends a cmux command to the configured pane.
#[tauri::command]
pub async fn cmux_reject(
    cli_args: State<'_, CliArgs>,
    state: State<'_, AppState>,
    review_text: String,
) -> Result<(), TasukiError> {
    let pane_id = cli_args
        .cmux_pane
        .as_ref()
        .ok_or_else(|| TasukiError::InvalidArgument("cmux pane not configured".to_string()))?;

    let repo_name = git::get_repo_info(&state.repo_path)?.repo_name;

    let pane_id = pane_id.clone();
    tokio::task::spawn_blocking(move || {
        crate::cmux::send_review(&pane_id, &repo_name, &review_text)
    })
    .await
    .map_err(|e| TasukiError::Io(e.to_string()))??;

    Ok(())
}

/// Send approval to Claude Code via cmux.
///
/// Sends a commit instruction to the configured cmux pane.
#[tauri::command]
pub async fn cmux_approve(cli_args: State<'_, CliArgs>) -> Result<(), TasukiError> {
    let pane_id = cli_args
        .cmux_pane
        .as_ref()
        .ok_or_else(|| TasukiError::InvalidArgument("cmux pane not configured".to_string()))?;

    let pane_id = pane_id.clone();
    tokio::task::spawn_blocking(move || {
        crate::cmux::send_keys(&pane_id, "変更をコミットしてください")
    })
    .await
    .map_err(|e| TasukiError::Io(e.to_string()))??;

    Ok(())
}
