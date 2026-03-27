use serde::Serialize;

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
    /// cmux pane ID for sending review results back to Claude Code
    pub cmux_pane: Option<String>,
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
pub fn parse_cli_args(args: &[String]) -> CliArgs {
    // Skip the binary name (args[0])
    let user_args: Vec<&str> = args.iter().skip(1).map(|s| s.as_str()).collect();

    // Extract --cmux-pane <pane-id> from args before pattern matching
    let mut cmux_pane: Option<String> = None;
    let mut filtered: Vec<&str> = Vec::new();
    let mut skip_next = false;
    for (i, arg) in user_args.iter().enumerate() {
        if skip_next {
            skip_next = false;
            continue;
        }
        if *arg == "--cmux-pane" {
            if let Some(pane_id) = user_args.get(i + 1) {
                cmux_pane = Some(pane_id.to_string());
                skip_next = true;
            }
        } else {
            filtered.push(arg);
        }
    }

    let mut cli = match filtered.as_slice() {
        [] | ["."] => CliArgs {
            mode: "uncommitted".to_string(),
            from_ref: None,
            to_ref: None,
            doc_file: None,
            cmux_pane: None,
        },
        ["staged"] => CliArgs {
            mode: "staged".to_string(),
            from_ref: None,
            to_ref: None,
            doc_file: None,
            cmux_pane: None,
        },
        ["working"] => CliArgs {
            mode: "working".to_string(),
            from_ref: None,
            to_ref: None,
            doc_file: None,
            cmux_pane: None,
        },
        ["docs"] => CliArgs {
            mode: "docs".to_string(),
            from_ref: None,
            to_ref: None,
            doc_file: None,
            cmux_pane: None,
        },
        ["docs", file] => CliArgs {
            mode: "docs".to_string(),
            from_ref: None,
            to_ref: None,
            doc_file: Some(file.to_string()),
            cmux_pane: None,
        },
        ["init"] => CliArgs {
            mode: "init".to_string(),
            from_ref: None,
            to_ref: None,
            doc_file: None,
            cmux_pane: None,
        },
        [from, to] => CliArgs {
            mode: "range".to_string(),
            from_ref: Some(from.to_string()),
            to_ref: Some(to.to_string()),
            doc_file: None,
            cmux_pane: None,
        },
        [commit_ref] => CliArgs {
            mode: "commit".to_string(),
            from_ref: Some(commit_ref.to_string()),
            to_ref: None,
            doc_file: None,
            cmux_pane: None,
        },
        _ => CliArgs {
            mode: "uncommitted".to_string(),
            from_ref: None,
            to_ref: None,
            doc_file: None,
            cmux_pane: None,
        },
    };

    cli.cmux_pane = cmux_pane;
    cli
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

    #[test]
    fn test_parse_cmux_pane() {
        let args = vec![
            "tasuki".to_string(),
            "--cmux-pane".to_string(),
            "0:1.2".to_string(),
        ];
        let cli = parse_cli_args(&args);
        assert_eq!(cli.mode, "uncommitted");
        assert_eq!(cli.cmux_pane.as_deref(), Some("0:1.2"));
    }

    #[test]
    fn test_parse_cmux_pane_with_mode() {
        let args = vec![
            "tasuki".to_string(),
            "--cmux-pane".to_string(),
            "0:1.2".to_string(),
            "staged".to_string(),
        ];
        let cli = parse_cli_args(&args);
        assert_eq!(cli.mode, "staged");
        assert_eq!(cli.cmux_pane.as_deref(), Some("0:1.2"));
    }

    #[test]
    fn test_parse_cmux_pane_after_mode() {
        let args = vec![
            "tasuki".to_string(),
            "staged".to_string(),
            "--cmux-pane".to_string(),
            "my-pane".to_string(),
        ];
        let cli = parse_cli_args(&args);
        assert_eq!(cli.mode, "staged");
        assert_eq!(cli.cmux_pane.as_deref(), Some("my-pane"));
    }

    #[test]
    fn test_parse_no_cmux_pane() {
        let args = vec!["tasuki".to_string()];
        let cli = parse_cli_args(&args);
        assert!(cli.cmux_pane.is_none());
    }
}
