use serde::Deserialize;
use tauri::{AppHandle, Emitter, State};

use crate::error::TasukiError;
use crate::lsp::{
    CallHierarchyCall, ChangedLines, DocumentSymbol, InspectorProgress, LspState,
    MethodInspection,
};
use crate::state::AppState;

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
    file_path: String,
) -> Result<Vec<DocumentSymbol>, TasukiError> {
    lsp.document_symbols(&file_path).await
}

#[tauri::command]
pub async fn lsp_hover(
    lsp: State<'_, LspState>,
    file_path: String,
    line: u32,
    character: u32,
) -> Result<Option<String>, TasukiError> {
    lsp.hover(&file_path, line, character).await
}

#[tauri::command]
pub async fn lsp_incoming_calls(
    lsp: State<'_, LspState>,
    file_path: String,
    line: u32,
    character: u32,
) -> Result<Vec<CallHierarchyCall>, TasukiError> {
    lsp.incoming_calls(&file_path, line, character).await
}

#[tauri::command]
pub async fn lsp_outgoing_calls(
    lsp: State<'_, LspState>,
    file_path: String,
    line: u32,
    character: u32,
) -> Result<Vec<CallHierarchyCall>, TasukiError> {
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

    let total = file_paths.len();
    let _ = app_handle.emit(
        "inspector:progress",
        InspectorProgress { done: 0, total },
    );

    let result = lsp.analyze_diff_from_changed(&changed_map, &root_path).await?;

    let _ = app_handle.emit(
        "inspector:progress",
        InspectorProgress { done: total, total },
    );

    Ok(result)
}

#[tauri::command]
pub async fn lsp_stop(lsp: State<'_, LspState>) -> Result<(), TasukiError> {
    lsp.stop();
    Ok(())
}
