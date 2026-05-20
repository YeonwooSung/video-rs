use serde::Deserialize;
use tauri::AppHandle;

use crate::models::error::AppError;
use crate::services::ffmpeg::FFmpegService;

#[derive(Debug, Deserialize)]
pub struct TranscodeOptions {
    pub input_path: String,
    pub output_path: String,
    pub video_codec: String,
    pub audio_codec: String,
    /// Constant Rate Factor for quality-based encoding (e.g. 18–28 for H.264)
    pub crf: Option<u8>,
    /// Total source duration in seconds (used for progress %)
    pub duration_secs: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct MuxOptions {
    pub video_input: String,
    pub audio_input: String,
    pub output_path: String,
    pub duration_secs: Option<f64>,
}

/// Transcode a video file to a different codec or container.
#[tauri::command]
pub async fn transcode_video(
    app: AppHandle,
    options: TranscodeOptions,
) -> Result<(), AppError> {
    if options.input_path.is_empty() || options.output_path.is_empty() {
        return Err(AppError::InvalidArgument(
            "input_path and output_path must not be empty".into(),
        ));
    }
    FFmpegService::transcode(
        &app,
        &options.input_path,
        &options.output_path,
        &options.video_codec,
        &options.audio_codec,
        options.crf,
        options.duration_secs,
    )
    .await
}

/// Mux a separate video and audio file into a single container (stream copy).
#[tauri::command]
pub async fn mux_video(
    app: AppHandle,
    options: MuxOptions,
) -> Result<(), AppError> {
    if options.video_input.is_empty()
        || options.audio_input.is_empty()
        || options.output_path.is_empty()
    {
        return Err(AppError::InvalidArgument(
            "video_input, audio_input, and output_path must not be empty".into(),
        ));
    }
    FFmpegService::mux(
        &app,
        &options.video_input,
        &options.audio_input,
        &options.output_path,
        options.duration_secs,
    )
    .await
}
