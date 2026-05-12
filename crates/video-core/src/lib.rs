//! Shared building blocks for the video-rs workspace.

use std::error::Error;
use std::fmt::{Display, Formatter};
use std::path::Path;
use std::process::Command;

/// Infrastructure-neutral representation of a CLI invocation.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CommandSpec {
    pub program: String,
    pub args: Vec<String>,
}

impl CommandSpec {
    pub fn new(program: impl Into<String>, args: Vec<String>) -> Self {
        Self {
            program: program.into(),
            args,
        }
    }

    pub fn render(&self) -> String {
        let mut parts = vec![self.program.clone()];
        parts.extend(self.args.iter().cloned());
        parts.join(" ")
    }

    pub fn to_command(&self) -> Command {
        let mut command = Command::new(&self.program);
        command.args(&self.args);
        command
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum VideoError {
    MissingInputPath(String),
    InvalidOutput(String),
    CommandFailed { program: String, stderr: String },
    Io(String),
}

impl Display for VideoError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::MissingInputPath(path) => write!(f, "input path does not exist: {path}"),
            Self::InvalidOutput(message) => write!(f, "invalid output: {message}"),
            Self::CommandFailed { program, stderr } => {
                write!(f, "command `{program}` failed: {stderr}")
            }
            Self::Io(message) => write!(f, "io error: {message}"),
        }
    }
}

impl Error for VideoError {}

/// Port used by application services so tests can replace process execution.
pub trait CommandExecutor {
    fn execute(&self, command: &CommandSpec) -> Result<String, VideoError>;
}

#[derive(Debug, Default, Clone, Copy)]
pub struct SystemCommandExecutor;

impl CommandExecutor for SystemCommandExecutor {
    fn execute(&self, command: &CommandSpec) -> Result<String, VideoError> {
        let output = command
            .to_command()
            .output()
            .map_err(|error| VideoError::Io(error.to_string()))?;

        if output.status.success() {
            Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
        } else {
            Err(VideoError::CommandFailed {
                program: command.program.clone(),
                stderr: String::from_utf8_lossy(&output.stderr).trim().to_string(),
            })
        }
    }
}

pub fn ensure_input_exists(path: &Path) -> Result<(), VideoError> {
    if path.exists() {
        Ok(())
    } else {
        Err(VideoError::MissingInputPath(path.display().to_string()))
    }
}

#[cfg(test)]
mod tests {
    use super::CommandSpec;

    #[test]
    fn renders_commands_for_debugging() {
        let command = CommandSpec::new("ffmpeg", vec!["-i".into(), "clip.mp4".into()]);

        assert_eq!(command.render(), "ffmpeg -i clip.mp4");
    }
}
