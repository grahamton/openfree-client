# OpenFree Client — Claude Guide

## What this is

A Windows Tauri 2.x desktop app: press a hotkey → records audio → transcribes locally via Whisper → injects text into the active window. Lives in the system tray, starts on login.

**Default backend:** Local Whisper (`whisper-rs` in-process)
**Hotkeys:** `Ctrl+Shift+Space` (hold-to-talk), `Ctrl+Shift+Alt+Space` (toggle for long recordings)
**Config:** `%APPDATA%\com.openfree.client\config.json`
**Models:** `%LOCALAPPDATA%\openfree\models\` — drop `.bin` files here, they appear in Settings dropdown automatically

## Tech stack

- **Rust backend** (`src-tauri/src/`) — hotkeys, audio, transcription, injection
- **React frontend** (`src/`) — transparent pill overlay only; no UI logic
- **Tauri 2.x** — windowing, tray, events
- `cpal` — mic capture → `Vec<f32>` at 16 kHz (linear resampled)
- `whisper-rs` — in-process whisper.cpp bindings (model loaded once at startup)
- `enigo` + `arboard` — clipboard write + Ctrl+V injection
- `reqwest` — multipart POST to remote server (remote backend only)
- `tauri-plugin-global-shortcut` — global hotkeys (NOT `global-hotkey` crate directly)
- `dirs` — resolves `%LOCALAPPDATA%` for model directory scanning

## Key files

| File                          | Purpose                                                                               |
| ----------------------------- | ------------------------------------------------------------------------------------- |
| `src-tauri/src/lib.rs`        | Main wiring: hotkeys, tray, window, Transcriber routing                               |
| `src-tauri/src/audio.rs`      | `record_to_samples(stop_signal)` → `Vec<f32>` at 16 kHz                               |
| `src-tauri/src/transcribe.rs` | `Transcriber` trait + `RemoteApi` backend                                             |
| `src-tauri/src/whisper.rs`    | `LocalWhisper` backend wrapping `whisper_rs::WhisperContext` — language auto-detected |
| `src-tauri/src/api.rs`        | `send_audio(path, url)` → `Ok(String)` (remote only)                                  |
| `src-tauri/src/inject.rs`     | `inject_text(text)` — clipboard + Ctrl+V                                              |
| `src-tauri/src/config.rs`     | `AppConfig` with serde defaults — load/save                                           |
| `src/App.tsx`                 | Listens for `dictation-state` event, renders `<Pill>`                                 |
| `src/components/Pill.tsx`     | Pill UI (idle → hidden, recording/sending/error → visible)                            |
| `src/components/Settings.tsx` | Settings window: backend, model dropdown, server URL, prompt, autostart               |
| `src-tauri/tauri.conf.json`   | Window: 400×100, transparent, alwaysOnTop, visible=false                              |

## How to run

**Build prerequisites** (one-time — needed for whisper-rs/whisper.cpp):

```powershell
winget install LLVM.LLVM
winget install Kitware.CMake
```

**Build release binary** (run this after any code change):

```powershell
taskkill /F /IM openfree-client.exe 2>$null
$env:PATH = "C:\Program Files\CMake\bin;C:\Program Files\LLVM\bin;$env:PATH"
$env:LIBCLANG_PATH = "C:\Program Files\LLVM\bin"
npm run tauri build
```

**Launch the built binary:**

```powershell
Start-Process "C:\dev\openfree\src-tauri\target\release\openfree-client.exe"
```

> Do NOT use `npm run tauri dev` to run the app day-to-day — the dev server ties the app lifetime to the terminal. Always use the release binary.

First build compiles whisper.cpp (~5 min). Subsequent builds are ~20s.

## Rules

- **Never use `global-hotkey` crate directly** — use `tauri-plugin-global-shortcut`.
- **Kill old process before rebuild** — the global hotkey is system-wide and persists until the process dies.
- **`WhisperContext` is loaded once in `setup()`** and stored in Tauri state as `Arc<dyn Transcriber>`. Changing model path requires app restart.
- **Settings window uses `hide()`/`show()`** — never `minimize()`/`unminimize()`. The window is hidden on close and shown again from the tray. Using minimize breaks reopen.
- **Language detection is automatic** — `set_language(None)` in `whisper.rs`. Do not hardcode `"en"`.
- **Model scanning:** `list_models` Tauri command scans `%LOCALAPPDATA%\openfree\models\` for `.bin` files. Settings shows a dropdown, not a text input.
- **Audio state flows:** `idle → recording → sending → idle` (or `error → idle`). The `dictation-state` Tauri event drives the frontend pill and tray icon.
- **Toggle vs hold:** `RecordingMode` enum (`Idle/Hold/Toggle`) in a `Mutex` tracks which mode is active. Hold key `Released` only stops recording if mode is `Hold`.
- **Vulkan GPU build:** `cargo build --features gpu` — requires Vulkan SDK. Default is CPU-only.

## Models installed

Both models live in `%LOCALAPPDATA%\openfree\models\`:

| Model                    | Size   | Latency | Use                             |
| ------------------------ | ------ | ------- | ------------------------------- |
| `ggml-base.en-q5_1.bin`  | 57 MB  | ~1s     | Default — fast, quiet fans      |
| `ggml-small.en-q5_1.bin` | 181 MB | ~3s     | Better accuracy on jargon/names |

Switch via Settings dropdown. Change takes effect after app restart.

## Transcription prompt ("dictionary")

The **Transcription Prompt** field in Settings primes Whisper with vocabulary before every transcription. Fill it with names, acronyms, and domain terms to improve accuracy on base model. Stored in `config.json` as `initial_prompt`. This is the replacement for a custom dictionary.
