use notify::RecursiveMode;
use notify_debouncer_mini::{new_debouncer, DebouncedEventKind};
use std::path::{Path, PathBuf};
use std::sync::mpsc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

use crate::error::TasukiError;

/// Event emitted when files change
const FILE_CHANGED_EVENT: &str = "files-changed";

/// Paths to always ignore when watching
const IGNORE_PATTERNS: &[&str] = &[
    "node_modules",
    "target",
    "dist",
    ".tasuki/reviews",
    "__pycache__",
    ".next",
    ".nuxt",
];

/// .git paths that should trigger refresh (HEAD changes, ref updates)
const GIT_WATCH_PATTERNS: &[&str] = &["HEAD", "refs/"];

fn should_ignore(path: &Path, git_dir: Option<&Path>) -> bool {
    let path_str = path.to_string_lossy();

    // Check general ignore patterns
    if IGNORE_PATTERNS.iter().any(|p| path_str.contains(p)) {
        return true;
    }

    // Events from the worktree git dir (e.g. .git/worktrees/<name>/)
    if let Some(gd) = git_dir {
        if path.starts_with(gd) {
            let rel = path.strip_prefix(gd).unwrap_or(path);
            let rel_str = rel.to_string_lossy();
            return !GIT_WATCH_PATTERNS.iter().any(|p| rel_str.starts_with(p));
        }
    }

    // For .git paths in the working directory
    if path_str.contains(".git/") || path_str.ends_with(".git") {
        let git_idx = path_str.rfind(".git/").unwrap_or(path_str.len());
        let after_git = &path_str[git_idx + 5..]; // skip ".git/"
        return !GIT_WATCH_PATTERNS.iter().any(|p| after_git.starts_with(p));
    }

    false
}

/// Resolve the actual git directory for worktree environments.
/// If .git is a file (worktree), reads the gitdir path from it.
fn resolve_git_dir(repo_path: &Path) -> Option<PathBuf> {
    let dot_git = repo_path.join(".git");
    if dot_git.is_file() {
        let content = std::fs::read_to_string(&dot_git).ok()?;
        let gitdir = content.strip_prefix("gitdir: ")?.trim();
        let gitdir_path = PathBuf::from(gitdir);
        if gitdir_path.is_absolute() {
            Some(gitdir_path)
        } else {
            Some(repo_path.join(gitdir_path))
        }
    } else {
        None
    }
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

    let git_dir = resolve_git_dir(&path);

    std::thread::spawn(move || {
        let (tx, rx) = mpsc::channel();

        let mut debouncer = new_debouncer(Duration::from_millis(500), tx)
            .expect("Failed to create file watcher");

        debouncer
            .watcher()
            .watch(&path, RecursiveMode::Recursive)
            .expect("Failed to watch path");

        // Also watch the worktree git dir for HEAD/refs changes
        if let Some(ref gd) = git_dir {
            if gd.exists() {
                let _ = debouncer
                    .watcher()
                    .watch(gd, RecursiveMode::Recursive);
            }
        }

        loop {
            match rx.recv() {
                Ok(Ok(events)) => {
                    let changed_paths: Vec<String> = events
                        .iter()
                        .filter(|e| e.kind == DebouncedEventKind::Any)
                        .filter(|e| !should_ignore(&e.path, git_dir.as_deref()))
                        .map(|e| e.path.to_string_lossy().to_string())
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
