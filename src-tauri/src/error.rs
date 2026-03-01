use serde::Serialize;

/// Tasuki application errors
#[derive(Debug, thiserror::Error)]
pub enum TasukiError {
    #[error("Git error: {0}")]
    Git(String),

    #[error("IO error: {0}")]
    Io(String),

    #[error("Watch error: {0}")]
    Watch(String),

    #[error("Invalid argument: {0}")]
    InvalidArgument(String),

    #[error("PTY error: {0}")]
    Pty(String),
}

// Tauri requires errors to be serializable
impl Serialize for TasukiError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(self.to_string().as_str())
    }
}

impl From<git2::Error> for TasukiError {
    fn from(e: git2::Error) -> Self {
        TasukiError::Git(e.message().to_string())
    }
}

impl From<std::io::Error> for TasukiError {
    fn from(e: std::io::Error) -> Self {
        TasukiError::Io(e.to_string())
    }
}

impl From<notify::Error> for TasukiError {
    fn from(e: notify::Error) -> Self {
        TasukiError::Watch(e.to_string())
    }
}
