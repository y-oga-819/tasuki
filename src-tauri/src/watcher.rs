use notify::RecursiveMode;
use notify_debouncer_mini::{new_debouncer, DebouncedEventKind};
use std::path::PathBuf;
use std::sync::mpsc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

use crate::error::TasukiError;

/// Event emitted when files change
const FILE_CHANGED_EVENT: &str = "files-changed";

/// Paths to ignore when watching
const IGNORE_PATTERNS: &[&str] = &[
    ".git",
    "node_modules",
    "target",
    "dist",
    ".tasuki/reviews",
    "__pycache__",
    ".next",
    ".nuxt",
];

fn should_ignore(path: &PathBuf) -> bool {
    let path_str = path.to_string_lossy();
    IGNORE_PATTERNS
        .iter()
        .any(|pattern| path_str.contains(pattern))
}

/// Start watching a directory for changes and emit events to the frontend
pub fn start_watching(
    app_handle: AppHandle,
    watch_path: String,
) -> Result<(), TasukiError> {
    let path = PathBuf::from(&watch_path);
    if !path.exists() {
        return Err(TasukiError::Watch(format!(
            "Path does not exist: {}",
            watch_path
        )));
    }

    std::thread::spawn(move || {
        let (tx, rx) = mpsc::channel();

        let mut debouncer = new_debouncer(Duration::from_millis(500), tx)
            .expect("Failed to create file watcher");

        debouncer
            .watcher()
            .watch(&path, RecursiveMode::Recursive)
            .expect("Failed to watch path");

        loop {
            match rx.recv() {
                Ok(Ok(events)) => {
                    let changed_paths: Vec<String> = events
                        .iter()
                        .filter(|e| e.kind == DebouncedEventKind::Any)
                        .map(|e| e.path.clone())
                        .filter(|p| !should_ignore(p))
                        .map(|p| p.to_string_lossy().to_string())
                        .collect();

                    if !changed_paths.is_empty() {
                        let _ = app_handle.emit(FILE_CHANGED_EVENT, &changed_paths);
                    }
                }
                Ok(Err(errors)) => {
                    eprintln!("Watch error: {:?}", errors);
                }
                Err(e) => {
                    eprintln!("Watch channel error: {}", e);
                    break;
                }
            }
        }
    });

    Ok(())
}
