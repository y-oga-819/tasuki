pub mod commands;
pub mod error;
pub mod git;
pub mod watcher;

use commands::AppState;
use serde::Serialize;
use std::sync::Mutex;

/// Parsed CLI arguments that get passed to the frontend
#[derive(Debug, Clone, Serialize)]
pub struct CliArgs {
    /// The diff mode to use on startup
    pub mode: String,
    /// First ref argument (e.g., branch name, commit ref)
    pub from_ref: Option<String>,
    /// Second ref argument (for range comparisons)
    pub to_ref: Option<String>,
    /// Specific doc file to open
    pub doc_file: Option<String>,
}

/// Parse CLI arguments into a structured form
///
/// Usage:
///   tasuki                    → mode="uncommitted"
///   tasuki .                  → mode="uncommitted"
///   tasuki staged             → mode="staged"
///   tasuki working            → mode="working"
///   tasuki HEAD~3             → mode="commit", from_ref="HEAD~3"
///   tasuki abc1234             → mode="commit", from_ref="abc1234"
///   tasuki feature main       → mode="range", from_ref="feature", to_ref="main"
///   tasuki docs               → mode="docs"
///   tasuki docs file.md       → mode="docs", doc_file="file.md"
///   tasuki init               → mode="init"
fn parse_cli_args(args: &[String]) -> CliArgs {
    // Skip the binary name (args[0])
    let user_args: Vec<&str> = args.iter().skip(1).map(|s| s.as_str()).collect();

    match user_args.as_slice() {
        [] | ["."] => CliArgs {
            mode: "uncommitted".to_string(),
            from_ref: None,
            to_ref: None,
            doc_file: None,
        },
        ["staged"] => CliArgs {
            mode: "staged".to_string(),
            from_ref: None,
            to_ref: None,
            doc_file: None,
        },
        ["working"] => CliArgs {
            mode: "working".to_string(),
            from_ref: None,
            to_ref: None,
            doc_file: None,
        },
        ["docs"] => CliArgs {
            mode: "docs".to_string(),
            from_ref: None,
            to_ref: None,
            doc_file: None,
        },
        ["docs", file] => CliArgs {
            mode: "docs".to_string(),
            from_ref: None,
            to_ref: None,
            doc_file: Some(file.to_string()),
        },
        ["init"] => CliArgs {
            mode: "init".to_string(),
            from_ref: None,
            to_ref: None,
            doc_file: None,
        },
        [from, to] => CliArgs {
            mode: "range".to_string(),
            from_ref: Some(from.to_string()),
            to_ref: Some(to.to_string()),
            doc_file: None,
        },
        [commit_ref] => CliArgs {
            mode: "commit".to_string(),
            from_ref: Some(commit_ref.to_string()),
            to_ref: None,
            doc_file: None,
        },
        _ => CliArgs {
            mode: "uncommitted".to_string(),
            from_ref: None,
            to_ref: None,
            doc_file: None,
        },
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let args: Vec<String> = std::env::args().collect();
    let cli_args = parse_cli_args(&args);

    let repo_path = std::env::current_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| ".".to_string());

    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_shell::init())
        .manage(AppState {
            repo_path: Mutex::new(repo_path),
            watcher_handle: Mutex::new(None),
        })
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running Tasuki");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_no_args() {
        let args = vec!["tasuki".to_string()];
        let cli = parse_cli_args(&args);
        assert_eq!(cli.mode, "uncommitted");
    }

    #[test]
    fn test_parse_dot() {
        let args = vec!["tasuki".to_string(), ".".to_string()];
        let cli = parse_cli_args(&args);
        assert_eq!(cli.mode, "uncommitted");
    }

    #[test]
    fn test_parse_staged() {
        let args = vec!["tasuki".to_string(), "staged".to_string()];
        let cli = parse_cli_args(&args);
        assert_eq!(cli.mode, "staged");
    }

    #[test]
    fn test_parse_working() {
        let args = vec!["tasuki".to_string(), "working".to_string()];
        let cli = parse_cli_args(&args);
        assert_eq!(cli.mode, "working");
    }

    #[test]
    fn test_parse_commit_ref() {
        let args = vec!["tasuki".to_string(), "HEAD~3".to_string()];
        let cli = parse_cli_args(&args);
        assert_eq!(cli.mode, "commit");
        assert_eq!(cli.from_ref.as_deref(), Some("HEAD~3"));
    }

    #[test]
    fn test_parse_range() {
        let args = vec![
            "tasuki".to_string(),
            "feature".to_string(),
            "main".to_string(),
        ];
        let cli = parse_cli_args(&args);
        assert_eq!(cli.mode, "range");
        assert_eq!(cli.from_ref.as_deref(), Some("feature"));
        assert_eq!(cli.to_ref.as_deref(), Some("main"));
    }

    #[test]
    fn test_parse_docs() {
        let args = vec!["tasuki".to_string(), "docs".to_string()];
        let cli = parse_cli_args(&args);
        assert_eq!(cli.mode, "docs");
    }

    #[test]
    fn test_parse_docs_file() {
        let args = vec![
            "tasuki".to_string(),
            "docs".to_string(),
            "architecture.md".to_string(),
        ];
        let cli = parse_cli_args(&args);
        assert_eq!(cli.mode, "docs");
        assert_eq!(cli.doc_file.as_deref(), Some("architecture.md"));
    }
}
