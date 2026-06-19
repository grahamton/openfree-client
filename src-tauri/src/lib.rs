mod api;
mod audio;
mod cleanup;
mod config;
mod inject;
mod transcribe;
mod whisper;

use std::path::PathBuf;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut, ShortcutState};
use transcribe::Transcriber;

#[derive(PartialEq, Clone, Copy)]
enum RecordingMode {
    Idle,
    Hold,
    Toggle,
}

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
                rgba[i] = r;
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
        "recording" => dot_icon(239, 68, 68), // red
        "sending" => dot_icon(251, 146, 60),  // amber
        "error" => dot_icon(239, 68, 68),     // red
        _ => dot_icon(156, 163, 175),         // grey (idle)
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
fn list_models() -> Vec<String> {
    let models_dir = dirs::data_local_dir()
        .map(|d| d.join("openfree").join("models"))
        .unwrap_or_default();
    if !models_dir.exists() {
        let _ = std::fs::create_dir_all(&models_dir);
        return vec![];
    }
    let mut models = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&models_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) == Some("bin") {
                if let Some(s) = path.to_str() {
                    models.push(s.to_string());
                }
            }
        }
    }
    models.sort();
    models
}

fn save_wav(path: &std::path::Path, samples: &[f32]) -> Result<(), String> {
    let spec = hound::WavSpec {
        channels: 1,
        sample_rate: 16000,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };
    let mut writer = hound::WavWriter::create(path, spec).map_err(|e| e.to_string())?;
    for &sample in samples {
        let amplitude = (sample * 32767.0).clamp(-32768.0, 32767.0) as i16;
        writer.write_sample(amplitude).map_err(|e| e.to_string())?;
    }
    writer.finalize().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn play_debug_wav() -> Result<(), String> {
    let wav_path = std::env::temp_dir().join("openfree_debug.wav");
    if !wav_path.exists() {
        return Err("No recording found. Record some audio first.".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&wav_path)
            .spawn()
            .map_err(|e| format!("Failed to spawn explorer: {}", e))?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&wav_path)
            .spawn()
            .map_err(|e| format!("Failed to spawn open: {}", e))?;
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        std::process::Command::new("xdg-open")
            .arg(&wav_path)
            .spawn()
            .map_err(|e| format!("Failed to spawn xdg-open: {}", e))?;
    }

    Ok(())
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
    recording_mode: Arc<Mutex<RecordingMode>>,
    config_path: Arc<PathBuf>,
    transcriber: Arc<dyn Transcriber>,
) {
    eprintln!("[openfree] recording started");
    emit_state(&app, "recording");

    let active_recording = match audio::start_recording() {
        Ok(rec) => rec,
        Err(e) => {
            eprintln!("[openfree] record error: {}", e);
            *recording_mode.lock().unwrap() = RecordingMode::Idle;
            emit_state(&app, "error");
            std::thread::sleep(std::time::Duration::from_secs(2));
            emit_state(&app, "idle");
            return;
        }
    };

    let cfg = config::load(&config_path);
    let prompt = if cfg.initial_prompt.is_empty() {
        None
    } else {
        Some(cfg.initial_prompt.as_str())
    };

    // Simple wait loop — no streaming inference on CPU (it holds the
    // Whisper mutex and forces the final pass to wait, adding latency).
    while !stop_signal.load(Ordering::Relaxed) {
        std::thread::sleep(std::time::Duration::from_millis(50));
    }

    // Immediately transition UI: recording (red) → sending (amber).
    emit_state(&app, "sending");

    // Drop CPAL stream to stop recording.
    drop(active_recording.stream);

    let final_samples = {
        let buf = active_recording.buffer.lock().unwrap();
        buf.clone()
    };
    let samples = audio::resample_to_16k(&final_samples, active_recording.source_rate);

    eprintln!(
        "[openfree] recorded {:.2}s audio ({} samples at {}Hz)",
        final_samples.len() as f32 / active_recording.source_rate as f32,
        samples.len(),
        active_recording.source_rate
    );

    // Save debug WAV in the background — doesn't block injection.
    {
        let wav_samples = samples.clone();
        std::thread::spawn(move || {
            let wav_path = std::env::temp_dir().join("openfree_debug.wav");
            if let Err(e) = save_wav(&wav_path, &wav_samples) {
                eprintln!("[openfree] failed to save debug wav: {}", e);
            }
        });
    }

    *recording_mode.lock().unwrap() = RecordingMode::Idle;

    // Single fast transcription pass.
    let t_transcribe = std::time::Instant::now();
    let raw = match transcriber.transcribe(&samples, prompt) {
        Ok(text) => {
            eprintln!("[openfree] transcribe: {:?}", t_transcribe.elapsed());
            text
        }
        Err(e) => {
            eprintln!("[openfree] transcription error: {}", e);
            emit_state(&app, "error");
            std::thread::sleep(std::time::Duration::from_secs(2));
            emit_state(&app, "idle");
            return;
        }
    };

    if !raw.is_empty() {
        eprintln!("[openfree] got text: {:?}", raw);
        let text = if cfg.ai_cleanup_enabled {
            match cleanup::cleanup_text(
                &raw,
                &cfg.ai_backend,
                &cfg.ai_model,
                &cfg.ai_mode,
                &cfg.ai_ollama_url,
                &cfg.ai_lmstudio_url,
                &cfg.openai_api_key,
            ) {
                Ok(cleaned) if !cleaned.is_empty() => {
                    eprintln!("[openfree] cleaned: {:?}", cleaned);
                    cleaned
                }
                Ok(_) => {
                    eprintln!("[openfree] cleanup returned empty, using formatted raw");
                    cleanup::fallback_format(&raw)
                }
                Err(e) => {
                    eprintln!("[openfree] cleanup error (using formatted raw): {}", e);
                    cleanup::fallback_format(&raw)
                }
            }
        } else {
            cleanup::fallback_format(&raw)
        };
        if let Err(e) = inject::inject_text(&text) {
            eprintln!("[openfree] inject error: {}", e);
        }
    } else {
        eprintln!("[openfree] got empty transcript");
    }

    emit_state(&app, "idle");
}

fn build_transcriber(cfg: &config::AppConfig) -> Arc<dyn Transcriber> {
    if cfg.transcription_mode != "remote" {
        if cfg.whisper_model_path.is_empty() {
            eprintln!("[openfree] whisper_model_path not set, falling back to remote");
        } else {
            match whisper::LocalWhisper::new(&cfg.whisper_model_path, &cfg.local_backend) {
                Ok(lw) => {
                    eprintln!(
                        "[openfree] local Whisper model loaded: {}",
                        cfg.whisper_model_path
                    );
                    return Arc::new(lw);
                }
                Err(e) => {
                    eprintln!(
                        "[openfree] failed to load model, falling back to remote: {}",
                        e
                    );
                }
            }
        }
    }
    eprintln!("[openfree] using remote backend: {}", cfg.server_url);
    Arc::new(transcribe::RemoteApi::new(cfg.server_url.clone()))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let recording_mode = Arc::new(Mutex::new(RecordingMode::Idle));
    let stop_signal = Arc::new(AtomicBool::new(false));

    let mode_clone = recording_mode.clone();
    let stop_clone = stop_signal.clone();

    // Ctrl+Shift+Space = hold-to-talk
    let hold_sc = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::Space);
    // Ctrl+Shift+Alt+Space = toggle (press once to start, press again to stop)
    let toggle_sc = Shortcut::new(
        Some(Modifiers::CONTROL | Modifiers::SHIFT | Modifiers::ALT),
        Code::Space,
    );

    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_shortcut(hold_sc)
                .expect("failed to register hold shortcut")
                .with_shortcut(toggle_sc)
                .expect("failed to register toggle shortcut")
                .with_handler(move |app, shortcut, event| {
                    // Detect which shortcut fired by checking for ALT modifier
                    let is_toggle_key = shortcut.mods.contains(Modifiers::ALT);

                    match event.state() {
                        ShortcutState::Pressed => {
                            let mut mode = mode_clone.lock().unwrap();
                            match *mode {
                                RecordingMode::Idle => {
                                    // Start a new recording
                                    *mode = if is_toggle_key {
                                        RecordingMode::Toggle
                                    } else {
                                        RecordingMode::Hold
                                    };
                                    stop_clone.store(false, Ordering::Relaxed);
                                    drop(mode);

                                    let app = app.clone();
                                    let stop = stop_clone.clone();
                                    let mode_ref = mode_clone.clone();
                                    let config_path = app.state::<Arc<PathBuf>>().inner().clone();
                                    let transcriber =
                                        app.state::<Arc<dyn Transcriber>>().inner().clone();
                                    std::thread::spawn(move || {
                                        handle_recording(
                                            app,
                                            stop,
                                            mode_ref,
                                            config_path,
                                            transcriber,
                                        );
                                    });
                                }
                                RecordingMode::Toggle if is_toggle_key => {
                                    // Second press of toggle key = stop
                                    stop_clone.store(true, Ordering::Relaxed);
                                }
                                _ => {
                                    // Ignore: other key pressed while already recording
                                }
                            }
                        }
                        ShortcutState::Released => {
                            let mode = mode_clone.lock().unwrap();
                            if *mode == RecordingMode::Hold {
                                drop(mode);
                                stop_clone.store(true, Ordering::Relaxed);
                            }
                            // Toggle mode: ignore release events
                        }
                    }
                })
                .build(),
        )
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "settings" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_config,
            save_config,
            list_models,
            play_debug_wav
        ])
        .setup(|app| {
            let config_path = Arc::new(
                app.path()
                    .app_config_dir()
                    .expect("no app config dir")
                    .join("config.json"),
            );
            app.manage(config_path.clone());

            // Build and store the transcriber (loads Whisper model once here)
            let cfg = config::load(&config_path);
            if cfg.autostart {
                let _ = app.autolaunch().enable();
            }
            let transcriber = build_transcriber(&cfg);
            app.manage(transcriber);

            // Position overlay window at bottom-center
            if let Some(window) = app.get_webview_window("main") {
                if let Ok(Some(monitor)) = window.current_monitor() {
                    let size = monitor.size();
                    let scale = monitor.scale_factor();
                    let win_w = 400.0_f64;
                    let win_h = 100.0_f64;
                    let x = (size.width as f64 / scale - win_w) / 2.0;
                    let y = size.height as f64 / scale - win_h - 24.0;
                    let _ = window
                        .set_position(tauri::Position::Logical(tauri::LogicalPosition::new(x, y)));
                }
            }

            use tauri::menu::{MenuBuilder, MenuItem};
            use tauri::tray::TrayIconBuilder;

            let settings_item =
                MenuItem::with_id(app, "settings", "Settings...", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit OpenFree", true, None::<&str>)?;
            let menu = MenuBuilder::new(app)
                .items(&[&settings_item, &quit])
                .build()?;

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

