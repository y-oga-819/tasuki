pub mod cli;
pub mod commands;
pub mod error;
pub mod git;
pub mod pty;
pub mod state;
pub mod watcher;

use parking_lot::Mutex;
use state::AppState;

/// Resolve the git repository root from the current working directory.
/// Falls back to CWD if discovery fails (e.g. not inside a git repo).
fn resolve_repo_root() -> String {
    let cwd = std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
    git::discover_repo_root(&cwd)
        .unwrap_or_else(|_| cwd.to_string_lossy().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let args: Vec<String> = std::env::args().collect();
    let cli_args = cli::parse_cli_args(&args);

    let repo_path = resolve_repo_root();

    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Emit window focus events to the frontend for the
            // "auto-refresh on focus gain" UX pattern.
            use tauri::Manager;
            let main_window = app.get_webview_window("main")
                .expect("main window not found");
            let window_clone = main_window.clone();
            main_window.on_window_event(move |event| {
                use tauri::Emitter;
                if let tauri::WindowEvent::Focused(focused) = event {
                    let _ = window_clone.emit("window-focus-changed", focused);
                }
            });
            Ok(())
        })
        .manage(AppState {
            repo_path,
            watcher_handle: Mutex::new(None),
        })
        .manage(pty::PtyState::new())
        .manage(cli_args)
        .invoke_handler(tauri::generate_handler![
            commands::get_diff,
            commands::get_staged_diff,
            commands::get_working_diff,
            commands::get_ref_diff,
            commands::get_commit_diff,
            commands::get_log,
            commands::list_docs,
            commands::read_file,
            commands::start_watching,
            commands::get_repo_path,
            commands::get_cli_args,
            commands::get_head_sha,
            commands::get_diff_hash,
            commands::save_review,
            commands::load_review,
            commands::get_repo_info,
            commands::list_design_docs,
            commands::read_design_doc,
            commands::list_review_docs,
            commands::read_review_doc,
            commands::write_commit_gate,
            commands::read_commit_gate,
            commands::clear_commit_gate,
            commands::list_dir_docs,
            commands::read_external_file,
            commands::open_in_zed,
            commands::spawn_terminal,
            commands::write_terminal,
            commands::resize_terminal,
            commands::kill_terminal,
            commands::is_terminal_alive,
            commands::check_changes,
            commands::send_to_claude_code,
            commands::exit_app,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Tasuki");
}
