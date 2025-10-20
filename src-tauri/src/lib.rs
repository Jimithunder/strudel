mod midibridge;
mod oscbridge;

use tokio::sync::mpsc;
use tokio::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let (async_input_transmitter_midi, async_input_receiver_midi) = mpsc::channel(1);
    let (async_output_transmitter_midi, async_output_receiver_midi) = mpsc::channel(1);
    let (async_input_transmitter_osc, async_input_receiver_osc) = mpsc::channel(1);
    let (async_output_transmitter_osc, async_output_receiver_osc) = mpsc::channel(1);

    tauri::Builder::default()
        .manage(midibridge::AsyncInputTransmit {
            inner: Mutex::new(async_input_transmitter_midi),
        })
        .manage(oscbridge::AsyncInputTransmit {
            inner: Mutex::new(async_input_transmitter_osc),
        })
        .invoke_handler(tauri::generate_handler![
            midibridge::sendmidi,
            oscbridge::sendosc
        ])
        .plugin(
            tauri_plugin_log::Builder::new()
                .target(tauri_plugin_log::Target::new(
                    tauri_plugin_log::TargetKind::Webview,
                ))
                .target(tauri_plugin_log::Target::new(
                    tauri_plugin_log::TargetKind::Stdout,
                ))
                .build(),
        )
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            midibridge::init(
                async_input_receiver_midi,
                async_output_receiver_midi,
                async_output_transmitter_midi,
            );
            oscbridge::init(
                async_input_receiver_osc,
                async_output_receiver_osc,
                async_output_transmitter_osc,
            );
            // if cfg!(debug_assertions) {
            //     app.handle().plugin(
            //         tauri_plugin_log::Builder::default()
            //             .level(log::LevelFilter::Info)
            //             .build(),
            //     )?;
            // }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
