use serde::Serialize;
use tauri::State;

use crate::cli::CliArgs;
use crate::error::TasukiError;
use crate::git::{self, CommitInfo, DiffResult, RepoInfo};
use crate::state::AppState;
use crate::watcher;

/// Lightweight change status for the "check then notify" pattern
#[derive(Debug, Clone, Serialize)]
pub struct ChangeStatus {
    pub head_sha: String,
    pub has_changes: bool,
}

/// Get uncommitted diff (default: all uncommitted changes)
#[tauri::command]
pub async fn get_diff(state: State<'_, AppState>) -> Result<DiffResult, TasukiError> {
    let repo_path = state.repo_path.clone();
    tokio::task::spawn_blocking(move || git::get_uncommitted_diff(&repo_path))
        .await
        .map_err(|e| TasukiError::Io(e.to_string()))?
}

/// Get staged changes only
#[tauri::command]
pub async fn get_staged_diff(state: State<'_, AppState>) -> Result<DiffResult, TasukiError> {
    let repo_path = state.repo_path.clone();
    tokio::task::spawn_blocking(move || git::get_staged_diff(&repo_path))
        .await
        .map_err(|e| TasukiError::Io(e.to_string()))?
}

/// Get working (unstaged) changes only
#[tauri::command]
pub async fn get_working_diff(state: State<'_, AppState>) -> Result<DiffResult, TasukiError> {
    let repo_path = state.repo_path.clone();
    tokio::task::spawn_blocking(move || git::get_working_diff(&repo_path))
        .await
        .map_err(|e| TasukiError::Io(e.to_string()))?
}

/// Get diff between two refs
#[tauri::command]
pub async fn get_ref_diff(
    state: State<'_, AppState>,
    from_ref: String,
    to_ref: String,
) -> Result<DiffResult, TasukiError> {
    let repo_path = state.repo_path.clone();
    tokio::task::spawn_blocking(move || git::get_ref_diff(&repo_path, &from_ref, &to_ref))
        .await
        .map_err(|e| TasukiError::Io(e.to_string()))?
}

/// Get diff for a specific commit
#[tauri::command]
pub async fn get_commit_diff(
    state: State<'_, AppState>,
    commit_ref: String,
) -> Result<DiffResult, TasukiError> {
    let repo_path = state.repo_path.clone();
    tokio::task::spawn_blocking(move || git::get_commit_diff(&repo_path, &commit_ref))
        .await
        .map_err(|e| TasukiError::Io(e.to_string()))?
}

/// Get recent commit log
#[tauri::command]
pub async fn get_log(
    state: State<'_, AppState>,
    max_count: Option<usize>,
) -> Result<Vec<CommitInfo>, TasukiError> {
    let repo_path = state.repo_path.clone();
    let count = max_count.unwrap_or(20);
    tokio::task::spawn_blocking(move || git::get_log(&repo_path, count))
        .await
        .map_err(|e| TasukiError::Io(e.to_string()))?
}

/// Get repository info (name, branch, worktree status)
#[tauri::command]
pub async fn get_repo_info(state: State<'_, AppState>) -> Result<RepoInfo, TasukiError> {
    let repo_path = state.repo_path.clone();
    tokio::task::spawn_blocking(move || git::get_repo_info(&repo_path))
        .await
        .map_err(|e| TasukiError::Io(e.to_string()))?
}

/// Get the current repository path
#[tauri::command]
pub async fn get_repo_path(state: State<'_, AppState>) -> Result<String, TasukiError> {
    Ok(state.repo_path.clone())
}

/// Get the HEAD commit SHA
#[tauri::command]
pub async fn get_head_sha(state: State<'_, AppState>) -> Result<String, TasukiError> {
    let repo_path = state.repo_path.clone();
    tokio::task::spawn_blocking(move || git::get_head_sha(&repo_path))
        .await
        .map_err(|e| TasukiError::Io(e.to_string()))?
}

/// Compute a SHA-256 hash of the current diff for change detection
#[tauri::command]
pub async fn get_diff_hash(
    _state: State<'_, AppState>,
    diff_result: DiffResult,
) -> Result<String, TasukiError> {
    Ok(tokio::task::spawn_blocking(move || git::compute_diff_hash(&diff_result))
        .await
        .map_err(|e| TasukiError::Io(e.to_string()))?)
}

/// Start watching the repository for file changes
#[tauri::command]
pub async fn start_watching(
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), TasukiError> {
    let repo_path = state.repo_path.clone();

    // Stop the previous watcher (if any) before creating a new one
    let mut watcher_guard = state.watcher_handle.lock();
    watcher_guard.take();

    let handle = watcher::start_watching(app_handle, repo_path)?;
    *watcher_guard = Some(handle);
    Ok(())
}

/// Get the CLI arguments that were passed when launching Tasuki
#[tauri::command]
pub async fn get_cli_args(cli_args: State<'_, CliArgs>) -> Result<CliArgs, TasukiError> {
    Ok(cli_args.inner().clone())
}

/// Lightweight check for changes (HEAD SHA + working tree status).
/// Much cheaper than generating a full diff.
#[tauri::command]
pub async fn check_changes(state: State<'_, AppState>) -> Result<ChangeStatus, TasukiError> {
    let repo_path = state.repo_path.clone();
    tokio::task::spawn_blocking(move || {
        let repo = git::open_repo(&repo_path)?;
        let head_sha = repo.head()?.peel_to_commit()?.id().to_string();
        let has_changes = repo
            .statuses(None)?
            .iter()
            .any(|s| !s.status().is_empty());
        Ok(ChangeStatus {
            head_sha,
            has_changes,
        })
    })
    .await
    .map_err(|e| TasukiError::Io(e.to_string()))?
}
