//! Audio extraction workflow built around ffmpeg.

use std::path::{Path, PathBuf};
use video_core::{ensure_input_exists, CommandSpec, VideoError};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AudioExtractionRequest {
    pub input: PathBuf,
    pub output: PathBuf,
    pub audio_codec: Option<String>,
    pub extra_args: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AudioExtractionService {
    binary: String,
}

impl Default for AudioExtractionService {
    fn default() -> Self {
        Self::new()
    }
}

impl AudioExtractionService {
    pub fn new() -> Self {
        Self::with_binary("ffmpeg")
    }

    pub fn with_binary(binary: impl Into<String>) -> Self {
        Self {
            binary: binary.into(),
        }
    }

    pub fn command_for(&self, request: &AudioExtractionRequest) -> Result<CommandSpec, VideoError> {
        ensure_input_exists(Path::new(&request.input))?;
        let mut args = vec![
            "-y".into(),
            "-i".into(),
            request.input.display().to_string(),
            "-vn".into(),
        ];

        if let Some(codec) = &request.audio_codec {
            args.push("-acodec".into());
            args.push(codec.clone());
        }

        args.extend(request.extra_args.iter().cloned());
        args.push(request.output.display().to_string());

        Ok(CommandSpec::new(&self.binary, args))
    }
}

#[cfg(test)]
mod tests {
    use super::{AudioExtractionRequest, AudioExtractionService};
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn builds_audio_only_ffmpeg_command() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let input = std::env::temp_dir().join(format!("video-rs-{unique}.mp4"));
        fs::write(&input, b"placeholder").unwrap();

        let service = AudioExtractionService::with_binary("ffmpeg-bin");
        let command = service
            .command_for(&AudioExtractionRequest {
                input,
                output: PathBuf::from("audio.wav"),
                audio_codec: Some("pcm_s16le".into()),
                extra_args: vec!["-ar".into(), "16000".into()],
            })
            .unwrap();

        assert_eq!(command.program, "ffmpeg-bin");
        assert!(command.args.contains(&"-vn".to_string()));
        assert!(command.args.contains(&"pcm_s16le".to_string()));
        assert_eq!(command.args.last().map(String::as_str), Some("audio.wav"));
    }
}
