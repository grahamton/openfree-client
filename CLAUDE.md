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
| `src-tauri/src/lib.rs`        | Main wiring: hotkeys, tray, window, streaming loop, WAV debug, Transcriber routing    |
| `src-tauri/src/audio.rs`      | `start_recording()` → `ActiveRecording` with shared buffer; `resample_to_16k()`       |
| `src-tauri/src/transcribe.rs` | `Transcriber` trait + `RemoteApi` backend                                             |
| `src-tauri/src/whisper.rs`    | `LocalWhisper` backend wrapping `whisper_rs::WhisperContext` — language auto-detected |
| `src-tauri/src/api.rs`        | `send_audio(path, url)` → `Ok(String)` (remote only)                                  |
| `src-tauri/src/inject.rs`     | `inject_text(text)` — clipboard + Ctrl+V                                              |
| `src-tauri/src/config.rs`     | `AppConfig` with serde defaults — load/save; includes `local_backend` field            |
| `src/App.tsx`                 | Listens for `dictation-state` + `dictation-preview` events, renders `<Pill>`          |
| `src/components/Pill.tsx`     | Pill overlay — shows live preview text during recording, status during send/error      |
| `src/components/Settings.tsx` | Settings: backend, model, GPU accel, server URL, prompt, autostart, debug playback    |
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

**Build with CUDA GPU support** (RTX 5060, CUDA 13.2):

```powershell
taskkill /F /IM openfree-client.exe 2>$null

# Source MSVC environment
$vcvars = cmd /c "`"C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\VC\Auxiliary\Build\vcvarsall.bat`" x64 2>&1 && set" 2>&1
$vcvars | Where-Object { $_ -match "^([^=]+)=(.+)$" } | ForEach-Object { if ($_ -match "^([^=]+)=(.+)$") { [System.Environment]::SetEnvironmentVariable($Matches[1], $Matches[2], "Process") } }

# Set CUDA/build vars (must come AFTER vcvarsall import)
$env:CUDA_PATH = "C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v13.2"
$env:LIBCLANG_PATH = "C:\Program Files\LLVM\bin"
$env:CMAKE_GENERATOR = "Ninja"
$env:PATH = "C:\Program Files\CMake\bin;C:\Program Files\LLVM\bin;C:\Users\graha\AppData\Local\Microsoft\WinGet\Links;$env:CUDA_PATH\bin;$env:PATH"

Set-Location c:\dev\openfree\src-tauri
cargo build --release --features gpu
```

**Build with Vulkan GPU support** (cross-platform — no CUDA SDK needed):

```powershell
taskkill /F /IM openfree-client.exe 2>$null
$env:PATH = "C:\Program Files\CMake\bin;C:\Program Files\LLVM\bin;$env:PATH"
$env:LIBCLANG_PATH = "C:\Program Files\LLVM\bin"
Set-Location c:\dev\openfree\src-tauri
cargo build --release --features vulkan
```

> **Vulkan SDK:** Install the [Vulkan SDK](https://vulkan.lunarg.com/) if `whisper-rs-sys` can't find Vulkan headers. Most modern GPU drivers already include the Vulkan runtime.

> **Why CUDA is complex:** CMake 4.3 auto-selects "Visual Studio 18 2026" generator, which nvcc 13.2 rejects due to a stale `CMAKE_GENERATOR_INSTANCE` in cache. The fix is: (1) use Ninja generator instead, (2) source vcvarsall.bat so cl.exe is in PATH, (3) delete stale cache dirs if you switch generators mid-session: `Remove-Item "target\release\build\whisper-rs-sys-*" -Recurse -Force`.

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
- **GPU builds:** `cargo build --release --features gpu` (CUDA) or `--features vulkan` (Vulkan) from `src-tauri/`. Default is CPU-only. The `local_backend` config field controls runtime GPU usage (`"cpu"`, `"cuda"`, or `"vulkan"`).
- **Streaming transcription:** During recording, audio is transcribed in ~500ms chunk snapshots. Partial results are emitted via `dictation-preview` Tauri event. Final full-pass transcription runs after stop.
- **Debug WAV:** Every recording is saved to `%TEMP%\openfree_debug.wav` (single file, always overwritten). Playable from the Settings "Play Last Recording" button via `play_debug_wav` Tauri command.

## Models installed

Both models live in `%LOCALAPPDATA%\openfree\models\`:

| Model                    | Size   | Latency | Use                             |
| ------------------------ | ------ | ------- | ------------------------------- |
| `ggml-base.en-q5_1.bin`  | 57 MB  | ~1s     | Default — fast, quiet fans      |
| `ggml-small.en-q5_1.bin` | 181 MB | ~3s     | Better accuracy on jargon/names |

Switch via Settings dropdown. Change takes effect after app restart.

## Transcription prompt ("dictionary")

The **Transcription Prompt** field in Settings primes Whisper with vocabulary before every transcription. Fill it with names, acronyms, and domain terms to improve accuracy on base model. Stored in `config.json` as `initial_prompt`. This is the replacement for a custom dictionary.
