use std::path::Path;
use tauri::State;

use crate::error::TasukiError;
use crate::state::AppState;

/// Open a file or the repository root in Zed editor
#[tauri::command]
pub async fn open_in_zed(
    state: State<'_, AppState>,
    file_path: Option<String>,
    line: Option<u32>,
) -> Result<(), TasukiError> {
    let repo_path = state.repo_path.clone();

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
