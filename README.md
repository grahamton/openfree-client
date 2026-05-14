# OpenFree

A Windows dictation app. Press a hotkey to record, release (or press again) to transcribe and inject text into whatever window you're typing in. Runs entirely on your laptop — no server required.

## Hotkeys

| Hotkey                  | Mode                                         |
| ----------------------- | -------------------------------------------- |
| Hold `Ctrl+Shift+Space` | Hold-to-talk — release to transcribe         |
| `Ctrl+Shift+Alt+Space`  | Toggle — press to start, press again to stop |

Use toggle for longer recordings where holding the key is awkward.

## How it works

1. Press hotkey — mic starts recording, pill overlay appears
2. Release / press again — audio is transcribed locally via Whisper
3. Transcribed text is injected at your cursor via clipboard

## Stack

- **Tauri 2.x** — windowing, system tray, global hotkeys
- **Rust** — audio capture (`cpal`), local inference (`whisper-rs`), text injection (`enigo` + `arboard`)
- **React** — transparent pill overlay (recording / sending / error states)
- **whisper.cpp** — local transcription, language auto-detected

Remote server mode is still available as a fallback — configure in Settings.

## Dev setup

### Prerequisites (one-time)

whisper-rs embeds whisper.cpp which needs a C++ build chain:

```powershell
winget install LLVM.LLVM
winget install Kitware.CMake
```

VS Build Tools 2022+ also required (usually installed by the Rust installer).

### Build

```powershell
taskkill /F /IM openfree-client.exe 2>$null
$env:PATH = "C:\Program Files\CMake\bin;C:\Program Files\LLVM\bin;$env:PATH"
$env:LIBCLANG_PATH = "C:\Program Files\LLVM\bin"
npm install
npm run tauri build
```

Then launch the binary directly:

```powershell
Start-Process "C:\dev\openfree\src-tauri\target\release\openfree-client.exe"
```

> **Do not use `npm run tauri dev` to run the app** — the dev server ties the app process to the terminal. The release binary is detached and survives terminal close.

First build compiles whisper.cpp (~5 min). Subsequent builds are ~20s.

## Models

Drop GGML `.bin` files into `%LOCALAPPDATA%\openfree\models\` — they appear automatically in the Settings dropdown.

Download from [huggingface.co/ggerganov/whisper.cpp](https://huggingface.co/ggerganov/whisper.cpp).

Currently installed:

| Model                    | Size   | Latency | Notes                      |
| ------------------------ | ------ | ------- | -------------------------- |
| `ggml-base.en-q5_1.bin`  | 57 MB  | ~1s     | Default — fast, quiet fans |
| `ggml-small.en-q5_1.bin` | 181 MB | ~3s     | Better on jargon/names     |

Changing model requires an app restart.

## Settings

Open from the system tray icon. Configure:

- **Backend** — Local (Whisper on this machine) or Remote (home server)
- **Whisper Model** — dropdown of all `.bin` files in `%LOCALAPPDATA%\openfree\models\`
- **Server URL** — remote server endpoint (remote mode only)
- **Transcription Prompt** — primes Whisper with your vocabulary, names, and acronyms (acts as a custom dictionary)
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
  whisper.rs                LocalWhisper backend (whisper-rs), language auto-detected
  api.rs                    HTTP POST to remote transcription server
  inject.rs                 Clipboard write + Ctrl+V injection
  config.rs                 AppConfig load/save
```
