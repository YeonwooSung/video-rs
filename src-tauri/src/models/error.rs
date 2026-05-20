use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("FFmpeg error: {0}")]
    Ffmpeg(String),

    #[error("FFprobe error: {0}")]
    Ffprobe(String),

    #[error("File not found: {0}")]
    FileNotFound(String),

    #[error("Invalid argument: {0}")]
    InvalidArgument(String),

    #[error("JSON parse error: {0}")]
    Parse(#[from] serde_json::Error),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Sidecar error: {0}")]
    Sidecar(String),
}

/// Implement Serialize so AppError can be returned via Tauri IPC
impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}
