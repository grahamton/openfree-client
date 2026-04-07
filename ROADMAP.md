# OpenFree Roadmap

Incremental improvements only. The app works — don't break it chasing features.

---

## Server-side

### Tier 1 — Quick wins
- [ ] Add `initial_prompt` to Whisper call with user vocabulary and common acronyms
- [ ] Tune prompt to ensure consistent punctuation and capitalization
- [ ] Pin Whisper model size so cold-start time is predictable
- [ ] Remove Ollama/LLM layer if no longer needed (simplifies the pipeline)

### Tier 2 — Config and reliability
- [ ] Load `initial_prompt` from a config file or env var (so it can be edited without touching code)
- [ ] Return a structured error when Whisper fails (currently returns generic 500)
- [ ] Add a `/health` endpoint so the client can check server status

---

## Client-side

### Tier 1 — Quick wins
- [ ] Start on login (Tauri `tauri-plugin-autostart` — one-liner)
- [ ] Show error state in pill when server is unreachable (currently silently times out)

### Tier 2 — Quality of life
- [ ] Settings window: editable personal dictionary / `initial_prompt` sent with each request
- [ ] Build a proper installer (`.msi`) so the app doesn't require `npm run tauri dev` to run
- [ ] Configurable hotkey (currently hardcoded `Ctrl+Shift+Space`)

### Tier 3 — Nice to have
- [ ] Per-app context: different prompt/vocabulary depending on the active window (Slack, VS Code, email, etc.)
- [ ] Local Whisper fallback if server is unreachable
- [ ] Transcription history (last N injections, accessible from tray)
