mod commands;
mod models;
mod services;
mod utils;

#[cfg(test)]
mod smoke;

use services::job::JobRegistry;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(JobRegistry::default())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::probe::analyze_video,
            commands::probe::check_environment,
            commands::audio::extract_audio,
            commands::audio::extract_subtitle,
            commands::transcode::transcode_video,
            commands::transcode::mux_video,
            commands::resize::resize_video,
            commands::trim::trim_video,
            commands::concat::concat_videos,
            commands::transform::transform_video,
            commands::frame::export_frame,
            commands::reveal::reveal_path,
            commands::crop::crop_video,
            commands::gif::export_gif,
            commands::speed::change_speed,
            commands::volume::adjust_volume,
            commands::watermark::apply_watermark,
            commands::fade::fade_video,
            commands::job::cancel_job,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
