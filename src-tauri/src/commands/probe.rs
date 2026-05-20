use tauri::AppHandle;

use crate::models::error::AppError;
use crate::models::video_info::VideoInfo;
use crate::services::ffprobe::FFprobeService;

/// Analyze a media file and return codec/fps/stream metadata.
#[tauri::command]
pub async fn analyze_video(
    app: AppHandle,
    file_path: String,
) -> Result<VideoInfo, AppError> {
    if file_path.is_empty() {
        return Err(AppError::InvalidArgument("file_path must not be empty".into()));
    }
    FFprobeService::probe(&app, &file_path).await
}
