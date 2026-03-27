use std::process::Command;

use crate::error::TasukiError;

/// Send keystrokes to a cmux pane via `cmux send-keys`.
pub fn send_keys(pane_id: &str, text: &str) -> Result<(), TasukiError> {
    let status = Command::new("cmux")
        .args(["send-keys", "-t", pane_id, text, "Enter"])
        .status()
        .map_err(|e| TasukiError::Io(format!("Failed to run cmux: {}", e)))?;

    if !status.success() {
        return Err(TasukiError::Io(format!(
            "cmux send-keys exited with status: {}",
            status
        )));
    }

    Ok(())
}

/// Write review prompt to a file and send a cmux command to read it.
pub fn send_review(
    pane_id: &str,
    repo_name: &str,
    review_text: &str,
) -> Result<String, TasukiError> {
    let review_dir = std::path::PathBuf::from("/tmp/tasuki").join(repo_name);
    std::fs::create_dir_all(&review_dir)?;

    let review_path = review_dir.join("review-prompt.md");
    std::fs::write(&review_path, review_text)?;

    let prompt = format!(
        "{} のレビューコメントに対応してください",
        review_path.display()
    );
    send_keys(pane_id, &prompt)?;

    Ok(review_path.display().to_string())
}
