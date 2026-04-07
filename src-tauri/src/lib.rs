mod audio;
mod api;
mod inject;

use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut, ShortcutState};

const SERVER_URL: &str = "http://100.120.247.76:8766/transcribe";

fn emit_state(app: &AppHandle, state: &str) {
    let _ = app.emit("dictation-state", state);
}

fn show_overlay(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
    }
}

fn hide_overlay(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
}

fn handle_recording(app: AppHandle, stop_signal: Arc<AtomicBool>, is_recording: Arc<Mutex<bool>>) {
    let tmp_path = PathBuf::from(std::env::temp_dir()).join("openfree_audio.wav");

    eprintln!("[openfree] recording started");
    show_overlay(&app);
    emit_state(&app, "recording");

    if let Err(e) = audio::record_to_file(&tmp_path, stop_signal) {
        eprintln!("[openfree] record error: {}", e);
        *is_recording.lock().unwrap() = false;
        emit_state(&app, "error");
        std::thread::sleep(std::time::Duration::from_secs(2));
        emit_state(&app, "idle");
        hide_overlay(&app);
        return;
    }

    // Recording done — release the lock so a new recording can start while we send
    *is_recording.lock().unwrap() = false;

    eprintln!("[openfree] sending to {}", SERVER_URL);
    emit_state(&app, "sending");

    let rt = tokio::runtime::Runtime::new().unwrap();
    match rt.block_on(api::send_audio(&tmp_path, SERVER_URL)) {
        Ok(text) if !text.is_empty() => {
            eprintln!("[openfree] got text: {:?}", text);
            if let Err(e) = inject::inject_text(&text) {
                eprintln!("[openfree] inject error: {}", e);
            }
        }
        Ok(_) => { eprintln!("[openfree] got empty response"); }
        Err(e) => {
            eprintln!("[openfree] API error: {}", e);
            emit_state(&app, "error");
            std::thread::sleep(std::time::Duration::from_secs(2));
        }
    }

    emit_state(&app, "idle");
    hide_overlay(&app);
    let _ = std::fs::remove_file(&tmp_path);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let is_recording = Arc::new(Mutex::new(false));
    let stop_signal = Arc::new(AtomicBool::new(false));

    let is_recording_clone = is_recording.clone();
    let stop_signal_clone = stop_signal.clone();

    let shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::Space);

    tauri::Builder::default()
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_shortcut(shortcut)
                .expect("failed to build shortcut")
                .with_handler(move |app, _shortcut, event| {
                    match event.state() {
                        ShortcutState::Pressed => {
                            let mut recording = is_recording_clone.lock().unwrap();
                            if !*recording {
                                *recording = true;
                                stop_signal_clone.store(false, Ordering::Relaxed);
                                drop(recording);
                                let app = app.clone();
                                let flag = is_recording_clone.clone();
                                let stop = stop_signal_clone.clone();
                                std::thread::spawn(move || {
                                    handle_recording(app, stop, flag);
                                });
                            }
                        }
                        ShortcutState::Released => {
                            stop_signal_clone.store(true, Ordering::Relaxed);
                        }
                    }
                })
                .build(),
        )
        .setup(|app| {
            // Position window at bottom-center of primary monitor
            if let Some(window) = app.get_webview_window("main") {
                if let Ok(Some(monitor)) = window.current_monitor() {
                    let size = monitor.size();
                    let scale = monitor.scale_factor();
                    let win_w = 400.0_f64;
                    let win_h = 100.0_f64;
                    let x = (size.width as f64 / scale - win_w) / 2.0;
                    let y = size.height as f64 / scale - win_h - 24.0;
                    let _ = window.set_position(tauri::Position::Logical(
                        tauri::LogicalPosition::new(x, y),
                    ));
                }
            }

            // System tray with Quit item
            use tauri::menu::{MenuBuilder, MenuItem};
            use tauri::tray::TrayIconBuilder;

            let quit = MenuItem::with_id(app, "quit", "Quit OpenFree", true, None::<&str>)?;
            let menu = MenuBuilder::new(app).items(&[&quit]).build()?;

            let mut tray_builder = TrayIconBuilder::new()
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| {
                    if event.id == "quit" {
                        app.exit(0);
                    }
                });

            if let Some(icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(icon.clone());
            }

            tray_builder.build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
