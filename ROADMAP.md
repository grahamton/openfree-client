# OpenFree Roadmap

Incremental improvements only. The app works — don't break it chasing features.

---

## Server-side

### Tier 1 — Quick wins
- [x] Add `initial_prompt` to Whisper call with user vocabulary and common acronyms
- [x] Tune prompt to ensure consistent punctuation and capitalization
- [x] Pin Whisper model size so cold-start time is predictable (`large-v3-turbo`)
- [x] Remove Ollama/LLM layer (simplified pipeline, ~1-2s latency)

### Tier 2 — Config and reliability
- [x] Load `initial_prompt` from a config file (`/opt/docker/openfree/prompt.txt` — edit anytime, no rebuild)
- [ ] Return a structured error when Whisper fails (currently returns generic 500)
- [ ] Add a `/health` endpoint so the client can check server status

---

## Client-side

### Tier 1 — Quick wins
- [x] Start on login (`tauri-plugin-autostart`)
- [x] Show error state in pill when transcription fails
- [x] Settings window: editable `initial_prompt` and personal vocabulary

### Tier 2 — Quality of life
- [x] Local Whisper via `whisper-rs` — runs entirely on laptop, no server needed
- [x] Toggle hotkey (`Ctrl+Shift+Alt+Space`) for hands-free long recordings
- [x] Configurable backend (local vs remote) and model path in Settings
- [ ] Build a proper installer (`.msi`) for distribution — `npm run tauri build`, optionally bundle `ggml-base.en-q5_1.bin` so friends don't need a separate download
- [ ] Configurable hotkey (currently hardcoded)
- [ ] Auto-add cmake/LLVM to PATH in dev environment so the manual env var step isn't needed

### Tier 3 — Nice to have
- [ ] LLM cleanup pass via LM Studio after transcription (punctuation polish, acronym expansion, style)
- [ ] Per-app context: different prompt/vocabulary depending on the active window (Slack, VS Code, email, etc.)
- [ ] Transcription history (last N injections, accessible from tray)
- [ ] GPU acceleration (Vulkan) for longer recordings — build with `--features gpu`
