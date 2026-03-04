use notify::RecursiveMode;
use notify_debouncer_mini::{new_debouncer, DebouncedEventKind};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, Arc};
use std::thread::JoinHandle;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

use crate::error::TasukiError;

/// Handle to a running file watcher. Stops the watcher thread on drop.
pub struct WatcherHandle {
    stop_flag: Arc<AtomicBool>,
    join_handle: Option<JoinHandle<()>>,
}

impl Drop for WatcherHandle {
    fn drop(&mut self) {
        self.stop_flag.store(true, Ordering::Relaxed);
        if let Some(handle) = self.join_handle.take() {
            let _ = handle.join();
        }
    }
}

/// Event emitted when files change
const FILE_CHANGED_EVENT: &str = "files-changed";

/// Paths to always ignore when watching
const IGNORE_PATTERNS: &[&str] = &[
    "node_modules",
    "target",
    "dist",
    "__pycache__",
    ".next",
    ".nuxt",
    ".worktrees",
];

/// .git paths that should trigger refresh (HEAD changes, ref updates)
const GIT_WATCH_PATTERNS: &[&str] = &["HEAD", "refs/"];

fn should_ignore(path: &Path, git_dirs: &[PathBuf]) -> bool {
    let path_str = path.to_string_lossy();

    // Check general ignore patterns
    if IGNORE_PATTERNS.iter().any(|p| path_str.contains(p)) {
        return true;
    }

    // Events from watched git directories (worktree gitdir or commondir)
    for gd in git_dirs {
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

/// Resolve extra git directories to watch for worktree environments.
/// Returns the worktree gitdir and the commondir (main repo's .git/).
fn resolve_worktree_git_dirs(repo_path: &Path) -> Vec<PathBuf> {
    let dot_git = repo_path.join(".git");
    if !dot_git.is_file() {
        return vec![];
    }

    let mut dirs = vec![];

    // Parse gitdir from .git file
    let content = match std::fs::read_to_string(&dot_git) {
        Ok(c) => c,
        Err(_) => return dirs,
    };
    let Some(gitdir_str) = content.strip_prefix("gitdir: ") else {
        return dirs;
    };
    let gitdir_path = PathBuf::from(gitdir_str.trim());
    let gitdir = if gitdir_path.is_absolute() {
        gitdir_path
    } else {
        repo_path.join(gitdir_path)
    };

    // Resolve commondir (main repo's .git/) from the gitdir
    let commondir_file = gitdir.join("commondir");
    if let Ok(rel) = std::fs::read_to_string(&commondir_file) {
        let commondir = gitdir.join(rel.trim());
        if let Ok(canonical) = commondir.canonicalize() {
            dirs.push(canonical);
        }
    }

    dirs.push(gitdir);
    dirs
}

/// Start watching a directory for changes and emit events to the frontend.
/// Returns a `WatcherHandle` that stops the watcher thread when dropped.
pub fn start_watching(
    app_handle: AppHandle,
    watch_path: String,
) -> Result<WatcherHandle, TasukiError> {
    let path = PathBuf::from(&watch_path);
    if !path.exists() {
        return Err(TasukiError::Watch(format!(
            "Path does not exist: {}",
            watch_path
        )));
    }

    let git_dirs = resolve_worktree_git_dirs(&path);

    let (tx, rx) = mpsc::channel();

    let mut debouncer = new_debouncer(Duration::from_millis(500), tx)?;

    debouncer
        .watcher()
        .watch(&path, RecursiveMode::Recursive)?;

    // Also watch worktree git dirs (gitdir + commondir) for HEAD/refs changes
    for gd in &git_dirs {
        if gd.exists() {
            let _ = debouncer.watcher().watch(gd, RecursiveMode::Recursive);
        }
    }

    let stop_flag = Arc::new(AtomicBool::new(false));
    let flag_clone = Arc::clone(&stop_flag);

    let join_handle = std::thread::spawn(move || {
        let _debouncer = debouncer; // ensure debouncer lives until thread exits
        loop {
            if flag_clone.load(Ordering::Relaxed) {
                break;
            }
            match rx.recv_timeout(Duration::from_millis(200)) {
                Ok(Ok(events)) => {
                    let changed_paths: Vec<String> = events
                        .iter()
                        .filter(|e| e.kind == DebouncedEventKind::Any)
                        .filter(|e| !should_ignore(&e.path, &git_dirs))
                        .map(|e| e.path.to_string_lossy().to_string())
                        .collect();

                    if !changed_paths.is_empty() {
                        let _ = app_handle.emit(FILE_CHANGED_EVENT, &changed_paths);
                    }
                }
                Ok(Err(errors)) => {
                    eprintln!("Watch error: {:?}", errors);
                }
                Err(mpsc::RecvTimeoutError::Timeout) => {}
                Err(mpsc::RecvTimeoutError::Disconnected) => {
                    break;
                }
            }
        }
    });

    Ok(WatcherHandle {
        stop_flag,
        join_handle: Some(join_handle),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn watcher_handle_drop_stops_thread() {
        let stop_flag = Arc::new(AtomicBool::new(false));
        let flag_clone = Arc::clone(&stop_flag);

        let join_handle = std::thread::spawn(move || {
            while !flag_clone.load(Ordering::Relaxed) {
                std::thread::sleep(Duration::from_millis(50));
            }
        });

        let handle = WatcherHandle {
            stop_flag,
            join_handle: Some(join_handle),
        };

        // Drop should set stop_flag and join the thread
        drop(handle);

        // If we reach here, the thread was successfully joined (stopped)
    }

    #[test]
    fn watcher_handle_drop_is_safe_when_thread_already_finished() {
        let stop_flag = Arc::new(AtomicBool::new(false));

        let join_handle = std::thread::spawn(|| {
            // Thread exits immediately
        });

        let handle = WatcherHandle {
            stop_flag,
            join_handle: Some(join_handle),
        };

        // Should not panic even if thread already finished before drop
        drop(handle);
    }
}
