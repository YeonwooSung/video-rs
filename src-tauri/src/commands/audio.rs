use tauri::AppHandle;

use crate::models::error::AppError;
use crate::services::ffmpeg::FFmpegService;

/// Extract an audio track from a video file.
///
/// # Arguments
/// * `input_path`  — Source video file
/// * `output_path` — Destination audio file (extension determines container)
/// * `codec`       — Audio codec: `"mp3"`, `"aac"`, `"flac"`, `"pcm_s16le"`, etc.
/// * `bitrate`     — Optional bitrate string, e.g. `"192k"`
/// * `duration_secs` — Total source duration in seconds (used for progress %)
#[tauri::command]
pub async fn extract_audio(
    app: AppHandle,
    input_path: String,
    output_path: String,
    codec: String,
    bitrate: Option<String>,
    duration_secs: Option<f64>,
) -> Result<(), AppError> {
    if input_path.is_empty() || output_path.is_empty() {
        return Err(AppError::InvalidArgument(
            "input_path and output_path must not be empty".into(),
        ));
    }
    FFmpegService::extract_audio(
        &app,
        &input_path,
        &output_path,
        &codec,
        bitrate.as_deref(),
        duration_secs,
    )
    .await
}
