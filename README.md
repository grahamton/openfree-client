# OpenFree

A Windows dictation app. Press a hotkey to record, release (or press again) to transcribe and inject text into whatever window you're typing in. Runs entirely on your laptop — no server required.

## Hotkeys

| Hotkey | Mode |
|--------|------|
| Hold `Ctrl+Shift+Space` | Hold-to-talk — release to transcribe |
| `Ctrl+Shift+Alt+Space` | Toggle — press to start, press again to stop |

Use toggle for longer recordings where holding the key is awkward.

## How it works

1. Press hotkey — mic starts recording, pill overlay appears
2. Release / press again — audio is transcribed locally via Whisper
3. Transcribed text is injected at your cursor via clipboard

## Stack

- **Tauri 2.x** — windowing, system tray, global hotkeys
- **Rust** — audio capture (`cpal`), local inference (`whisper-rs`), text injection (`enigo` + `arboard`)
- **React** — transparent pill overlay (recording / sending / error states)
- **whisper.cpp** — local transcription, default model: `ggml-base.en-q5_1.bin`

Remote server mode is still available as a fallback — configure in Settings.

## Dev setup

### Prerequisites (one-time)

whisper-rs embeds whisper.cpp which needs a C++ build chain:

```powershell
winget install LLVM.LLVM
winget install Kitware.CMake
```

VS Build Tools 2022+ also required (usually installed by the Rust installer).

### Run

```powershell
$env:PATH = "C:\Program Files\CMake\bin;C:\Program Files\LLVM\bin;$env:PATH"
$env:LIBCLANG_PATH = "C:\Program Files\LLVM\bin"
npm install
npm run tauri dev
```

> Before restarting: kill any running instance first or hotkey registration will fail.
> ```powershell
> Stop-Process -Name openfree-client -Force -ErrorAction SilentlyContinue
> ```

First build compiles whisper.cpp and takes a few minutes. Subsequent builds are fast.

## Models

Download GGML models from [huggingface.co/ggerganov/whisper.cpp](https://huggingface.co/ggerganov/whisper.cpp).

Recommended for local dictation:

| Model | Size | Speed | Notes |
|-------|------|-------|-------|
| `ggml-base.en-q5_1.bin` | 57 MB | ~1s | Best for short clips |
| `ggml-small.en-q5_1.bin` | 97 MB | ~2-3s | Better on fast/mumbled speech |
| `ggml-medium.en-q5_1.bin` | 515 MB | ~15s | Near-server quality |

Store models in `%LOCALAPPDATA%\openfree\models\` and set the path in Settings.

## Settings

Open from the system tray. Configure:

- **Backend** — Local (Whisper on this machine) or Remote (home server)
- **Model path** — path to a GGML `.bin` file
- **Server URL** — remote server endpoint (remote mode only)
- **Transcription prompt** — primes Whisper with your vocabulary, names, and acronyms
- **Start on login** — autostart via system tray

Changes to backend/model require an app restart.

## Project structure

```
src/                        React frontend (pill overlay only)
  components/Pill.tsx       Pill UI — idle/recording/sending/error states
  components/Settings.tsx   Settings window
src-tauri/src/
  lib.rs                    Main wiring: hotkeys, tray, window, Transcriber routing
  audio.rs                  Mic capture → Vec<f32> at 16 kHz
  transcribe.rs             Transcriber trait + RemoteApi backend
  whisper.rs                LocalWhisper backend (whisper-rs)
  api.rs                    HTTP POST to remote transcription server
  inject.rs                 Clipboard write + Ctrl+V injection
  config.rs                 AppConfig load/save
```
