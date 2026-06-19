const { chromium } = require("@playwright/test");

function getMockScript(windowLabel) {
  return `
    window.__TAURI_INTERNALS__ = window.__TAURI_INTERNALS__ || {};
    window.__TAURI_EVENT_PLUGIN_INTERNALS__ = window.__TAURI_EVENT_PLUGIN_INTERNALS__ || {};

    window.__TAURI_INTERNALS__.metadata = {
      currentWindow: { label: ${JSON.stringify(windowLabel)} },
      currentWebview: { windowLabel: ${JSON.stringify(windowLabel)}, label: ${JSON.stringify(windowLabel)} }
    };

    window.__MOCK_CONFIG__ = {
      initial_prompt: "",
      autostart: false,
      transcription_mode: "local",
      whisper_model_path: "",
      server_url: "http://100.120.247.76:8766/transcribe",
      ai_cleanup_enabled: false,
      ai_backend: "lmstudio",
      ai_model: "local-model",
      ai_ollama_url: "http://localhost:11434",
      openai_api_key: "",
      ai_lmstudio_url: "http://localhost:1234",
      ai_mode: "cleanup",
      local_backend: "cpu"
    };

    window.__MOCK_MODELS__ = [
      "C:\\\\models\\\\ggml-tiny.bin",
      "C:\\\\models\\\\ggml-base.bin"
    ];

    window.__PLAYBACK_ERROR__ = null;

    const callbacks = new Map();
    const listeners = new Map();

    window.__TAURI_INTERNALS__.transformCallback = (cb, once = false) => {
      const id = Math.floor(Math.random() * 1000000);
      callbacks.set(id, (data) => {
        if (once) {
          callbacks.delete(id);
        }
        cb(data);
      });
      return id;
    };

    window.__TAURI_INTERNALS__.unregisterCallback = (id) => {
      callbacks.delete(id);
    };

    window.__TAURI_EVENT_PLUGIN_INTERNALS__.unregisterListener = (event, id) => {
      callbacks.delete(id);
    };

    window.__TAURI_INTERNALS__.invoke = async (cmd, args = {}) => {
      console.log("[Mock IPC] invoke called:", cmd, args);
      if (cmd === "get_config") {
        return window.__MOCK_CONFIG__;
      }
      if (cmd === "save_config") {
        window.__MOCK_CONFIG__ = { ...window.__MOCK_CONFIG__, ...args.cfg };
        return;
      }
      if (cmd === "list_models") {
        return window.__MOCK_MODELS__;
      }
      if (cmd === "play_debug_wav") {
        if (window.__PLAYBACK_ERROR__) {
          throw window.__PLAYBACK_ERROR__;
        }
        return;
      }
      if (cmd === "plugin:event|listen") {
        const { event, handler } = args;
        if (!listeners.has(event)) {
          listeners.set(event, []);
        }
        listeners.get(event).push(handler);
        return handler;
      }
      if (cmd === "plugin:event|unlisten") {
        const { event, id } = args;
        const list = listeners.get(event);
        if (list) {
          const idx = list.indexOf(id);
          if (idx !== -1) {
            list.splice(idx, 1);
          }
        }
        return;
      }
      if (cmd.startsWith("plugin:window|") || cmd.startsWith("plugin:webview|")) {
        return;
      }
      return;
    };

    window.simulateTauriEvent = (event, payload) => {
      const handlerIds = listeners.get(event) || [];
      for (const id of handlerIds) {
        const cb = callbacks.get(id);
        if (cb) {
          cb({ event, payload });
        }
      }
    };
  `;
}

async function debug() {
  console.log("Launching browser...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on("console", (msg) => {
    console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`);
  });

  page.on("pageerror", (err) => {
    console.error(`[Browser PageError] ${err.toString()}`);
  });

  console.log("Injecting mock script for 'settings'...");
  await page.addInitScript(getMockScript("settings"));

  console.log("Navigating to http://localhost:1420...");
  try {
    await page.goto("http://localhost:1420", { timeout: 10000 });
    console.log("Navigation complete!");

    await new Promise((r) => setTimeout(r, 2000));

    const html = await page.content();
    console.log("Current page HTML length:", html.length);
    console.log("Is settings heading visible?", html.includes("Settings"));
  } catch (err) {
    console.error("Navigation/rendering failed:", err);
  }

  await browser.close();
}

debug();
