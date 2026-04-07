# OpenFree

A Windows dictation app. Hold `Ctrl+Shift+Space` to record, release to transcribe and inject text into whatever window you're typing in.

## How it works

1. Hold `Ctrl+Shift+Space` — mic starts recording, pill overlay appears
2. Release — audio is sent to the transcription server
3. Transcribed text is injected at your cursor via clipboard

## Stack

- **Tauri 2.x** — windowing, system tray, global hotkey
- **Rust** — audio capture (`cpal`), HTTP (`reqwest`), text injection (`enigo` + `arboard`)
- **React** — transparent pill overlay (recording / sending / error states)
- **Server** — FastAPI + Whisper at `http://100.120.247.76:8766/transcribe`

## Dev setup

```bash
npm install
npm run tauri dev
```

> Before restarting: kill any running instance first or hotkey registration will fail.
> ```powershell
> Stop-Process -Name openfree-client -Force -ErrorAction SilentlyContinue
> ```

## Project structure

```
src/                    React frontend (pill overlay only)
  components/Pill.tsx   Pill UI — idle/recording/sending/error states
src-tauri/src/
  lib.rs                Main wiring: hotkey, tray, window
  audio.rs              Mic capture → WAV file
  api.rs                POST audio to transcription server
  inject.rs             Clipboard write + Ctrl+V injection
```
