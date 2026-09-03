mod commands;
mod models;
mod services;
mod utils;

#[cfg(test)]
mod smoke;

use commands::license::LicenseState;
use services::job::JobRegistry;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(JobRegistry::default())
        .manage(LicenseState::default())
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
            commands::license::set_license_file,
            commands::license::license_status,
            commands::timeline::validate_timeline,
            commands::timeline::export_timeline,
            commands::timeline::render_timeline_proxy,
            commands::timeline::read_text_file,
            commands::timeline::write_text_file,
            commands::timeline::remove_file,
            commands::download::probe_download,
            commands::download::probe_download_list,
            commands::download::classify_download_url,
            commands::download::parse_download_lines,
            commands::download::download_video,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
