use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use tauri::State;

use crate::error::TasukiError;
use crate::git;
use crate::state::AppState;

/// Commit gate data (v3) written to disk via serde
#[derive(Serialize)]
struct CommitGate {
    version: u32,
    status: String,
    timestamp: String,
    repository: String,
    branch: String,
    threads: serde_json::Value,
    doc_threads: serde_json::Value,
}

/// Build the path for the commit gate file: /tmp/tasuki/{repo}/{branch}/review.json
fn gate_file_path(repo_name: &str, branch_name: &str) -> PathBuf {
    PathBuf::from("/tmp/tasuki")
        .join(repo_name)
        .join(branch_name)
        .join("review.json")
}

/// Get (repo_name, branch_name) from state
fn get_gate_context(state: &State<AppState>) -> Result<(String, String), TasukiError> {
    let repo_path = state.repo_path.clone();
    let info = git::get_repo_info(&repo_path)?;
    let branch = info
        .branch_name
        .ok_or_else(|| TasukiError::Git("Not on a branch (detached HEAD)".to_string()))?;
    Ok((info.repo_name, branch))
}

/// Write a commit gate file (v3: thread-based).
#[tauri::command]
pub async fn write_commit_gate(
    state: State<'_, AppState>,
    status: String,
    threads: String,
    doc_threads: String,
) -> Result<String, TasukiError> {
    let (repo_name, branch) = get_gate_context(&state)?;
    let path = gate_file_path(&repo_name, &branch);

    let path_str = path.to_string_lossy().to_string();

    tokio::task::spawn_blocking(move || {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| TasukiError::Io(format!("Cannot create gate dir: {}", e)))?;
        }

        let gate = CommitGate {
            version: 3,
            status,
            timestamp: chrono::Utc::now().to_rfc3339(),
            repository: repo_name,
            branch,
            threads: serde_json::from_str(&threads)
                .unwrap_or(serde_json::Value::Array(vec![])),
            doc_threads: serde_json::from_str(&doc_threads)
                .unwrap_or(serde_json::Value::Array(vec![])),
        };

        let gate_json = serde_json::to_string(&gate)
            .map_err(|e| TasukiError::Io(format!("JSON serialize error: {}", e)))?;

        fs::write(&path, gate_json)
            .map_err(|e| TasukiError::Io(format!("Cannot write gate file: {}", e)))?;

        Ok(path_str)
    })
    .await
    .map_err(|e| TasukiError::Io(e.to_string()))?
}

/// Read the current commit gate file. Returns None if it doesn't exist.
#[tauri::command]
pub async fn read_commit_gate(state: State<'_, AppState>) -> Result<Option<String>, TasukiError> {
    let (repo_name, branch) = get_gate_context(&state)?;
    let path = gate_file_path(&repo_name, &branch);

    tokio::task::spawn_blocking(move || {
        if !path.exists() {
            return Ok(None);
        }
        let content = fs::read_to_string(&path)
            .map_err(|e| TasukiError::Io(format!("Cannot read gate file: {}", e)))?;
        Ok(Some(content))
    })
    .await
    .map_err(|e| TasukiError::Io(e.to_string()))?
}

/// Delete the commit gate file
#[tauri::command]
pub async fn clear_commit_gate(state: State<'_, AppState>) -> Result<(), TasukiError> {
    let (repo_name, branch) = get_gate_context(&state)?;
    let path = gate_file_path(&repo_name, &branch);

    tokio::task::spawn_blocking(move || {
        if path.exists() {
            fs::remove_file(&path)
                .map_err(|e| TasukiError::Io(format!("Cannot remove gate file: {}", e)))?;
        }
        Ok(())
    })
    .await
    .map_err(|e| TasukiError::Io(e.to_string()))?
}
