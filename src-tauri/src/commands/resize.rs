use tauri::AppHandle;

use crate::models::error::AppError;
use crate::services::ffmpeg::FFmpegService;

/// Resize a video to `width × height`.
///
/// Pass `-1` for either dimension to preserve the aspect ratio.
/// For example, `width=1280, height=-1` scales to 1280px wide keeping
/// the original aspect ratio.
#[tauri::command]
pub async fn resize_video(
    app: AppHandle,
    input_path: String,
    output_path: String,
    width: i32,
    height: i32,
    duration_secs: Option<f64>,
) -> Result<(), AppError> {
    if input_path.is_empty() || output_path.is_empty() {
        return Err(AppError::InvalidArgument(
            "input_path and output_path must not be empty".into(),
        ));
    }
    if width == 0 || height == 0 {
        return Err(AppError::InvalidArgument(
            "width and height must be non-zero (use -1 to preserve aspect ratio)".into(),
        ));
    }
    FFmpegService::resize(&app, &input_path, &output_path, width, height, duration_secs).await
}
