# OpenFree Client — Claude Guide

## What this is

A Windows Tauri 2.x desktop app: press a hotkey → records audio → transcribes locally via Whisper → injects text into the active window. Lives in the system tray, starts on login.

**Default backend:** Local Whisper (`whisper-rs` in-process)  
**Hotkeys:** `Ctrl+Shift+Space` (hold-to-talk), `Ctrl+Shift+Alt+Space` (toggle for long recordings)  
**Config:** `%APPDATA%\com.openfree.client\config.json`  
**Models:** `%LOCALAPPDATA%\openfree\models\`

## Tech stack

- **Rust backend** (`src-tauri/src/`) — hotkeys, audio, transcription, injection
- **React frontend** (`src/`) — transparent pill overlay only; no UI logic
- **Tauri 2.x** — windowing, tray, events
- `cpal` — mic capture → `Vec<f32>` at 16 kHz (linear resampled)
- `whisper-rs` — in-process whisper.cpp bindings (model loaded once at startup)
- `enigo` + `arboard` — clipboard write + Ctrl+V injection
- `reqwest` — multipart POST to remote server (remote backend only)
- `tauri-plugin-global-shortcut` — global hotkeys (NOT `global-hotkey` crate directly)

## Key files

| File | Purpose |
|------|---------|
| `src-tauri/src/lib.rs` | Main wiring: hotkeys, tray, window, Transcriber routing |
| `src-tauri/src/audio.rs` | `record_to_samples(stop_signal)` → `Vec<f32>` at 16 kHz |
| `src-tauri/src/transcribe.rs` | `Transcriber` trait + `RemoteApi` backend |
| `src-tauri/src/whisper.rs` | `LocalWhisper` backend wrapping `whisper_rs::WhisperContext` |
| `src-tauri/src/api.rs` | `send_audio(path, url)` → `Ok(String)` (remote only) |
| `src-tauri/src/inject.rs` | `inject_text(text)` — clipboard + Ctrl+V |
| `src-tauri/src/config.rs` | `AppConfig` with serde defaults — load/save |
| `src/App.tsx` | Listens for `dictation-state` event, renders `<Pill>` |
| `src/components/Pill.tsx` | Pill UI (idle → hidden, recording/sending/error → visible) |
| `src/components/Settings.tsx` | Settings window: backend, model path, server URL, prompt, autostart |
| `src-tauri/tauri.conf.json` | Window: 400×100, transparent, alwaysOnTop, visible=false |

## How to run

**Build prerequisites** (one-time — needed for whisper-rs/whisper.cpp):

```powershell
winget install LLVM.LLVM
winget install Kitware.CMake
```

**Every dev session** (cmake/LLVM not on PATH by default):

```powershell
Stop-Process -Name openfree-client -Force -ErrorAction SilentlyContinue
$env:PATH = "C:\Program Files\CMake\bin;C:\Program Files\LLVM\bin;$env:PATH"
$env:LIBCLANG_PATH = "C:\Program Files\LLVM\bin"
npm run tauri dev
```

First build compiles whisper.cpp (~5 min). Subsequent builds are fast.

## Rules

- **Never use `global-hotkey` crate directly** — use `tauri-plugin-global-shortcut`.
- **Kill old processes before restart** — the global hotkey is system-wide and persists until the process dies.
- **Don't start multiple `npm run tauri dev` instances** — port 1420 conflict.
- **`WhisperContext` is loaded once in `setup()`** and stored in Tauri state as `Arc<dyn Transcriber>`. Changing model path requires app restart.
- **Audio state flows:** `idle → recording → sending → idle` (or `error → idle`). The `dictation-state` Tauri event drives the frontend pill and tray icon.
- **Toggle vs hold:** `RecordingMode` enum (`Idle/Hold/Toggle`) in a `Mutex` tracks which mode is active. Hold key `Released` only stops recording if mode is `Hold`.
- **Vulkan GPU build:** `cargo build --features gpu` — requires Vulkan SDK. Default is CPU-only.
