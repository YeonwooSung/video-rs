use serde::{Deserialize, Serialize};

/// Top-level video container information returned by FFprobe
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoInfo {
    pub format: FormatInfo,
    pub streams: Vec<StreamInfo>,
}

/// Container/format metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FormatInfo {
    pub filename: String,
    pub format_name: String,
    pub format_long_name: String,
    /// Duration in seconds
    pub duration: Option<f64>,
    /// Total bit rate in bps
    pub bit_rate: Option<u64>,
    /// File size in bytes
    pub size: Option<u64>,
}

/// Represents a single A/V stream inside the container
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamInfo {
    pub index: u32,
    pub codec_type: String,
    pub codec_name: String,
    pub codec_long_name: Option<String>,
    // Video-specific fields
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub r_frame_rate: Option<String>,
    pub avg_frame_rate: Option<String>,
    pub pix_fmt: Option<String>,
    // Audio-specific fields
    pub sample_rate: Option<String>,
    pub channels: Option<u32>,
    pub channel_layout: Option<String>,
    pub bit_rate: Option<String>,
    // Duration in seconds (may differ from container)
    pub duration: Option<String>,
}

impl StreamInfo {
    /// Parse r_frame_rate (e.g. "30000/1001") to a floating-point fps value
    pub fn fps(&self) -> Option<f64> {
        let raw = self.r_frame_rate.as_deref()?;
        let mut parts = raw.split('/');
        let num: f64 = parts.next()?.parse().ok()?;
        let den: f64 = parts.next()?.parse().ok()?;
        if den == 0.0 {
            return None;
        }
        Some(num / den)
    }
}
