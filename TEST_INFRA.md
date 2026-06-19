# E2E Test Suite and Infrastructure for OpenFree

This document describes the End-to-End (E2E) testing infrastructure, features inventory, test suite architecture, and execution guidelines for OpenFree.

---

## 1. Directory Layout

The testing code is located inside the `tests/e2e` folder at the root of the project:

```text
c:\dev\openfree\
├── tests\e2e\
│   ├── mocks\
│   │   └── mock_mic.wav          # Generated mono WAV audio for microphone mock (16kHz, 16-bit PCM)
│   ├── specs\
│   │   ├── feature_coverage.spec.ts  # Tier 1: Core Feature Coverage settings (20 tests)
│   │   ├── boundary_cases.spec.ts    # Tier 2: Boundary & Corner Cases (20 tests)
│   │   ├── cross_features.spec.ts    # Tier 3: Cross-Feature Combinations (5 tests)
│   │   └── real_world.spec.ts        # Tier 4: Real-World Scenarios (5 tests)
│   ├── generate_mock_wav.js     # Script to generate mock_mic.wav dynamically
│   ├── playwright.config.ts      # Playwright serial test configuration
│   ├── fixtures.ts               # Test fixtures (Tauri binary launcher & WebView IPC interceptor)
│   └── package.json              # Dependencies and test runner script
└── TEST_INFRA.md                 # Test infrastructure overview (this file)
```

---

## 2. Test Architecture & Methodology

OpenFree has two operating windows defined in its Tauri configuration:
1. **Main Overlay Window ("main")**: Displays the recording status Pill (idle, recording, sending, error).
2. **Settings Window ("settings")**: Displays options for backend type, models, autostart, AI processing, and hardware acceleration.

Because of this dual-window, system-native layout, E2E testing supports two execution strategies:

### A. WebView IPC Mocked Mode (`OPENFREE_E2E_MOCK_ALL=true`)
To ensure reliable, headless testing in environments where the physical Rust backend is incomplete or does not have access to display drivers/microphones (e.g. CI runners), the test harness implements an **in-WebView IPC Interceptor**.
- Playwright hooks into the WebView and injects a script before any react code loads (`addInitScript`).
- This script mocks the global Tauri internals (`window.__TAURI_INTERNALS__` and `window.__TAURI_EVENT_PLUGIN_INTERNALS__`), intercepting all commands (`get_config`, `save_config`, `list_models`, `play_debug_wav`, and window/event listeners).
- A global helper `window.simulateTauriEvent(event, payload)` allows the test runner to dispatch backend events (e.g. dictation state changes) directly into the React application.
- It boots Vite's dev server (`npm run dev`) automatically to serve the frontend files under test.

### B. Tauri Binary Native Mode (`OPENFREE_E2E_MOCK_ALL=false`)
For real integration testing, the harness:
- Generates a valid mono mock WAV file (`mock_mic.wav`) to feed audio input.
- Spawns the compiled Rust executable (`openfree-client.exe` under `src-tauri/target/debug` or `release`) with the `--remote-debugging-port=9222` flag.
- Configures environment variables (`OPENFREE_MOCK_AUDIO_PATH` and `OPENFREE_MOCK_WHISPER=true`) to override physical microphone input and mock transcription services.
- Connects Playwright over Chromium CDP (`chromium.connectOverCDP`) to attach to the live WebView context.

---

## 3. Features Inventory & E2E Verification Focus

The E2E suite verifies 50 test cases across the following core features:

### 1. Transcription Backend Options
- Local (Whisper model on current machine) vs. Remote (home server URL).
- Verification: Dropdown switches, input fields visibility changes dynamically, configurations are saved/loaded correctly.

### 2. Whisper Model Configurations
- Model list population (GGML `.bin` files detected in local folder).
- Model warning visibility and color styling when no models are present.

### 3. Hardware Acceleration options
- CPU (No GPU Acceleration) vs. CUDA (Nvidia GPU) vs. Vulkan.
- Verification: Hardware acceleration dropdown state updates in local mode, disappears in remote mode.

### 4. Application Startup options
- Autostart / start on login options saved/loaded.

### 5. Transcription prompt priming
- Vocabulary prompting input textbox text filling and saving.
- Verification: Extensively long text inputs, empty strings, and special characters (Unicode, emojis, HTML tags) validation.

### 6. AI Cleanup options
- Toggle AI Cleanup and select backends (LM Studio, Ollama, OpenAI).
- Form inputs (API key password input, URL fields, model name textbox) visibility and configuration retention.

### 7. Audio Debugging
- Playback of the last recorded debug WAV file.
- Verification: Success state, error messaging display and error clearing upon retry.

### 8. Status Pill Overlay UI
- Dictation event handling for `dictation-state`.
- Pill visibility and CSS background color styling matching current states (idle → hidden, recording/error → red, sending → amber).

---

## 4. Execution Commands

Before running the tests, ensure dependencies are installed:
```bash
cd tests/e2e
npm install
```

### Run E2E Test Suite in Mocked Mode (Preferred for Validation/CI)
```powershell
$env:OPENFREE_E2E_MOCK_ALL="true"
npx playwright test
```

### Run E2E Test Suite against Tauri Binary
Ensure the Tauri binary is compiled first (`npm run tauri build` or `cargo build`).
```powershell
$env:OPENFREE_E2E_MOCK_ALL="false"
npx playwright test
```
