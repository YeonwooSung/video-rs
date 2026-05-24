use tauri::{AppHandle, Emitter};
use tauri_plugin_shell::ShellExt;

use crate::models::error::AppError;
use crate::utils::binary::FFMPEG_SIDECAR;

// ---------------------------------------------------------------------------
// Progress event payload
// ---------------------------------------------------------------------------

#[derive(Clone, serde::Serialize)]
pub struct ProgressPayload {
    /// 0–100
    pub percent: f64,
    pub message: String,
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/// Builder for constructing ffmpeg argument lists in a readable, chainable
/// manner. Call `.build()` to get the final `Vec<String>` of arguments.
pub struct FFmpegCommandBuilder {
    args: Vec<String>,
}

impl FFmpegCommandBuilder {
    pub fn new() -> Self {
        // Always suppress banner and enable progress output
        Self {
            args: vec!["-y".into(), "-hide_banner".into()],
        }
    }

    pub fn input(mut self, path: &str) -> Self {
        self.args.push("-i".into());
        self.args.push(path.into());
        self
    }

    pub fn video_codec(mut self, codec: &str) -> Self {
        self.args.push("-c:v".into());
        self.args.push(codec.into());
        self
    }

    pub fn audio_codec(mut self, codec: &str) -> Self {
        self.args.push("-c:a".into());
        self.args.push(codec.into());
        self
    }

    pub fn no_video(mut self) -> Self {
        self.args.push("-vn".into());
        self
    }

    pub fn no_audio(mut self) -> Self {
        self.args.push("-an".into());
        self
    }

    pub fn scale(mut self, width: i32, height: i32) -> Self {
        // Use -2 for width/height to preserve aspect ratio when set to -1
        self.args.push("-vf".into());
        self.args
            .push(format!("scale={}:{}", width, height));
        self
    }

    pub fn crf(mut self, crf: u8) -> Self {
        self.args.push("-crf".into());
        self.args.push(crf.to_string());
        self
    }

    pub fn video_bitrate(mut self, bitrate: &str) -> Self {
        self.args.push("-b:v".into());
        self.args.push(bitrate.into());
        self
    }

    pub fn audio_bitrate(mut self, bitrate: &str) -> Self {
        self.args.push("-b:a".into());
        self.args.push(bitrate.into());
        self
    }

    pub fn audio_sample_rate(mut self, rate: u32) -> Self {
        self.args.push("-ar".into());
        self.args.push(rate.to_string());
        self
    }

    pub fn map_all(mut self) -> Self {
        self.args.push("-map".into());
        self.args.push("0".into());
        self
    }

    pub fn copy_all(mut self) -> Self {
        self.args.push("-c".into());
        self.args.push("copy".into());
        self
    }

    pub fn output(mut self, path: &str) -> Self {
        self.args.push(path.into());
        self
    }

    pub fn build(self) -> Vec<String> {
        self.args
    }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

pub struct FFmpegService;

impl FFmpegService {
    /// Run an ffmpeg command built by `FFmpegCommandBuilder`.
    /// Parses stderr for `time=` progress markers and emits `"ffmpeg-progress"`
    /// events to the frontend.
    pub async fn run(
        app: &AppHandle,
        args: Vec<String>,
        total_duration_secs: Option<f64>,
    ) -> Result<(), AppError> {
        use tauri_plugin_shell::process::CommandEvent;

        let (mut rx, _child) = app
            .shell()
            .sidecar(FFMPEG_SIDECAR)
            .map_err(|e| AppError::Sidecar(e.to_string()))?
            .args(&args)
            .spawn()
            .map_err(|e| AppError::Ffmpeg(e.to_string()))?;

        let mut stderr_buf = String::new();

        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stderr(line) => {
                    let text = String::from_utf8_lossy(&line).to_string();
                    stderr_buf.push_str(&text);
                    stderr_buf.push('\n');

                    // Parse progress from "time=HH:MM:SS.mm"
                    if let Some(percent) =
                        parse_progress_percent(&text, total_duration_secs)
                    {
                        let _ = app.emit(
                            "ffmpeg-progress",
                            ProgressPayload {
                                percent,
                                message: text.trim().to_string(),
                            },
                        );
                    }
                }
                CommandEvent::Terminated(status) => {
                    if !status.code.map(|c| c == 0).unwrap_or(false) {
                        return Err(AppError::Ffmpeg(stderr_buf));
                    }
                    break;
                }
                _ => {}
            }
        }

        Ok(())
    }

    // ------------------------------------------------------------------
    // High-level operations
    // ------------------------------------------------------------------

    /// Extract audio track from a video file.
    pub async fn extract_audio(
        app: &AppHandle,
        input: &str,
        output: &str,
        codec: &str,
        bitrate: Option<&str>,
        total_duration_secs: Option<f64>,
    ) -> Result<(), AppError> {
        let mut builder = FFmpegCommandBuilder::new()
            .input(input)
            .no_video()
            .audio_codec(codec);

        if let Some(br) = bitrate {
            builder = builder.audio_bitrate(br);
        }

        let args = builder.output(output).build();
        Self::run(app, args, total_duration_secs).await
    }

    /// Transcode a video to a different codec/container.
    pub async fn transcode(
        app: &AppHandle,
        input: &str,
        output: &str,
        video_codec: &str,
        audio_codec: &str,
        crf: Option<u8>,
        total_duration_secs: Option<f64>,
    ) -> Result<(), AppError> {
        let mut builder = FFmpegCommandBuilder::new()
            .input(input)
            .video_codec(video_codec)
            .audio_codec(audio_codec);

        if let Some(q) = crf {
            builder = builder.crf(q);
        }

        let args = builder.output(output).build();
        Self::run(app, args, total_duration_secs).await
    }

    /// Mux multiple input streams into a single container (stream copy).
    pub async fn mux(
        app: &AppHandle,
        video_input: &str,
        audio_input: &str,
        output: &str,
        total_duration_secs: Option<f64>,
    ) -> Result<(), AppError> {
        // -map 0:v:0  selects the first video stream from input 0
        // -map 1:a:0  selects the first audio stream from input 1
        let args = FFmpegCommandBuilder::new()
            .input(video_input)
            .input(audio_input)
            .output(output)
            .build();

        // Manually inject the explicit stream map before the output
        let mut final_args = args;
        let output_pos = final_args.len() - 1;
        final_args.splice(
            output_pos..output_pos,
            [
                "-map".to_string(), "0:v:0".to_string(),
                "-map".to_string(), "1:a:0".to_string(),
                "-c".to_string(), "copy".to_string(),
            ],
        );

        Self::run(app, final_args, total_duration_secs).await
    }

    /// Resize a video to target dimensions.
    pub async fn resize(
        app: &AppHandle,
        input: &str,
        output: &str,
        width: i32,
        height: i32,
        total_duration_secs: Option<f64>,
    ) -> Result<(), AppError> {
        let args = FFmpegCommandBuilder::new()
            .input(input)
            .scale(width, height)
            .video_codec("libx264")
            .audio_codec("copy")
            .output(output)
            .build();
        Self::run(app, args, total_duration_secs).await
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Parse "time=HH:MM:SS.mm" from an ffmpeg stderr line and convert to a
/// 0–100 percentage given `total_duration_secs`.
fn parse_progress_percent(line: &str, total_secs: Option<f64>) -> Option<f64> {
    let total = total_secs?;
    if total <= 0.0 {
        return None;
    }

    // Find "time=HH:MM:SS.xx"
    let idx = line.find("time=")?;
    let time_str = &line[idx + 5..];
    let end = time_str.find(' ').unwrap_or(time_str.len());
    let time_str = &time_str[..end];

    parse_time_to_secs(time_str).map(|elapsed| (elapsed / total * 100.0).min(100.0))
}

fn parse_time_to_secs(s: &str) -> Option<f64> {
    // Format: HH:MM:SS.ms or HH:MM:SS
    let parts: Vec<&str> = s.splitn(3, ':').collect();
    if parts.len() != 3 {
        return None;
    }
    let h: f64 = parts[0].parse().ok()?;
    let m: f64 = parts[1].parse().ok()?;
    let sec: f64 = parts[2].parse().ok()?;
    Some(h * 3600.0 + m * 60.0 + sec)
}
