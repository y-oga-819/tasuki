use std::fs;
use std::path::{Component, Path, PathBuf};
use tauri::State;

use crate::error::TasukiError;
use crate::git;
use crate::state::AppState;

/// List markdown documentation files
#[tauri::command]
pub async fn list_docs(state: State<'_, AppState>) -> Result<Vec<String>, TasukiError> {
    let repo_path = state.repo_path.clone();
    tokio::task::spawn_blocking(move || git::list_doc_files(&repo_path))
        .await
        .map_err(|e| TasukiError::Io(e.to_string()))?
}

/// Read a file's content
#[tauri::command]
pub async fn read_file(
    state: State<'_, AppState>,
    file_path: String,
) -> Result<String, TasukiError> {
    let repo_path = state.repo_path.clone();
    tokio::task::spawn_blocking(move || git::read_file(&repo_path, &file_path))
        .await
        .map_err(|e| TasukiError::Io(e.to_string()))?
}

/// List design documents from ~/.claude/designs/{repo-name}/ (recursive)
#[tauri::command]
pub async fn list_design_docs(state: State<'_, AppState>) -> Result<Vec<String>, TasukiError> {
    list_claude_docs(&state, "designs").await
}

/// Read a design document from ~/.claude/designs/{repo-name}/{filename}
#[tauri::command]
pub async fn read_design_doc(
    state: State<'_, AppState>,
    filename: String,
) -> Result<String, TasukiError> {
    read_claude_doc(&state, "designs", &filename).await
}

/// List review documents from ~/.claude/reviews/{repo-name}/ (recursive)
#[tauri::command]
pub async fn list_review_docs(state: State<'_, AppState>) -> Result<Vec<String>, TasukiError> {
    list_claude_docs(&state, "reviews").await
}

/// Read a review document from ~/.claude/reviews/{repo-name}/{filename}
#[tauri::command]
pub async fn read_review_doc(
    state: State<'_, AppState>,
    filename: String,
) -> Result<String, TasukiError> {
    read_claude_doc(&state, "reviews", &filename).await
}

/// List markdown files in an arbitrary directory (for viewer mode).
/// The dir_path must be an absolute path.
#[tauri::command]
pub async fn list_dir_docs(dir_path: String) -> Result<Vec<String>, TasukiError> {
    tokio::task::spawn_blocking(move || {
        let path = PathBuf::from(&dir_path);

        if !path.is_absolute() {
            return Err(TasukiError::Io(
                "dir_path must be an absolute path".to_string(),
            ));
        }
        if !path.is_dir() {
            return Err(TasukiError::Io(format!("Not a directory: {}", dir_path)));
        }

        let mut files = Vec::new();
        collect_doc_files(&path, &path, &mut files)?;
        files.sort();
        Ok(files)
    })
    .await
    .map_err(|e| TasukiError::Io(e.to_string()))?
}

/// Read a file by absolute path (for external docs in viewer mode).
/// Only allows reading .md files for security.
#[tauri::command]
pub async fn read_external_file(file_path: String) -> Result<String, TasukiError> {
    tokio::task::spawn_blocking(move || {
        let path = PathBuf::from(&file_path);

        if !path.is_absolute() {
            return Err(TasukiError::Io(
                "file_path must be an absolute path".to_string(),
            ));
        }

        if !is_doc_extension(&path) {
            return Err(TasukiError::Io(
                "Only .md and .html files can be read".to_string(),
            ));
        }

        fs::read_to_string(&path)
            .map_err(|e| TasukiError::Io(format!("Cannot read file: {}", e)))
    })
    .await
    .map_err(|e| TasukiError::Io(e.to_string()))?
}

// ---- Helpers ----

/// List markdown files from ~/.claude/{subdir}/{repo-name}/ (recursive)
async fn list_claude_docs(
    state: &State<'_, AppState>,
    subdir: &str,
) -> Result<Vec<String>, TasukiError> {
    let repo_path = state.repo_path.clone();
    let subdir = subdir.to_string();
    tokio::task::spawn_blocking(move || {
        let repo_name = get_repo_name(&repo_path)?;

        let home = dirs::home_dir()
            .ok_or_else(|| TasukiError::Io("Cannot determine home directory".to_string()))?;
        let doc_dir = home.join(".claude").join(&subdir).join(&repo_name);

        if !doc_dir.exists() {
            return Ok(Vec::new());
        }

        let mut files = Vec::new();
        collect_doc_files(&doc_dir, &doc_dir, &mut files)?;
        files.sort();
        Ok(files)
    })
    .await
    .map_err(|e| TasukiError::Io(e.to_string()))?
}

/// Read a markdown file from ~/.claude/{subdir}/{repo-name}/{filename}
async fn read_claude_doc(
    state: &State<'_, AppState>,
    subdir: &str,
    filename: &str,
) -> Result<String, TasukiError> {
    validate_design_doc_filename(filename)?;

    let repo_path = state.repo_path.clone();
    let subdir = subdir.to_string();
    let filename = filename.to_string();
    tokio::task::spawn_blocking(move || {
        let repo_name = get_repo_name(&repo_path)?;

        let home = dirs::home_dir()
            .ok_or_else(|| TasukiError::Io("Cannot determine home directory".to_string()))?;
        let doc_dir = home.join(".claude").join(&subdir).join(&repo_name);
        let file_path = doc_dir.join(&filename);

        // Verify the canonical path is within the target directory
        if let (Ok(canonical_file), Ok(canonical_dir)) =
            (file_path.canonicalize(), doc_dir.canonicalize())
        {
            if !canonical_file.starts_with(&canonical_dir) {
                return Err(TasukiError::Io(
                    format!("Invalid filename: path outside {} directory", subdir),
                ));
            }
        }

        fs::read_to_string(&file_path)
            .map_err(|e| TasukiError::Io(format!("Cannot read {} doc: {}", subdir, e)))
    })
    .await
    .map_err(|e| TasukiError::Io(e.to_string()))?
}

/// Get repo name via git::get_repo_info
fn get_repo_name(repo_path: &str) -> Result<String, TasukiError> {
    let info = git::get_repo_info(repo_path)?;
    Ok(info.repo_name)
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

    if !is_doc_extension(path) {
        return Err(TasukiError::Io(
            "Invalid filename: only .md and .html files are allowed".to_string(),
        ));
    }

    Ok(())
}

fn is_doc_extension(path: &Path) -> bool {
    matches!(
        path.extension().and_then(|e| e.to_str()),
        Some("md") | Some("html")
    )
}

/// Recursively collect .md and .html files under `dir`, storing paths relative to `base`.
fn collect_doc_files(base: &Path, dir: &Path, files: &mut Vec<String>) -> Result<(), TasukiError> {
    let entries = fs::read_dir(dir)
        .map_err(|e| TasukiError::Io(format!("Cannot read design dir: {}", e)))?;

    for entry in entries {
        let entry = entry.map_err(|e| TasukiError::Io(e.to_string()))?;
        let path = entry.path();

        if path.is_dir() {
            collect_doc_files(base, &path, files)?;
        } else if is_doc_extension(&path) {
            if let Ok(rel) = path.strip_prefix(base) {
                files.push(rel.to_string_lossy().to_string());
            }
        }
    }

    Ok(())
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
    fn test_validate_design_doc_filename_html_valid() {
        assert!(validate_design_doc_filename("0007_html-view-mode.html").is_ok());
        assert!(validate_design_doc_filename("design.html").is_ok());
        assert!(validate_design_doc_filename("subdir/file.html").is_ok());
    }

    #[test]
    fn test_collect_doc_files_includes_html() {
        let dir = tempfile::TempDir::new().unwrap();
        let base = dir.path();
        std::fs::write(base.join("readme.md"), "# README").unwrap();
        std::fs::write(base.join("design.html"), "<h1>Design</h1>").unwrap();
        std::fs::write(base.join("notes.txt"), "notes").unwrap();
        std::fs::create_dir(base.join("sub")).unwrap();
        std::fs::write(base.join("sub/nested.html"), "<p>nested</p>").unwrap();

        let mut files = Vec::new();
        collect_doc_files(base, base, &mut files).unwrap();
        files.sort();

        assert!(files.contains(&"readme.md".to_string()));
        assert!(files.contains(&"design.html".to_string()));
        assert!(files.contains(&"sub/nested.html".to_string()));
        assert!(!files.contains(&"notes.txt".to_string()));
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
        assert!(validate_design_doc_filename("file.jsx").is_err());
    }

    #[test]
    fn test_read_external_file_accepts_html() {
        let dir = tempfile::TempDir::new().unwrap();
        let html_path = dir.path().join("design.html");
        std::fs::write(&html_path, "<h1>Hello</h1>").unwrap();

        let rt = tokio::runtime::Runtime::new().unwrap();
        let result = rt.block_on(read_external_file(html_path.to_string_lossy().to_string()));
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "<h1>Hello</h1>");
    }

    #[test]
    fn test_read_external_file_rejects_non_doc() {
        let dir = tempfile::TempDir::new().unwrap();
        let txt_path = dir.path().join("notes.txt");
        std::fs::write(&txt_path, "notes").unwrap();

        let rt = tokio::runtime::Runtime::new().unwrap();
        let result = rt.block_on(read_external_file(txt_path.to_string_lossy().to_string()));
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_design_doc_filename_special() {
        assert!(validate_design_doc_filename(".").is_err());
        assert!(validate_design_doc_filename("..").is_err());
        assert!(validate_design_doc_filename("/etc/passwd").is_err());
    }
}
