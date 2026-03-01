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
    let repo_path = state.repo_path.clone();
    tokio::task::spawn_blocking(move || {
        let repo_name = get_repo_name(&repo_path)?;

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
    })
    .await
    .map_err(|e| TasukiError::Io(e.to_string()))?
}

/// Read a design document from ~/.claude/designs/{repo-name}/{filename}
#[tauri::command]
pub async fn read_design_doc(
    state: State<'_, AppState>,
    filename: String,
) -> Result<String, TasukiError> {
    validate_design_doc_filename(&filename)?;

    let repo_path = state.repo_path.clone();
    tokio::task::spawn_blocking(move || {
        let repo_name = get_repo_name(&repo_path)?;

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
    })
    .await
    .map_err(|e| TasukiError::Io(e.to_string()))?
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
        collect_md_files(&path, &path, &mut files)?;
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

        if path.extension().map_or(true, |ext| ext != "md") {
            return Err(TasukiError::Io("Only .md files can be read".to_string()));
        }

        fs::read_to_string(&path)
            .map_err(|e| TasukiError::Io(format!("Cannot read file: {}", e)))
    })
    .await
    .map_err(|e| TasukiError::Io(e.to_string()))?
}

// ---- Helpers ----

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

    // Only .md extension allowed
    if path.extension().map_or(true, |ext| ext != "md") {
        return Err(TasukiError::Io(
            "Invalid filename: only .md files are allowed".to_string(),
        ));
    }

    Ok(())
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
