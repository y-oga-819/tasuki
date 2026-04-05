use std::path::PathBuf;

use serde::Deserialize;
use tauri::{AppHandle, Emitter, State};

use crate::error::TasukiError;
use crate::lsp::{
    CallHierarchyCall, ChangedLines, DocumentSymbol, InspectorProgress, LspState,
    MethodInspection,
};
use crate::state::AppState;

/// Validate that file_path resolves to a location inside the repo root.
fn validate_file_path(file_path: &str, root_path: &str) -> Result<(), TasukiError> {
    let root = PathBuf::from(root_path);
    let full = if file_path.starts_with('/') {
        PathBuf::from(file_path)
    } else {
        root.join(file_path)
    };
    let canonical = full
        .canonicalize()
        .map_err(|_| TasukiError::Lsp(format!("Cannot resolve path: {file_path}")))?;
    let canonical_root = root
        .canonicalize()
        .map_err(|_| TasukiError::Lsp("Cannot resolve repo root".to_string()))?;
    if !canonical.starts_with(&canonical_root) {
        return Err(TasukiError::Lsp(format!(
            "Path traversal denied: {file_path}"
        )));
    }
    Ok(())
}

/// Changed file info passed from frontend (extracted from DiffResult).
#[derive(Debug, Deserialize)]
pub struct ChangedFileInfo {
    pub file_path: String,
    pub added_lines: Vec<u32>,
    pub deleted_lines: Vec<u32>,
}

#[tauri::command]
pub async fn lsp_start(
    lsp: State<'_, LspState>,
    app_state: State<'_, AppState>,
    language_id: String,
) -> Result<(), TasukiError> {
    let root_path = app_state.repo_path.clone();
    lsp.start(&language_id, &root_path)?;
    lsp.initialize().await?;
    Ok(())
}

#[tauri::command]
pub async fn lsp_document_symbols(
    lsp: State<'_, LspState>,
    app_state: State<'_, AppState>,
    file_path: String,
) -> Result<Vec<DocumentSymbol>, TasukiError> {
    validate_file_path(&file_path, &app_state.repo_path)?;
    lsp.document_symbols(&file_path).await
}

#[tauri::command]
pub async fn lsp_hover(
    lsp: State<'_, LspState>,
    app_state: State<'_, AppState>,
    file_path: String,
    line: u32,
    character: u32,
) -> Result<Option<String>, TasukiError> {
    validate_file_path(&file_path, &app_state.repo_path)?;
    lsp.hover(&file_path, line, character).await
}

#[tauri::command]
pub async fn lsp_incoming_calls(
    lsp: State<'_, LspState>,
    app_state: State<'_, AppState>,
    file_path: String,
    line: u32,
    character: u32,
) -> Result<Vec<CallHierarchyCall>, TasukiError> {
    validate_file_path(&file_path, &app_state.repo_path)?;
    lsp.incoming_calls(&file_path, line, character).await
}

#[tauri::command]
pub async fn lsp_outgoing_calls(
    lsp: State<'_, LspState>,
    app_state: State<'_, AppState>,
    file_path: String,
    line: u32,
    character: u32,
) -> Result<Vec<CallHierarchyCall>, TasukiError> {
    validate_file_path(&file_path, &app_state.repo_path)?;
    lsp.outgoing_calls(&file_path, line, character).await
}

#[tauri::command]
pub async fn lsp_analyze_diff(
    lsp: State<'_, LspState>,
    app_state: State<'_, AppState>,
    app_handle: AppHandle,
    changed_files: Vec<ChangedFileInfo>,
) -> Result<Vec<MethodInspection>, TasukiError> {
    let root_path = app_state.repo_path.clone();

    if changed_files.is_empty() {
        return Ok(vec![]);
    }

    // Validate all file paths before processing
    for f in &changed_files {
        validate_file_path(&f.file_path, &root_path)?;
    }

    let file_paths: Vec<String> = changed_files.iter().map(|f| f.file_path.clone()).collect();

    let language = crate::lsp::detect_primary_language(&file_paths);
    if let Some(lang) = &language {
        if !lsp.is_alive() {
            lsp.start(lang, &root_path)?;
            lsp.initialize().await?;
        }
    } else {
        return Ok(vec![]);
    }

    // Convert to internal type
    let changed_map: std::collections::HashMap<String, ChangedLines> = changed_files
        .into_iter()
        .map(|f| {
            (
                f.file_path,
                ChangedLines {
                    added: f.added_lines,
                    deleted: f.deleted_lines,
                },
            )
        })
        .collect();

    let handle = app_handle.clone();
    let result = lsp
        .analyze_diff_from_changed(&changed_map, &root_path, move |done, total| {
            let _ = handle.emit(
                "inspector:progress",
                InspectorProgress { done, total },
            );
        })
        .await?;

    Ok(result)
}

#[tauri::command]
pub async fn lsp_stop(lsp: State<'_, LspState>) -> Result<(), TasukiError> {
    lsp.stop();
    Ok(())
}
