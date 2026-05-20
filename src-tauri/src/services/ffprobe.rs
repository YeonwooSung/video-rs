use serde_json::Value;
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;

use crate::models::error::AppError;
use crate::models::video_info::{FormatInfo, StreamInfo, VideoInfo};
use crate::utils::binary::FFPROBE_SIDECAR;

pub struct FFprobeService;

impl FFprobeService {
    /// Probe a media file and return structured metadata.
    pub async fn probe(app: &AppHandle, file_path: &str) -> Result<VideoInfo, AppError> {
        let args = [
            "-v",
            "quiet",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
            file_path,
        ];

        let output = app
            .shell()
            .sidecar(FFPROBE_SIDECAR)
            .map_err(|e| AppError::Sidecar(e.to_string()))?
            .args(args)
            .output()
            .await
            .map_err(|e| AppError::Ffprobe(e.to_string()))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            return Err(AppError::Ffprobe(stderr));
        }

        let json: Value = serde_json::from_slice(&output.stdout)?;
        parse_probe_output(&json)
    }
}

fn parse_probe_output(json: &Value) -> Result<VideoInfo, AppError> {
    let format_obj = json
        .get("format")
        .ok_or_else(|| AppError::Ffprobe("missing 'format' key".to_string()))?;

    let format = FormatInfo {
        filename: format_obj["filename"]
            .as_str()
            .unwrap_or("")
            .to_string(),
        format_name: format_obj["format_name"]
            .as_str()
            .unwrap_or("")
            .to_string(),
        format_long_name: format_obj["format_long_name"]
            .as_str()
            .unwrap_or("")
            .to_string(),
        duration: format_obj["duration"]
            .as_str()
            .and_then(|s| s.parse().ok()),
        bit_rate: format_obj["bit_rate"]
            .as_str()
            .and_then(|s| s.parse().ok()),
        size: format_obj["size"].as_str().and_then(|s| s.parse().ok()),
    };

    let streams = json["streams"]
        .as_array()
        .map(|arr| arr.iter().map(parse_stream).collect())
        .unwrap_or_default();

    Ok(VideoInfo { format, streams })
}

fn parse_stream(v: &Value) -> StreamInfo {
    StreamInfo {
        index: v["index"].as_u64().unwrap_or(0) as u32,
        codec_type: v["codec_type"].as_str().unwrap_or("unknown").to_string(),
        codec_name: v["codec_name"].as_str().unwrap_or("unknown").to_string(),
        codec_long_name: v["codec_long_name"].as_str().map(|s| s.to_string()),
        width: v["width"].as_u64().map(|n| n as u32),
        height: v["height"].as_u64().map(|n| n as u32),
        r_frame_rate: v["r_frame_rate"].as_str().map(|s| s.to_string()),
        avg_frame_rate: v["avg_frame_rate"].as_str().map(|s| s.to_string()),
        pix_fmt: v["pix_fmt"].as_str().map(|s| s.to_string()),
        sample_rate: v["sample_rate"].as_str().map(|s| s.to_string()),
        channels: v["channels"].as_u64().map(|n| n as u32),
        channel_layout: v["channel_layout"].as_str().map(|s| s.to_string()),
        bit_rate: v["bit_rate"].as_str().map(|s| s.to_string()),
        duration: v["duration"].as_str().map(|s| s.to_string()),
    }
}
