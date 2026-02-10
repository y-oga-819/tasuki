use tauri::{AppHandle, Emitter, State};
use std::sync::Mutex;

use crate::error::TasukiError;
use crate::git::{self, CommitInfo, DiffResult};
use crate::watcher;
use crate::CliArgs;

/// Application state shared across commands
pub struct AppState {
    pub repo_path: Mutex<String>,
}

/// Get uncommitted diff (default: all uncommitted changes)
#[tauri::command]
pub fn get_diff(state: State<AppState>) -> Result<DiffResult, TasukiError> {
    let repo_path = state.repo_path.lock().unwrap().clone();
    git::get_uncommitted_diff(&repo_path)
}

/// Get staged changes only
#[tauri::command]
pub fn get_staged_diff(state: State<AppState>) -> Result<DiffResult, TasukiError> {
    let repo_path = state.repo_path.lock().unwrap().clone();
    git::get_staged_diff(&repo_path)
}

/// Get working (unstaged) changes only
#[tauri::command]
pub fn get_working_diff(state: State<AppState>) -> Result<DiffResult, TasukiError> {
    let repo_path = state.repo_path.lock().unwrap().clone();
    git::get_working_diff(&repo_path)
}

/// Get diff between two refs
#[tauri::command]
pub fn get_ref_diff(
    state: State<AppState>,
    from_ref: String,
    to_ref: String,
) -> Result<DiffResult, TasukiError> {
    let repo_path = state.repo_path.lock().unwrap().clone();
    git::get_ref_diff(&repo_path, &from_ref, &to_ref)
}

/// Get diff for a specific commit
#[tauri::command]
pub fn get_commit_diff(
    state: State<AppState>,
    commit_ref: String,
) -> Result<DiffResult, TasukiError> {
    let repo_path = state.repo_path.lock().unwrap().clone();
    git::get_commit_diff(&repo_path, &commit_ref)
}

/// Get recent commit log
#[tauri::command]
pub fn get_log(
    state: State<AppState>,
    max_count: Option<usize>,
) -> Result<Vec<CommitInfo>, TasukiError> {
    let repo_path = state.repo_path.lock().unwrap().clone();
    git::get_log(&repo_path, max_count.unwrap_or(20))
}

/// List markdown documentation files
#[tauri::command]
pub fn list_docs(state: State<AppState>) -> Result<Vec<String>, TasukiError> {
    let repo_path = state.repo_path.lock().unwrap().clone();
    git::list_doc_files(&repo_path)
}

/// Read a file's content
#[tauri::command]
pub fn read_file(
    state: State<AppState>,
    file_path: String,
) -> Result<String, TasukiError> {
    let repo_path = state.repo_path.lock().unwrap().clone();
    git::read_file(&repo_path, &file_path)
}

/// Start watching the repository for file changes
#[tauri::command]
pub fn start_watching(
    app_handle: AppHandle,
    state: State<AppState>,
) -> Result<(), TasukiError> {
    let repo_path = state.repo_path.lock().unwrap().clone();
    watcher::start_watching(app_handle, repo_path)
}

/// Get the current repository path
#[tauri::command]
pub fn get_repo_path(state: State<AppState>) -> String {
    state.repo_path.lock().unwrap().clone()
}

/// Get the CLI arguments that were passed when launching Tasuki
#[tauri::command]
pub fn get_cli_args(cli_args: State<CliArgs>) -> CliArgs {
    cli_args.inner().clone()
}
