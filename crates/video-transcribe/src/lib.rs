//! Transcription workflow adapters for whisper-compatible CLIs.

use std::path::{Path, PathBuf};
use video_core::{ensure_input_exists, CommandSpec, VideoError};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TranscriptionBackend {
    Whisper,
    FasterWhisper,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TranscriptionRequest {
    pub audio_input: PathBuf,
    pub output_directory: PathBuf,
    pub language: Option<String>,
    pub model: Option<String>,
    pub extra_args: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TranscriptionService {
    whisper_binary: String,
    faster_whisper_binary: String,
}

impl Default for TranscriptionService {
    fn default() -> Self {
        Self::new()
    }
}

impl TranscriptionService {
    pub fn new() -> Self {
        Self {
            whisper_binary: "whisper".into(),
            faster_whisper_binary: "faster-whisper".into(),
        }
    }

    pub fn with_binaries(
        whisper_binary: impl Into<String>,
        faster_whisper_binary: impl Into<String>,
    ) -> Self {
        Self {
            whisper_binary: whisper_binary.into(),
            faster_whisper_binary: faster_whisper_binary.into(),
        }
    }

    pub fn expected_output_file(
        &self,
        request: &TranscriptionRequest,
    ) -> Result<PathBuf, VideoError> {
        let stem = request
            .audio_input
            .file_stem()
            .and_then(|value| value.to_str())
            .ok_or_else(|| VideoError::InvalidOutput("audio file name is missing".into()))?;

        Ok(request.output_directory.join(format!("{stem}.txt")))
    }

    pub fn command_for(
        &self,
        backend: TranscriptionBackend,
        request: &TranscriptionRequest,
    ) -> Result<CommandSpec, VideoError> {
        ensure_input_exists(Path::new(&request.audio_input))?;
        let output_directory = request.output_directory.display().to_string();
        let binary = match backend {
            TranscriptionBackend::Whisper => &self.whisper_binary,
            TranscriptionBackend::FasterWhisper => &self.faster_whisper_binary,
        };

        let mut args = vec![
            request.audio_input.display().to_string(),
            "--output_format".into(),
            "txt".into(),
            "--output_dir".into(),
            output_directory,
        ];

        if let Some(language) = &request.language {
            args.push("--language".into());
            args.push(language.clone());
        }

        if let Some(model) = &request.model {
            args.push("--model".into());
            args.push(model.clone());
        }

        args.extend(request.extra_args.iter().cloned());

        Ok(CommandSpec::new(binary, args))
    }
}

#[cfg(test)]
mod tests {
    use super::{TranscriptionBackend, TranscriptionRequest, TranscriptionService};
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_audio_file() -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let input = std::env::temp_dir().join(format!("video-rs-{unique}.wav"));
        fs::write(&input, b"placeholder").unwrap();
        input
    }

    #[test]
    fn builds_whisper_command_and_expected_output() {
        let audio_input = temp_audio_file();
        let service = TranscriptionService::with_binaries("whisper-cli", "faster-whisper-cli");
        let request = TranscriptionRequest {
            audio_input,
            output_directory: PathBuf::from("transcripts"),
            language: Some("en".into()),
            model: Some("base".into()),
            extra_args: vec!["--task".into(), "transcribe".into()],
        };

        let command = service
            .command_for(TranscriptionBackend::Whisper, &request)
            .unwrap();
        let output = service.expected_output_file(&request).unwrap();

        assert_eq!(command.program, "whisper-cli");
        assert!(command.args.contains(&"--language".to_string()));
        assert_eq!(
            output,
            PathBuf::from("transcripts").join(format!(
                "{}.txt",
                request.audio_input.file_stem().unwrap().to_string_lossy()
            ))
        );
    }

    #[test]
    fn supports_faster_whisper_binary_selection() {
        let audio_input = temp_audio_file();
        let service = TranscriptionService::with_binaries("whisper-cli", "faster-whisper-cli");
        let request = TranscriptionRequest {
            audio_input,
            output_directory: PathBuf::from("transcripts"),
            language: None,
            model: None,
            extra_args: Vec::new(),
        };

        let command = service
            .command_for(TranscriptionBackend::FasterWhisper, &request)
            .unwrap();

        assert_eq!(command.program, "faster-whisper-cli");
        assert_eq!(
            command.args[1..5],
            ["--output_format", "txt", "--output_dir", "transcripts"]
        );
    }
}
