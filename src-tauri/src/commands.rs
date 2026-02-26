use tauri::{AppHandle, State};
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::sync::Mutex;

use crate::error::TasukiError;
use crate::git::{self, CommitInfo, DiffResult, RepoInfo};
use crate::pty::PtyState;
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

/// Validate a design doc filename/path for security
fn validate_design_doc_filename(filename: &str) -> Result<(), TasukiError> {
    let path = Path::new(filename);

    // Must have at least one component
    if path.components().count() == 0 {
        return Err(TasukiError::Io(
            "Invalid filename: empty path".to_string(),
        ));
    }

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

/// Recursively collect .md files under `dir`, storing paths relative to `base`.
fn collect_md_files(base: &Path, dir: &Path, files: &mut Vec<String>) -> Result<(), TasukiError> {
    let entries = fs::read_dir(dir)
        .map_err(|e| TasukiError::Io(format!("Cannot read design dir: {}", e)))?;

    for entry in entries {
        let entry = entry.map_err(|e| TasukiError::Io(e.to_string()))?;
        let path = entry.path();

        if path.is_dir() {
            collect_md_files(base, &path, files)?;
        } else if path.extension().map_or(false, |ext| ext == "md") {
            if let Ok(rel) = path.strip_prefix(base) {
                files.push(rel.to_string_lossy().to_string());
            }
        }
    }

    Ok(())
}

/// List design documents from ~/.claude/designs/{repo-name}/ (recursive)
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
    collect_md_files(&design_dir, &design_dir, &mut files)?;
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

// ---- External Docs ----

/// List markdown files in an arbitrary directory (for viewer mode).
/// The dir_path must be an absolute path.
#[tauri::command]
pub fn list_dir_docs(dir_path: String) -> Result<Vec<String>, TasukiError> {
    let path = PathBuf::from(&dir_path);

    if !path.is_absolute() {
        return Err(TasukiError::Io(
            "dir_path must be an absolute path".to_string(),
        ));
    }
    if !path.is_dir() {
        return Err(TasukiError::Io(format!(
            "Not a directory: {}",
            dir_path
        )));
    }

    let mut files = Vec::new();
    collect_md_files(&path, &path, &mut files)?;
    files.sort();
    Ok(files)
}

/// Read a file by absolute path (for external docs in viewer mode).
/// Only allows reading .md files for security.
#[tauri::command]
pub fn read_external_file(file_path: String) -> Result<String, TasukiError> {
    let path = PathBuf::from(&file_path);

    if !path.is_absolute() {
        return Err(TasukiError::Io(
            "file_path must be an absolute path".to_string(),
        ));
    }

    if path.extension().map_or(true, |ext| ext != "md") {
        return Err(TasukiError::Io(
            "Only .md files can be read".to_string(),
        ));
    }

    fs::read_to_string(&path)
        .map_err(|e| TasukiError::Io(format!("Cannot read file: {}", e)))
}

// ---- Commit Gate ----

/// Build the path for the commit gate file: /tmp/tasuki/{repo}/{branch}/review.json
fn gate_file_path(repo_name: &str, branch_name: &str) -> PathBuf {
    PathBuf::from("/tmp/tasuki")
        .join(repo_name)
        .join(branch_name)
        .join("review.json")
}

/// Get (repo_name, branch_name) from state
fn get_gate_context(state: &State<AppState>) -> Result<(String, String), TasukiError> {
    let repo_path = state.repo_path.lock().unwrap().clone();
    let info = git::get_repo_info(&repo_path)?;
    let branch = info
        .branch_name
        .ok_or_else(|| TasukiError::Git("Not on a branch (detached HEAD)".to_string()))?;
    Ok((info.repo_name, branch))
}

/// Write a commit gate file (approve or reject)
#[tauri::command]
pub fn write_commit_gate(
    state: State<AppState>,
    status: String,
    diff_hash: String,
    resolved_comments: String,
    resolved_doc_comments: String,
) -> Result<(), TasukiError> {
    let (repo_name, branch) = get_gate_context(&state)?;
    let path = gate_file_path(&repo_name, &branch);

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| TasukiError::Io(format!("Cannot create gate dir: {}", e)))?;
    }

    let timestamp = chrono::Utc::now().to_rfc3339();

    let gate_json = format!(
        r#"{{"version":2,"status":"{}","timestamp":"{}","repository":"{}","branch":"{}","diff_hash":"{}","resolved_comments":{},"resolved_doc_comments":{}}}"#,
        status, timestamp, repo_name, branch, diff_hash,
        resolved_comments, resolved_doc_comments
    );

    fs::write(&path, gate_json)
        .map_err(|e| TasukiError::Io(format!("Cannot write gate file: {}", e)))?;

    Ok(())
}

/// Read the current commit gate file. Returns None if it doesn't exist.
#[tauri::command]
pub fn read_commit_gate(state: State<AppState>) -> Result<Option<String>, TasukiError> {
    let (repo_name, branch) = get_gate_context(&state)?;
    let path = gate_file_path(&repo_name, &branch);

    if !path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&path)
        .map_err(|e| TasukiError::Io(format!("Cannot read gate file: {}", e)))?;

    Ok(Some(content))
}

/// Delete the commit gate file
#[tauri::command]
pub fn clear_commit_gate(state: State<AppState>) -> Result<(), TasukiError> {
    let (repo_name, branch) = get_gate_context(&state)?;
    let path = gate_file_path(&repo_name, &branch);

    if path.exists() {
        fs::remove_file(&path)
            .map_err(|e| TasukiError::Io(format!("Cannot remove gate file: {}", e)))?;
    }

    Ok(())
}

/// Open a file or the repository root in Zed editor
#[tauri::command]
pub fn open_in_zed(
    state: State<AppState>,
    file_path: Option<String>,
    line: Option<u32>,
) -> Result<(), TasukiError> {
    let repo_path = state.repo_path.lock().unwrap().clone();

    let target = match (file_path, line) {
        (Some(fp), Some(ln)) => format!("{}:{}", Path::new(&repo_path).join(&fp).display(), ln),
        (Some(fp), None) => Path::new(&repo_path).join(&fp).display().to_string(),
        _ => repo_path,
    };

    std::process::Command::new("zed")
        .arg(&target)
        .spawn()
        .map_err(|e| TasukiError::Io(format!("Failed to launch Zed: {}", e)))?;

    Ok(())
}

/// Spawn a terminal PTY session
#[tauri::command]
pub fn spawn_terminal(
    app: AppHandle,
    state: State<AppState>,
    pty_state: State<PtyState>,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let cwd = state.repo_path.lock().unwrap().clone();
    pty_state.spawn(&app, cols, rows, &cwd)
}

/// Write data to the terminal PTY
#[tauri::command]
pub fn write_terminal(pty_state: State<PtyState>, data: String) -> Result<(), String> {
    pty_state.write(&data)
}

/// Resize the terminal PTY
#[tauri::command]
pub fn resize_terminal(pty_state: State<PtyState>, cols: u16, rows: u16) -> Result<(), String> {
    pty_state.resize(cols, rows)
}

/// Kill the terminal PTY session
#[tauri::command]
pub fn kill_terminal(pty_state: State<PtyState>) -> Result<(), String> {
    pty_state.kill();
    Ok(())
}

/// Check whether a terminal PTY session is currently running
#[tauri::command]
pub fn is_terminal_alive(pty_state: State<PtyState>) -> bool {
    pty_state.is_alive()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_design_doc_filename_valid() {
        assert!(validate_design_doc_filename("0001_design.md").is_ok());
        assert!(validate_design_doc_filename("my-design.md").is_ok());
        assert!(validate_design_doc_filename("subdir/file.md").is_ok());
        assert!(validate_design_doc_filename("a/b/c/deep.md").is_ok());
    }

    #[test]
    fn test_validate_design_doc_filename_path_traversal() {
        assert!(validate_design_doc_filename("../secret.md").is_err());
        assert!(validate_design_doc_filename("../../etc/passwd").is_err());
        assert!(validate_design_doc_filename("sub/../escape.md").is_err());
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
