# OpenFree Client — Claude Guide

Reference spec: `# OpenFree — Client Implementation Plan.md` (project root)

## What this is

A Windows Tauri 2.x desktop app: hold `Ctrl+Shift+Space` → records audio → POSTs to OpenFree server → injects cleaned text into the active window. Lives in the system tray, starts on login.

**Server:** `http://100.120.247.76:8766/transcribe`  
**Hotkey:** `Ctrl+Shift+Space` (hold-to-talk)

## Tech stack

- **Rust backend** (`src-tauri/src/`) — hotkeys, audio, API, injection
- **React frontend** (`src/`) — transparent pill overlay only; no UI logic
- **Tauri 2.x** — windowing, tray, events
- `cpal` — mic capture → WAV  
- `enigo` + `arboard` — clipboard write + Ctrl+V injection  
- `reqwest` — multipart POST to transcription server  
- `tauri-plugin-global-shortcut` — global hotkey (NOT `global-hotkey` crate directly; that crate doesn't integrate with Tauri's event loop on Windows)

## Current implementation status

All tasks from the plan are implemented. Key files:

| File | Purpose |
|------|---------|
| `src-tauri/src/lib.rs` | Main wiring: plugin setup, tray, window positioning |
| `src-tauri/src/audio.rs` | `record_to_file(path, stop_signal)` — holds until `AtomicBool` set |
| `src-tauri/src/api.rs` | `send_audio(path, url)` → `Ok(String)` |
| `src-tauri/src/inject.rs` | `inject_text(text)` — clipboard + Ctrl+V |
| `src/App.tsx` | Listens for `dictation-state` event, renders `<Pill>` |
| `src/components/Pill.tsx` | Pill UI (idle → hidden, recording/sending/error → visible) |
| `src-tauri/tauri.conf.json` | Window: 400×100, transparent, alwaysOnTop, visible=false |

## How to run

```bash
npm run tauri dev
```

**Before restarting:** always kill all `openfree-client.exe` processes first, or the hotkey registration will fail with `HotKey already registered`.

```powershell
Stop-Process -Name openfree-client -Force -ErrorAction SilentlyContinue
```

## Rules

- **Never use `global-hotkey` crate directly** — use `tauri-plugin-global-shortcut` which integrates with Tauri's event loop.
- **Kill old processes before restart** — the global hotkey is system-wide and persists until the process dies.
- **Don't start multiple `npm run tauri dev` instances** — port 1420 conflict.
- The overlay window starts hidden (`visible: false`). It's shown/hidden by `show_overlay`/`hide_overlay` in `lib.rs` on hotkey press/release.
- Audio state flows: `idle → recording → sending → idle` (or `error → idle`). The `dictation-state` Tauri event drives the frontend pill display.
