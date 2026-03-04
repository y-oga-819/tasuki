use serde::Deserialize;
use std::fs;
use std::path::PathBuf;
use tauri::State;

use crate::error::TasukiError;
use crate::git;
use crate::state::AppState;

/// Validated source type for review sessions
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SourceType {
    Uncommitted,
    Staged,
    Working,
    Commit,
    Range,
}

impl SourceType {
    fn as_str(&self) -> &'static str {
        match self {
            Self::Uncommitted => "uncommitted",
            Self::Staged => "staged",
            Self::Working => "working",
            Self::Commit => "commit",
            Self::Range => "range",
        }
    }
}

/// Build the path for a review session file: /tmp/tasuki/{repo}/reviews/{sha}_{type}.json
fn review_file_path(repo_name: &str, head_sha: &str, source_type: &SourceType) -> PathBuf {
    let short_sha = &head_sha[..head_sha.len().min(8)];
    PathBuf::from("/tmp/tasuki")
        .join(repo_name)
        .join("reviews")
        .join(format!("{}_{}.json", short_sha, source_type.as_str()))
}

/// Save a review session to disk
#[tauri::command]
pub async fn save_review(
    state: State<'_, AppState>,
    head_sha: String,
    source_type: SourceType,
    json_data: String,
) -> Result<(), TasukiError> {
    let repo_path = state.repo_path.clone();
    let repo_name = git::get_repo_info(&repo_path)?.repo_name;
    tokio::task::spawn_blocking(move || {
        let path = review_file_path(&repo_name, &head_sha, &source_type);

        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| TasukiError::Io(format!("Cannot create reviews dir: {}", e)))?;
        }

        fs::write(&path, json_data)
            .map_err(|e| TasukiError::Io(format!("Cannot write review file: {}", e)))?;

        Ok(())
    })
    .await
    .map_err(|e| TasukiError::Io(e.to_string()))?
}

/// Load a review session from disk. Returns None if no saved session exists.
#[tauri::command]
pub async fn load_review(
    state: State<'_, AppState>,
    head_sha: String,
    source_type: SourceType,
) -> Result<Option<String>, TasukiError> {
    let repo_path = state.repo_path.clone();
    let repo_name = git::get_repo_info(&repo_path)?.repo_name;
    tokio::task::spawn_blocking(move || {
        let path = review_file_path(&repo_name, &head_sha, &source_type);

        if !path.exists() {
            return Ok(None);
        }

        let content = fs::read_to_string(&path)
            .map_err(|e| TasukiError::Io(format!("Cannot read review file: {}", e)))?;

        Ok(Some(content))
    })
    .await
    .map_err(|e| TasukiError::Io(e.to_string()))?
}
