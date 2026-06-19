import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

interface AppConfig {
  initial_prompt: string;
  autostart: boolean;
  transcription_mode: string;
  whisper_model_path: string;
  server_url: string;
  ai_cleanup_enabled: boolean;
  ai_backend: string;
  ai_model: string;
  ai_ollama_url: string;
  openai_api_key: string;
  ai_lmstudio_url: string;
  ai_mode: string;
  local_backend: string;
}

const DEFAULT_CONFIG: AppConfig = {
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
  local_backend: "cpu",
};

export function Settings() {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [saved, setSaved] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  async function handlePlayBack() {
    try {
      setPlaybackError(null);
      await invoke("play_debug_wav");
    } catch (err: any) {
      setPlaybackError(err.toString());
    }
  }

  const loadConfig = async () => {
    try {
      const cfg = await invoke<AppConfig>("get_config");
      setConfig({ ...DEFAULT_CONFIG, ...cfg });
    } catch (error) {
      console.error("Failed to load config:", error);
    }
  };

  const loadModels = async () => {
    try {
      const models = await invoke<string[]>("list_models");
      setAvailableModels(models);
    } catch (error) {
      console.error("Failed to list models:", error);
    }
  };

  useEffect(() => {
    loadConfig();
    loadModels();
    const window = getCurrentWebviewWindow();
    const unlisten = window.onFocusChanged(({ payload: focused }) => {
      if (focused) { loadConfig(); loadModels(); }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  function handleSave() {
    invoke("save_config", { cfg: config })
      .then(() => {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      })
      .catch(console.error);
  }

  async function handleClose() {
    try {
      await getCurrentWebviewWindow().hide();
    } catch (err) {
      console.error("Failed to hide settings window:", err);
    }
  }

  const isLocal = config.transcription_mode !== "remote";

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: "24px", color: "#1a1a1a" }}>
      <h2 style={{ margin: "0 0 20px", fontSize: "16px", fontWeight: 600 }}>OpenFree Settings</h2>

      {/* Transcription backend */}
      <label style={labelStyle}>Transcription Backend</label>
      <p style={hintStyle}>
        Local runs Whisper on your laptop. Remote sends audio to your home server.
        Changes take effect after restarting the app.
      </p>
      <select
        value={config.transcription_mode}
        onChange={e => setConfig(c => ({ ...c, transcription_mode: e.target.value }))}
        style={{ ...inputStyle, height: "32px", padding: "4px 8px" }}
      >
        <option value="local">Local (Whisper on this machine)</option>
        <option value="remote">Remote (home server)</option>
      </select>

      {/* Local: model path */}
      {isLocal && (
        <div style={{ marginTop: "16px" }}>
          <label style={labelStyle}>Whisper Model</label>
          <p style={hintStyle}>
            Models are loaded from{" "}
            <code style={{ fontSize: "11px", background: "#f4f4f4", padding: "1px 4px", borderRadius: "3px" }}>
              %LOCALAPPDATA%\openfree\models\
            </code>.
            Drop <code style={{ fontSize: "11px", background: "#f4f4f4", padding: "1px 4px", borderRadius: "3px" }}>.bin</code> files there and re-open settings.
            Changes take effect after restarting the app.
          </p>
          {availableModels.length > 0 ? (
            <select
              value={config.whisper_model_path}
              onChange={e => setConfig(c => ({ ...c, whisper_model_path: e.target.value }))}
              style={{ ...inputStyle, height: "32px", padding: "4px 8px" }}
            >
              <option value="">— select a model —</option>
              {availableModels.map(p => (
                <option key={p} value={p}>
                  {p.replace(/\\/g, "/").split("/").pop()}
                </option>
              ))}
            </select>
          ) : (
            <p style={{ ...hintStyle, color: "#dc2626" }}>
              No models found. Add <code>.bin</code> files to{" "}
              <code style={{ fontSize: "11px" }}>%LOCALAPPDATA%\openfree\models\</code>.
            </p>
          )}
        </div>
      )}

      {/* GPU Backend Dropdown under local settings */}
      {isLocal && (
        <div style={{ marginTop: "16px" }}>
          <label style={labelStyle}>Hardware Acceleration</label>
          <select
            value={config.local_backend}
            onChange={e => setConfig(c => ({ ...c, local_backend: e.target.value }))}
            style={{ ...inputStyle, height: "32px", padding: "4px 8px" }}
          >
            <option value="cpu">CPU (No GPU Acceleration)</option>
            <option value="cuda">CUDA (Nvidia GPU)</option>
            <option value="vulkan">Vulkan (Cross-Platform GPU)</option>
          </select>
        </div>
      )}

      {/* Remote: server URL */}
      {!isLocal && (
        <div style={{ marginTop: "16px" }}>
          <label style={labelStyle}>Server URL</label>
          <input
            type="text"
            value={config.server_url}
            onChange={e => setConfig(c => ({ ...c, server_url: e.target.value }))}
            placeholder="http://100.120.247.76:8766/transcribe"
            style={inputStyle}
          />
        </div>
      )}

      {/* Transcription prompt */}
      <div style={{ marginTop: "16px" }}>
        <label style={labelStyle}>Transcription Prompt</label>
        <p style={hintStyle}>
          Primes Whisper with your vocabulary. Include your name, acronyms, and domain terms.
        </p>
        <textarea
          value={config.initial_prompt}
          onChange={e => setConfig(c => ({ ...c, initial_prompt: e.target.value }))}
          placeholder="e.g. Graham. Common terms: API, LLM, OpenFree, Tailscale."
          style={{
            ...inputStyle,
            height: "100px",
            resize: "none",
          }}
        />
      </div>

      {/* Autostart */}
      <label style={{ display: "flex", alignItems: "center", gap: "8px", margin: "16px 0", fontSize: "13px", cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={config.autostart}
          onChange={e => setConfig(c => ({ ...c, autostart: e.target.checked }))}
        />
        Start on login
      </label>

      {/* AI Cleanup */}
      <div style={{ borderTop: "1px solid #eee", paddingTop: "16px", marginTop: "4px" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", fontSize: "13px", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={config.ai_cleanup_enabled}
            onChange={e => setConfig(c => ({ ...c, ai_cleanup_enabled: e.target.checked }))}
          />
          <span style={{ fontWeight: 500 }}>AI Cleanup</span>
        </label>
        <p style={hintStyle}>
          Pass the raw transcript through an LLM to remove filler words and fix grammar — like Wispr Flow.
        </p>

        {config.ai_cleanup_enabled && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "8px" }}>
            <div style={{ display: "flex", gap: "12px" }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Backend</label>
                <select
                  value={config.ai_backend}
                  onChange={e => {
                    const b = e.target.value;
                    setConfig(c => ({
                      ...c,
                      ai_backend: b,
                      ai_model: b === "openai" ? "gpt-4o-mini" : b === "ollama" ? "llama3.2" : "local-model",
                    }));
                  }}
                  style={{ ...inputStyle, height: "32px", padding: "4px 8px" }}
                >
                  <option value="lmstudio">LM Studio (local)</option>
                  <option value="ollama">Ollama (local)</option>
                  <option value="openai">OpenAI API</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Mode</label>
                <select
                  value={config.ai_mode}
                  onChange={e => setConfig(c => ({ ...c, ai_mode: e.target.value }))}
                  style={{ ...inputStyle, height: "32px", padding: "4px 8px" }}
                >
                  <option value="cleanup">Cleanup — fix fillers &amp; grammar</option>
                  <option value="smart">Smart — rewrite for clarity</option>
                </select>
              </div>
            </div>

            <div>
              <label style={labelStyle}>Model</label>
              <input
                type="text"
                value={config.ai_model}
                onChange={e => setConfig(c => ({ ...c, ai_model: e.target.value }))}
                placeholder={config.ai_backend === "openai" ? "gpt-4o-mini" : "llama3.2"}
                style={inputStyle}
              />
            </div>

            {config.ai_backend === "lmstudio" && (
              <div>
                <label style={labelStyle}>LM Studio URL</label>
                <input
                  type="text"
                  value={config.ai_lmstudio_url}
                  onChange={e => setConfig(c => ({ ...c, ai_lmstudio_url: e.target.value }))}
                  placeholder="http://localhost:1234"
                  style={inputStyle}
                />
                <p style={{ ...hintStyle, marginTop: "4px" }}>
                  LM Studio ignores the model name — it uses whichever model is currently loaded.
                </p>
              </div>
            )}

            {config.ai_backend === "ollama" && (
              <div>
                <label style={labelStyle}>Ollama URL</label>
                <input
                  type="text"
                  value={config.ai_ollama_url}
                  onChange={e => setConfig(c => ({ ...c, ai_ollama_url: e.target.value }))}
                  placeholder="http://localhost:11434"
                  style={inputStyle}
                />
              </div>
            )}

            {config.ai_backend === "openai" && (
              <div>
                <label style={labelStyle}>OpenAI API Key</label>
                <input
                  type="password"
                  value={config.openai_api_key}
                  onChange={e => setConfig(c => ({ ...c, openai_api_key: e.target.value }))}
                  placeholder="sk-..."
                  style={inputStyle}
                />
                <p style={{ ...hintStyle, marginTop: "4px" }}>
                  Stored locally in config.json. Uses gpt-4o-mini by default (~$0.0001 per transcription).
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Audio Debugging */}
      <div style={{ borderTop: "1px solid #eee", paddingTop: "16px", marginTop: "16px" }}>
        <label style={labelStyle}>Audio Debugging</label>
        <p style={hintStyle}>
          Play back the last recorded audio file to verify microphone quality and volume.
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button onClick={handlePlayBack} style={secondaryBtn}>
            Play Last Recording
          </button>
          {playbackError && (
            <span style={{ fontSize: "12px", color: "#dc2626" }}>
              {playbackError}
            </span>
          )}
        </div>
      </div>

      {/* Hotkey reminder */}
      <p style={{ ...hintStyle, marginBottom: "16px", borderTop: "1px solid #eee", paddingTop: "12px" }}>
        <strong>Hold-to-talk:</strong> Ctrl+Shift+Space&nbsp;&nbsp;
        <strong>Toggle (for long recordings):</strong> Ctrl+Shift+Alt+Space
      </p>

      <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
        <button onClick={handleClose} style={secondaryBtn}>Close</button>
        <button onClick={handleSave} style={primaryBtn}>
          {saved ? "Saved!" : "Save"}
        </button>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: "4px",
  fontSize: "13px",
  fontWeight: 500,
};

const hintStyle: React.CSSProperties = {
  margin: "0 0 8px",
  fontSize: "12px",
  color: "#666",
  lineHeight: 1.4,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px",
  fontSize: "13px",
  border: "1px solid #d0d0d0",
  borderRadius: "6px",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

const primaryBtn: React.CSSProperties = {
  padding: "7px 18px",
  fontSize: "13px",
  fontWeight: 500,
  background: "#2563eb",
  color: "white",
  border: "none",
  borderRadius: "6px",
  cursor: "pointer",
};

const secondaryBtn: React.CSSProperties = {
  padding: "7px 18px",
  fontSize: "13px",
  fontWeight: 500,
  background: "transparent",
  color: "#444",
  border: "1px solid #d0d0d0",
  borderRadius: "6px",
  cursor: "pointer",
};
