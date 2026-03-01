use parking_lot::Mutex;

use crate::watcher::WatcherHandle;

/// Application state shared across commands.
///
/// `repo_path` is immutable after startup — no Mutex needed.
/// `watcher_handle` is protected by `parking_lot::Mutex` (no poison risk).
pub struct AppState {
    pub repo_path: String,
    pub watcher_handle: Mutex<Option<WatcherHandle>>,
}
