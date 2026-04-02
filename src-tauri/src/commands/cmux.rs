use crate::error::TasukiError;

/// Send a message to Claude Code via cmux send.
///
/// Returns `true` if the message was sent successfully, `false` if
/// CMUX_SURFACE_ID is not set (non-cmux environment).
#[tauri::command]
pub async fn send_to_claude_code(message: String) -> Result<bool, TasukiError> {
    let surface_id = match std::env::var("CMUX_SURFACE_ID") {
        Ok(id) if !id.is_empty() => id,
        _ => return Ok(false),
    };

    let msg = if message.ends_with('\n') {
        message
    } else {
        format!("{}\n", message)
    };

    tokio::task::spawn_blocking(move || {
        let output = std::process::Command::new("cmux")
            .args(["send", "--surface", &surface_id, &msg])
            .output()
            .map_err(|e| TasukiError::Io(format!("Failed to execute cmux: {}", e)))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(TasukiError::Io(format!("cmux send failed: {}", stderr)));
        }

        Ok(true)
    })
    .await
    .map_err(|e| TasukiError::Io(e.to_string()))?
}

/// Exit the application.
#[tauri::command]
pub async fn exit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn send_to_claude_code_returns_false_when_env_not_set() {
        // Ensure CMUX_SURFACE_ID is not set
        std::env::remove_var("CMUX_SURFACE_ID");
        let result = send_to_claude_code("test message".to_string()).await;
        assert_eq!(result.unwrap(), false);
    }

    #[tokio::test]
    async fn send_to_claude_code_returns_false_when_env_is_empty() {
        std::env::set_var("CMUX_SURFACE_ID", "");
        let result = send_to_claude_code("test message".to_string()).await;
        assert_eq!(result.unwrap(), false);
        std::env::remove_var("CMUX_SURFACE_ID");
    }
}
