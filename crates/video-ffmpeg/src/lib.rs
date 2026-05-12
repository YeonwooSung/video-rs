//! Configurable ffmpeg workflows for encoding and muxing.

use std::path::{Path, PathBuf};
use video_core::{ensure_input_exists, CommandSpec, VideoError};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EncodeRequest {
    pub input: PathBuf,
    pub output: PathBuf,
    pub video_codec: Option<String>,
    pub audio_codec: Option<String>,
    pub extra_args: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MuxRequest {
    pub video_input: PathBuf,
    pub audio_input: PathBuf,
    pub output: PathBuf,
    pub extra_args: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FfmpegCommandBuilder {
    binary: String,
}

impl Default for FfmpegCommandBuilder {
    fn default() -> Self {
        Self::new()
    }
}

impl FfmpegCommandBuilder {
    pub fn new() -> Self {
        Self::with_binary("ffmpeg")
    }

    pub fn with_binary(binary: impl Into<String>) -> Self {
        Self {
            binary: binary.into(),
        }
    }

    pub fn build_encode(&self, request: &EncodeRequest) -> Result<CommandSpec, VideoError> {
        ensure_input_exists(Path::new(&request.input))?;
        let mut args = vec![
            "-y".into(),
            "-i".into(),
            request.input.display().to_string(),
        ];

        if let Some(codec) = &request.video_codec {
            args.push("-c:v".into());
            args.push(codec.clone());
        }

        if let Some(codec) = &request.audio_codec {
            args.push("-c:a".into());
            args.push(codec.clone());
        }

        args.extend(request.extra_args.iter().cloned());
        args.push(request.output.display().to_string());

        Ok(CommandSpec::new(&self.binary, args))
    }

    pub fn build_mux(&self, request: &MuxRequest) -> Result<CommandSpec, VideoError> {
        ensure_input_exists(Path::new(&request.video_input))?;
        ensure_input_exists(Path::new(&request.audio_input))?;

        let mut args = vec![
            "-y".into(),
            "-i".into(),
            request.video_input.display().to_string(),
            "-i".into(),
            request.audio_input.display().to_string(),
            "-c".into(),
            "copy".into(),
        ];
        args.extend(request.extra_args.iter().cloned());
        args.push(request.output.display().to_string());

        Ok(CommandSpec::new(&self.binary, args))
    }
}

#[cfg(test)]
mod tests {
    use super::{EncodeRequest, FfmpegCommandBuilder, MuxRequest};
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_file(name: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!("video-rs-{unique}-{name}"));
        fs::write(&path, b"placeholder").unwrap();
        path
    }

    #[test]
    fn encodes_with_optional_codecs_and_extra_args() {
        let input = temp_file("input.mp4");
        let builder = FfmpegCommandBuilder::with_binary("ffmpeg-bin");
        let command = builder
            .build_encode(&EncodeRequest {
                input,
                output: PathBuf::from("encoded.mp4"),
                video_codec: Some("libx264".into()),
                audio_codec: Some("aac".into()),
                extra_args: vec!["-preset".into(), "fast".into()],
            })
            .unwrap();

        assert_eq!(command.program, "ffmpeg-bin");
        assert_eq!(
            command.args,
            vec![
                "-y",
                "-i",
                command.args[2].as_str(),
                "-c:v",
                "libx264",
                "-c:a",
                "aac",
                "-preset",
                "fast",
                "encoded.mp4",
            ]
        );
    }

    #[test]
    fn muxes_video_and_audio_inputs() {
        let video_input = temp_file("video.mp4");
        let audio_input = temp_file("audio.m4a");
        let builder = FfmpegCommandBuilder::new();
        let command = builder
            .build_mux(&MuxRequest {
                video_input,
                audio_input,
                output: PathBuf::from("muxed.mp4"),
                extra_args: vec!["-shortest".into()],
            })
            .unwrap();

        assert_eq!(command.args[0..2], ["-y", "-i"]);
        assert!(command.args.contains(&"-shortest".to_string()));
        assert_eq!(command.args.last().map(String::as_str), Some("muxed.mp4"));
    }
}
