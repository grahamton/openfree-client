import { test as base, expect, Page, chromium } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { spawn, ChildProcess } from "child_process";

// Generate WAV mock
export function ensureMockWav(): string {
  const dir = path.join(__dirname, "mocks");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const filePath = path.join(dir, "mock_mic.wav");
  if (fs.existsSync(filePath)) {
    return filePath;
  }

  const sampleRate = 16000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const numSamples = sampleRate * 2; // 2 seconds
  const dataSize = numSamples * (bitsPerSample / 8) * numChannels;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);

  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28);
  buffer.writeUInt16LE(numChannels * (bitsPerSample / 8), 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    buffer.writeInt16LE(0, 44 + i * 2);
  }

  fs.writeFileSync(filePath, buffer);
  return filePath;
}

// Interceptor script source
export function getMockScript(windowLabel: string): string {
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

interface E2EFixtures {
  pillPage: Page;
  settingsPage: Page;
  appProcess: ChildProcess | null;
}

export const test = base.extend<E2EFixtures>({
  appProcess: [async ({}, use) => {
    const isMockAll = process.env.OPENFREE_E2E_MOCK_ALL === "true";
    if (isMockAll) {
      await use(null);
      return;
    }

    const mockWavPath = ensureMockWav();
    const debugBinary = path.join(__dirname, "../../src-tauri/target/debug/openfree-client.exe");
    const releaseBinary = path.join(__dirname, "../../src-tauri/target/release/openfree-client.exe");
    const binaryPath = fs.existsSync(debugBinary) ? debugBinary : releaseBinary;

    if (!fs.existsSync(binaryPath)) {
      throw new Error(`Tauri binary not found at ${debugBinary} or ${releaseBinary}`);
    }

    console.log(`Launching Tauri binary: ${binaryPath}`);
    const child = spawn(binaryPath, ["--remote-debugging-port=9222"], {
      env: {
        ...process.env,
        OPENFREE_MOCK_AUDIO_PATH: mockWavPath,
        OPENFREE_MOCK_WHISPER: "true",
      }
    });

    child.on("error", (err) => {
      console.error("Failed to start Tauri binary:", err);
    });

    await use(child);

    // Cleanup
    child.kill();
  }, { scope: "test" }],

  pillPage: [async ({ appProcess, page }, use) => {
    const isMockAll = process.env.OPENFREE_E2E_MOCK_ALL === "true";
    if (isMockAll) {
      // Setup mock init script
      await page.addInitScript(getMockScript("main"));
      await page.goto("http://localhost:1420");
      await use(page);
    } else {
      // Connect to Tauri via CDP
      let browserCDP;
      for (let i = 0; i < 25; i++) {
        try {
          browserCDP = await chromium.connectOverCDP("http://127.0.0.1:9222");
          break;
        } catch (err) {
          await new Promise(r => setTimeout(r, 200));
        }
      }
      if (!browserCDP) {
        throw new Error("Failed to connect to Tauri remote debugging port 9222");
      }
      const cdpContext = browserCDP.contexts()[0];
      let cdpPages = cdpContext.pages();
      while (cdpPages.length === 0) {
        await new Promise(r => setTimeout(r, 100));
        cdpPages = cdpContext.pages();
      }

      // Find main window
      let pillPageInstance: Page | null = null;
      for (const p of cdpPages) {
        const label = await p.evaluate(() => window.__TAURI_INTERNALS__?.metadata?.currentWindow?.label).catch(() => null);
        if (label !== "settings") {
          pillPageInstance = p;
          break;
        }
      }
      if (!pillPageInstance) {
        pillPageInstance = cdpPages[0];
      }
      await use(pillPageInstance);
      await browserCDP.close();
    }
  }, { scope: "test" }],

  settingsPage: [async ({ appProcess, context }, use) => {
    const isMockAll = process.env.OPENFREE_E2E_MOCK_ALL === "true";
    if (isMockAll) {
      // Setup mock init script for settings page
      const settingsPageInstance = await context.newPage();
      await settingsPageInstance.addInitScript(getMockScript("settings"));
      await settingsPageInstance.goto("http://localhost:1420");
      await use(settingsPageInstance);
      await settingsPageInstance.close();
    } else {
      // Connect to Tauri via CDP
      let browserCDP;
      for (let i = 0; i < 25; i++) {
        try {
          browserCDP = await chromium.connectOverCDP("http://127.0.0.1:9222");
          break;
        } catch (err) {
          await new Promise(r => setTimeout(r, 200));
        }
      }
      if (!browserCDP) {
        throw new Error("Failed to connect to Tauri remote debugging port 9222");
      }
      const cdpContext = browserCDP.contexts()[0];
      let cdpPages = cdpContext.pages();
      while (cdpPages.length === 0) {
        await new Promise(r => setTimeout(r, 100));
        cdpPages = cdpContext.pages();
      }

      // Find settings window
      let settingsPageInstance: Page | null = null;
      for (const p of cdpPages) {
        const label = await p.evaluate(() => window.__TAURI_INTERNALS__?.metadata?.currentWindow?.label).catch(() => null);
        if (label === "settings") {
          settingsPageInstance = p;
          break;
        }
      }
      // If settings window is not open, we might need to open it or wait
      if (!settingsPageInstance) {
        throw new Error("Settings window not found in Tauri process");
      }
      await use(settingsPageInstance);
      await browserCDP.close();
    }
  }, { scope: "test" }],
});

export { expect };
