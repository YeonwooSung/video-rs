use tauri::AppHandle;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;
use tauri::async_runtime::Receiver;

use crate::models::error::AppError;
use crate::utils::binary::{
    system_ffmpeg_name, system_ffprobe_name, FFMPEG_SIDECAR, FFPROBE_SIDECAR,
};

pub struct SpawnedSidecar {
    pub rx: Receiver<CommandEvent>,
    pub child: CommandChild,
    pub source: String,
}

/// Try the bundled sidecar first, then fall back to a system binary on PATH.
/// This is how Windows/Linux machines without a bundled triple-named binary still work.
pub fn spawn_ffmpeg(app: &AppHandle, args: &[String]) -> Result<SpawnedSidecar, AppError> {
    spawn_tool(
        app,
        FFMPEG_SIDECAR,
        system_ffmpeg_name(),
        args,
        "FFmpeg",
    )
}

fn spawn_tool(
    app: &AppHandle,
    sidecar: &str,
    system_name: &str,
    args: &[String],
    label: &str,
) -> Result<SpawnedSidecar, AppError> {
    match app.shell().sidecar(sidecar) {
        Ok(cmd) => match cmd.args(args).spawn() {
            Ok((rx, child)) => {
                return Ok(SpawnedSidecar {
                    rx,
                    child,
                    source: format!("sidecar:{sidecar}"),
                });
            }
            Err(e) => {
                log::warn!("{label} sidecar spawn failed ({e}); trying system PATH");
            }
        },
        Err(e) => {
            log::warn!("{label} sidecar unavailable ({e}); trying system PATH");
        }
    }

    let (rx, child) = app
        .shell()
        .command(system_name)
        .args(args)
        .spawn()
        .map_err(|e| {
            AppError::Sidecar(format!(
                "{label} sidecar and system `{system_name}` both failed: {e}"
            ))
        })?;

    Ok(SpawnedSidecar {
        rx,
        child,
        source: format!("path:{system_name}"),
    })
}

/// Run a short-lived tool and capture stdout+stderr. Tries sidecar then PATH.
pub async fn output_ffmpeg(app: &AppHandle, args: &[&str]) -> Result<(bool, String, String), AppError> {
    output_tool(app, FFMPEG_SIDECAR, system_ffmpeg_name(), args, "FFmpeg").await
}

pub async fn output_ffprobe(
    app: &AppHandle,
    args: &[&str],
) -> Result<(bool, String, String), AppError> {
    output_tool(app, FFPROBE_SIDECAR, system_ffprobe_name(), args, "FFprobe").await
}

async fn output_tool(
    app: &AppHandle,
    sidecar: &str,
    system_name: &str,
    args: &[&str],
    label: &str,
) -> Result<(bool, String, String), AppError> {
    if let Ok(cmd) = app.shell().sidecar(sidecar) {
        match cmd.args(args).output().await {
            Ok(out) => {
                let stdout = String::from_utf8_lossy(&out.stdout).to_string();
                return Ok((out.status.success(), stdout, format!("sidecar:{sidecar}")));
            }
            Err(e) => {
                log::warn!("{label} sidecar output failed ({e}); trying system PATH");
            }
        }
    }

    let out = app
        .shell()
        .command(system_name)
        .args(args)
        .output()
        .await
        .map_err(|e| {
            AppError::Sidecar(format!(
                "{label} sidecar and system `{system_name}` both failed: {e}"
            ))
        })?;
    let stdout = String::from_utf8_lossy(&out.stdout).to_string();
    Ok((
        out.status.success(),
        stdout,
        format!("path:{system_name}"),
    ))
}
