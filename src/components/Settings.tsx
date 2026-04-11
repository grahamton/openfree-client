import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

interface AppConfig {
  initial_prompt: string;
  autostart: boolean;
}

export function Settings() {
  const [config, setConfig] = useState<AppConfig>({ initial_prompt: "", autostart: false });
  const [saved, setSaved] = useState(false);

  const loadConfig = async () => {
    try {
      const cfg = await invoke<AppConfig>("get_config");
      setConfig(cfg);
    } catch (error) {
      console.error("Failed to load config:", error);
    }
  };

  useEffect(() => {
    // Load config on initial mount
    loadConfig();

    // Reload config when window regains focus (for reopening)
    const window = getCurrentWebviewWindow();
    const unlisten = window.onFocusChanged(({ payload: focused }) => {
      if (focused) {
        loadConfig();
      }
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
    // Use minimize instead of hide for better Tauri 2.x compatibility
    // This ensures the window state is properly preserved for reopening
    try {
      await getCurrentWebviewWindow().minimize();
    } catch (error) {
      console.error("Failed to minimize settings window:", error);
      // Fallback to hide if minimize fails
      try {
        await getCurrentWebviewWindow().hide();
      } catch (err) {
        console.error("Failed to hide settings window:", err);
      }
    }
  }

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: "24px", color: "#1a1a1a" }}>
      <h2 style={{ margin: "0 0 20px", fontSize: "16px", fontWeight: 600 }}>OpenFree Settings</h2>

      <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 500 }}>
        Transcription Prompt
      </label>
      <p style={{ margin: "0 0 8px", fontSize: "12px", color: "#666" }}>
        Primes Whisper with your vocabulary. Include your name, acronyms, and domain terms.
      </p>
      <textarea
        value={config.initial_prompt}
        onChange={e => setConfig(c => ({ ...c, initial_prompt: e.target.value }))}
        placeholder="e.g. Graham. Common terms: API, LLM, OpenFree, Tailscale."
        style={{
          width: "100%",
          height: "120px",
          padding: "8px",
          fontSize: "13px",
          border: "1px solid #d0d0d0",
          borderRadius: "6px",
          resize: "none",
          boxSizing: "border-box",
          fontFamily: "inherit",
        }}
      />

      <label style={{ display: "flex", alignItems: "center", gap: "8px", margin: "16px 0", fontSize: "13px", cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={config.autostart}
          onChange={e => setConfig(c => ({ ...c, autostart: e.target.checked }))}
        />
        Start on login
      </label>

      <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
        <button onClick={handleClose} style={secondaryBtn}>Close</button>
        <button onClick={handleSave} style={primaryBtn}>
          {saved ? "Saved!" : "Save"}
        </button>
      </div>
    </div>
  );
}

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
