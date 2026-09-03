use serde::Deserialize;
use tauri::AppHandle;

use crate::models::error::AppError;
use crate::services::ffmpeg::FFmpegService;
use crate::services::timeline::{
    build_timeline_args, validate, RenderProfile, TimelineProject, TimelineValidation,
};

#[derive(Debug, Deserialize)]
pub struct ExportTimelineOptions {
    pub project: TimelineProject,
    pub output_path: String,
    pub profile: Option<RenderProfile>,
    pub job_id: Option<String>,
}

#[tauri::command(rename_all = "snake_case")]
pub fn validate_timeline(project: TimelineProject) -> Result<TimelineValidation, AppError> {
    validate(&project)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn export_timeline(
    app: AppHandle,
    options: ExportTimelineOptions,
) -> Result<(), AppError> {
    let (args, duration) = prepare_export(&options)?;
    FFmpegService::run(&app, args, Some(duration), options.job_id.as_deref()).await
}

/// Validate options and build ffmpeg args (no spawn). Unit-tested for empty output_path.
fn prepare_export(options: &ExportTimelineOptions) -> Result<(Vec<String>, f64), AppError> {
    if options.output_path.is_empty() {
        return Err(AppError::InvalidArgument(
            "output_path must not be empty".into(),
        ));
    }
    validate(&options.project)?;
    let profile = options
        .profile
        .clone()
        .unwrap_or_else(|| RenderProfile::export(&options.project));
    let args = build_timeline_args(&options.project, &options.output_path, &profile)?;
    let duration = options.project.duration_secs();
    Ok((args, duration))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::timeline::{TimelineClip, TimelineTrack, TrackKind, TIMELINE_VERSION};

    fn sample_project() -> TimelineProject {
        TimelineProject {
            version: TIMELINE_VERSION,
            name: "t".into(),
            fps: 30.0,
            width: 1280,
            height: 720,
            sample_rate: 48000,
            tracks: vec![TimelineTrack {
                id: "v1".into(),
                kind: TrackKind::Video,
                name: "V1".into(),
                muted: false,
                clips: vec![TimelineClip {
                    id: "c1".into(),
                    source_path: "/tmp/a.mp4".into(),
                    source_in: 0.0,
                    source_out: 2.0,
                    timeline_start: 0.0,
                    effects: vec![],
                }],
            }],
        }
    }

    #[test]
    fn export_rejects_empty_output_path() {
        let options = ExportTimelineOptions {
            project: sample_project(),
            output_path: String::new(),
            profile: None,
            job_id: None,
        };
        let err = prepare_export(&options).unwrap_err();
        match err {
            AppError::InvalidArgument(msg) => {
                assert_eq!(msg, "output_path must not be empty");
            }
            other => panic!("expected InvalidArgument, got {other:?}"),
        }
    }

    #[test]
    fn prepare_export_builds_args() {
        let project = sample_project();
        let options = ExportTimelineOptions {
            project: project.clone(),
            output_path: "/tmp/out.mp4".into(),
            profile: None,
            job_id: None,
        };
        let (args, duration) = prepare_export(&options).unwrap();
        assert_eq!(duration, 2.0);
        assert!(args.iter().any(|a| a == "/tmp/out.mp4"));
        assert!(args.iter().any(|a| a == "-filter_complex"));
    }
}
