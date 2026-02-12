use tauri::{AppHandle, State};
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::sync::Mutex;

use crate::error::TasukiError;
use crate::git::{self, CommitInfo, DiffResult, RepoInfo};
use crate::watcher::{self, WatcherHandle};
use crate::CliArgs;

/// Application state shared across commands
pub struct AppState {
    pub repo_path: Mutex<String>,
    pub watcher_handle: Mutex<Option<WatcherHandle>>,
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

    // Stop the previous watcher (if any) before creating a new one
    let mut watcher_guard = state.watcher_handle.lock().unwrap();
    watcher_guard.take();

    let handle = watcher::start_watching(app_handle, repo_path)?;
    *watcher_guard = Some(handle);
    Ok(())
}

/// Get repository info (name, branch, worktree status)
#[tauri::command]
pub fn get_repo_info(state: State<AppState>) -> Result<RepoInfo, TasukiError> {
    let repo_path = state.repo_path.lock().unwrap().clone();
    git::get_repo_info(&repo_path)
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

/// Get the HEAD commit SHA
#[tauri::command]
pub fn get_head_sha(state: State<AppState>) -> Result<String, TasukiError> {
    let repo_path = state.repo_path.lock().unwrap().clone();
    git::get_head_sha(&repo_path)
}

/// Compute a SHA-256 hash of the current diff for change detection
#[tauri::command]
pub fn get_diff_hash(state: State<AppState>, diff_result: DiffResult) -> String {
    let _ = state;
    git::compute_diff_hash(&diff_result)
}

/// Build the path for a review session file
fn review_file_path(repo_path: &str, head_sha: &str, source_type: &str) -> PathBuf {
    let short_sha = &head_sha[..head_sha.len().min(8)];
    PathBuf::from(repo_path)
        .join(".tasuki")
        .join("reviews")
        .join(format!("{}_{}.json", short_sha, source_type))
}

/// Save a review session to disk
#[tauri::command]
pub fn save_review(
    state: State<AppState>,
    head_sha: String,
    source_type: String,
    json_data: String,
) -> Result<(), TasukiError> {
    let repo_path = state.repo_path.lock().unwrap().clone();
    let path = review_file_path(&repo_path, &head_sha, &source_type);

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| TasukiError::Io(format!("Cannot create reviews dir: {}", e)))?;
    }

    fs::write(&path, json_data)
        .map_err(|e| TasukiError::Io(format!("Cannot write review file: {}", e)))?;

    Ok(())
}

/// Load a review session from disk. Returns None if no saved session exists.
#[tauri::command]
pub fn load_review(
    state: State<AppState>,
    head_sha: String,
    source_type: String,
) -> Result<Option<String>, TasukiError> {
    let repo_path = state.repo_path.lock().unwrap().clone();
    let path = review_file_path(&repo_path, &head_sha, &source_type);

    if !path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&path)
        .map_err(|e| TasukiError::Io(format!("Cannot read review file: {}", e)))?;

    Ok(Some(content))
}

/// Validate a design doc filename for security
fn validate_design_doc_filename(filename: &str) -> Result<(), TasukiError> {
    let path = Path::new(filename);

    // Only allow Normal components (reject ParentDir, CurDir, RootDir, Prefix)
    for component in path.components() {
        match component {
            Component::Normal(_) => {}
            _ => {
                return Err(TasukiError::Io(
                    "Invalid filename: path traversal detected".to_string(),
                ))
            }
        }
    }

    // Must be a single filename (no subdirectories)
    if path.components().count() != 1 {
        return Err(TasukiError::Io(
            "Invalid filename: must be a single filename".to_string(),
        ));
    }

    // Only .md extension allowed
    if path.extension().map_or(true, |ext| ext != "md") {
        return Err(TasukiError::Io(
            "Invalid filename: only .md files are allowed".to_string(),
        ));
    }

    Ok(())
}

/// Get repo name from state using git::get_repo_info
fn get_repo_name_from_state(state: &State<AppState>) -> Result<String, TasukiError> {
    let repo_path = state.repo_path.lock().unwrap().clone();
    let info = git::get_repo_info(&repo_path)?;
    Ok(info.repo_name)
}

/// List design documents from ~/.claude/designs/{repo-name}/
#[tauri::command]
pub fn list_design_docs(state: State<AppState>) -> Result<Vec<String>, TasukiError> {
    let repo_name = get_repo_name_from_state(&state)?;

    let home = dirs::home_dir()
        .ok_or_else(|| TasukiError::Io("Cannot determine home directory".to_string()))?;
    let design_dir = home.join(".claude").join("designs").join(&repo_name);

    if !design_dir.exists() {
        return Ok(Vec::new());
    }

    let mut files = Vec::new();
    for entry in fs::read_dir(&design_dir)
        .map_err(|e| TasukiError::Io(format!("Cannot read design dir: {}", e)))?
    {
        let entry = entry.map_err(|e| TasukiError::Io(e.to_string()))?;
        let path = entry.path();
        if path.extension().map_or(false, |ext| ext == "md") {
            if let Some(name) = path.file_name() {
                files.push(name.to_string_lossy().to_string());
            }
        }
    }
    files.sort();
    Ok(files)
}

/// Read a design document from ~/.claude/designs/{repo-name}/{filename}
#[tauri::command]
pub fn read_design_doc(
    state: State<AppState>,
    filename: String,
) -> Result<String, TasukiError> {
    validate_design_doc_filename(&filename)?;

    let repo_name = get_repo_name_from_state(&state)?;

    let home = dirs::home_dir()
        .ok_or_else(|| TasukiError::Io("Cannot determine home directory".to_string()))?;
    let file_path = home
        .join(".claude")
        .join("designs")
        .join(&repo_name)
        .join(&filename);

    // Verify the canonical path is within the design directory
    let design_dir = home.join(".claude").join("designs").join(&repo_name);
    if let (Ok(canonical_file), Ok(canonical_dir)) =
        (file_path.canonicalize(), design_dir.canonicalize())
    {
        if !canonical_file.starts_with(&canonical_dir) {
            return Err(TasukiError::Io(
                "Invalid filename: path outside design directory".to_string(),
            ));
        }
    }

    fs::read_to_string(&file_path)
        .map_err(|e| TasukiError::Io(format!("Cannot read design doc: {}", e)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_design_doc_filename_valid() {
        assert!(validate_design_doc_filename("0001_design.md").is_ok());
        assert!(validate_design_doc_filename("my-design.md").is_ok());
    }

    #[test]
    fn test_validate_design_doc_filename_path_traversal() {
        assert!(validate_design_doc_filename("../secret.md").is_err());
        assert!(validate_design_doc_filename("../../etc/passwd").is_err());
        assert!(validate_design_doc_filename("subdir/file.md").is_err());
    }

    #[test]
    fn test_validate_design_doc_filename_wrong_extension() {
        assert!(validate_design_doc_filename("file.txt").is_err());
        assert!(validate_design_doc_filename("file.rs").is_err());
        assert!(validate_design_doc_filename("file").is_err());
    }

    #[test]
    fn test_validate_design_doc_filename_special() {
        assert!(validate_design_doc_filename(".").is_err());
        assert!(validate_design_doc_filename("..").is_err());
        assert!(validate_design_doc_filename("/etc/passwd").is_err());
    }
}
