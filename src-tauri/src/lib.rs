mod audio;
mod api;
mod inject;
mod config;

use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut, ShortcutState};

const SERVER_URL: &str = "http://100.120.247.76:8766/transcribe";

/// Generate a 22×22 filled circle icon with the given RGB color.
fn dot_icon(r: u8, g: u8, b: u8) -> tauri::image::Image<'static> {
    const SIZE: u32 = 22;
    let mut rgba = vec![0u8; (SIZE * SIZE * 4) as usize];
    let center = SIZE as f32 / 2.0;
    let radius = center - 1.0;
    for y in 0..SIZE {
        for x in 0..SIZE {
            let dx = x as f32 - center;
            let dy = y as f32 - center;
            if (dx * dx + dy * dy).sqrt() <= radius {
                let i = ((y * SIZE + x) * 4) as usize;
                rgba[i]     = r;
                rgba[i + 1] = g;
                rgba[i + 2] = b;
                rgba[i + 3] = 255;
            }
        }
    }
    tauri::image::Image::new_owned(rgba, SIZE, SIZE)
}

fn set_tray_icon(app: &AppHandle, state: &str) {
    let icon = match state {
        "recording" => dot_icon(239, 68, 68),   // red
        "sending"   => dot_icon(251, 146, 60),  // amber
        "error"     => dot_icon(239, 68, 68),   // red
        _           => dot_icon(156, 163, 175), // grey (idle)
    };
    if let Some(tray) = app.tray_by_id("main") {
        let _ = tray.set_icon(Some(icon));
    }
}

fn emit_state(app: &AppHandle, state: &str) {
    let _ = app.emit("dictation-state", state);
    set_tray_icon(app, state);
}

#[tauri::command]
fn get_config(config_path: tauri::State<Arc<PathBuf>>) -> config::AppConfig {
    config::load(&config_path)
}

#[tauri::command]
fn save_config(
    app: AppHandle,
    config_path: tauri::State<Arc<PathBuf>>,
    cfg: config::AppConfig,
) -> Result<(), String> {
    if cfg.autostart {
        let _ = app.autolaunch().enable();
    } else {
        let _ = app.autolaunch().disable();
    }
    config::save(&config_path, &cfg)
}

fn handle_recording(
    app: AppHandle,
    stop_signal: Arc<AtomicBool>,
    is_recording: Arc<Mutex<bool>>,
    config_path: Arc<PathBuf>,
) {
    let tmp_path = PathBuf::from(std::env::temp_dir()).join("openfree_audio.wav");

    eprintln!("[openfree] recording started");
    emit_state(&app, "recording");

    if let Err(e) = audio::record_to_file(&tmp_path, stop_signal) {
        eprintln!("[openfree] record error: {}", e);
        *is_recording.lock().unwrap() = false;
        emit_state(&app, "error");
        std::thread::sleep(std::time::Duration::from_secs(2));
        emit_state(&app, "idle");
        return;
    }

    *is_recording.lock().unwrap() = false;

    let cfg = config::load(&config_path);
    let prompt = if cfg.initial_prompt.is_empty() { None } else { Some(cfg.initial_prompt) };

    eprintln!("[openfree] sending to {}", SERVER_URL);
    emit_state(&app, "sending");

    let rt = tokio::runtime::Runtime::new().unwrap();
    match rt.block_on(api::send_audio(&tmp_path, SERVER_URL, prompt)) {
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
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
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
                                let config_path = app.state::<Arc<PathBuf>>().inner().clone();
                                std::thread::spawn(move || {
                                    handle_recording(app, stop, flag, config_path);
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
        .invoke_handler(tauri::generate_handler![get_config, save_config])
        .setup(|app| {
            // Store config path in app state
            let config_path = Arc::new(
                app.path().app_config_dir()
                    .expect("no app config dir")
                    .join("config.json")
            );
            app.manage(config_path.clone());

            // Apply autostart from saved config
            let cfg = config::load(&config_path);
            if cfg.autostart {
                let _ = app.autolaunch().enable();
            }

            // Position main window at bottom-center of primary monitor
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

            use tauri::menu::{MenuBuilder, MenuItem};
            use tauri::tray::TrayIconBuilder;

            let settings_item = MenuItem::with_id(app, "settings", "Settings...", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit OpenFree", true, None::<&str>)?;
            let menu = MenuBuilder::new(app).items(&[&settings_item, &quit]).build()?;

            TrayIconBuilder::with_id("main")
                .icon(dot_icon(156, 163, 175))
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| {
                    if event.id == "settings" {
                        if let Some(w) = app.get_webview_window("settings") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    } else if event.id == "quit" {
                        app.exit(0);
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
