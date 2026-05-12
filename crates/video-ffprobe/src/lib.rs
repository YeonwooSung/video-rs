//! ffprobe-backed codec analysis.

use serde::Deserialize;
use std::path::Path;
use video_core::{ensure_input_exists, CommandExecutor, CommandSpec, VideoError};

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct CodecStream {
    pub index: usize,
    pub codec_name: Option<String>,
    pub codec_type: String,
    pub profile: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub sample_rate: Option<String>,
    pub channels: Option<u32>,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct FormatInfo {
    pub format_name: Option<String>,
    pub duration: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct CodecAnalysis {
    pub streams: Vec<CodecStream>,
    pub format: FormatInfo,
}

pub struct FfprobeCodecAnalyzer<E> {
    executor: E,
    binary: String,
}

impl<E> FfprobeCodecAnalyzer<E>
where
    E: CommandExecutor,
{
    pub fn new(executor: E) -> Self {
        Self::with_binary(executor, "ffprobe")
    }

    pub fn with_binary(executor: E, binary: impl Into<String>) -> Self {
        Self {
            executor,
            binary: binary.into(),
        }
    }

    pub fn command_for(&self, input: impl AsRef<Path>) -> Result<CommandSpec, VideoError> {
        let input = input.as_ref();
        ensure_input_exists(input)?;

        Ok(CommandSpec::new(
            &self.binary,
            vec![
                "-v".into(),
                "error".into(),
                "-print_format".into(),
                "json".into(),
                "-show_format".into(),
                "-show_streams".into(),
                input.display().to_string(),
            ],
        ))
    }

    pub fn analyze(&self, input: impl AsRef<Path>) -> Result<CodecAnalysis, VideoError> {
        let command = self.command_for(input)?;
        let output = self.executor.execute(&command)?;

        serde_json::from_str(&output).map_err(|error| VideoError::InvalidOutput(error.to_string()))
    }
}

#[cfg(test)]
mod tests {
    use super::{CodecAnalysis, FfprobeCodecAnalyzer};
    use std::cell::RefCell;
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};
    use video_core::{CommandExecutor, CommandSpec, VideoError};

    #[derive(Default)]
    struct StubExecutor {
        seen: RefCell<Vec<CommandSpec>>,
    }

    impl CommandExecutor for StubExecutor {
        fn execute(&self, command: &CommandSpec) -> Result<String, VideoError> {
            self.seen.borrow_mut().push(command.clone());
            Ok(r#"{
                "streams":[{"index":0,"codec_name":"h264","codec_type":"video","width":1920,"height":1080,"profile":"High","sample_rate":null,"channels":null}],
                "format":{"format_name":"mov,mp4,m4a,3gp,3g2,mj2","duration":"42.0"}
            }"#
            .to_string())
        }
    }

    fn temp_media_file() -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!("video-rs-{unique}.mp4"));
        fs::write(&path, b"placeholder").unwrap();
        path
    }

    #[test]
    fn builds_ffprobe_json_command() {
        let executor = StubExecutor::default();
        let analyzer = FfprobeCodecAnalyzer::with_binary(executor, "ffprobe-bin");
        let input = temp_media_file();

        let command = analyzer.command_for(&input).unwrap();

        assert_eq!(command.program, "ffprobe-bin");
        assert_eq!(
            command.args,
            vec![
                "-v",
                "error",
                "-print_format",
                "json",
                "-show_format",
                "-show_streams",
                input.to_string_lossy().as_ref(),
            ]
        );
    }

    #[test]
    fn parses_codec_analysis_output() {
        let executor = StubExecutor::default();
        let analyzer = FfprobeCodecAnalyzer::new(executor);
        let input = temp_media_file();

        let analysis: CodecAnalysis = analyzer.analyze(&input).unwrap();

        assert_eq!(analysis.streams.len(), 1);
        assert_eq!(analysis.streams[0].codec_name.as_deref(), Some("h264"));
        assert_eq!(analysis.format.duration.as_deref(), Some("42.0"));
    }
}
