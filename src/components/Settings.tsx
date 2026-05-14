import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

interface AppConfig {
  initial_prompt: string;
  autostart: boolean;
  transcription_mode: string;
  whisper_model_path: string;
  server_url: string;
}

const DEFAULT_CONFIG: AppConfig = {
  initial_prompt: "",
  autostart: false,
  transcription_mode: "local",
  whisper_model_path: "",
  server_url: "http://100.120.247.76:8766/transcribe",
};

export function Settings() {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [saved, setSaved] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);

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
