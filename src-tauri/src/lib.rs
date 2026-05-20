mod commands;
mod models;
mod services;
mod utils;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
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
            commands::audio::extract_audio,
            commands::transcode::transcode_video,
            commands::transcode::mux_video,
            commands::resize::resize_video,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
