use serde::{Deserialize, Serialize};
use std::path::PathBuf;

fn default_local() -> String {
    "local".to_string()
}

fn default_server_url() -> String {
    "http://100.120.247.76:8766/transcribe".to_string()
}

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct AppConfig {
    #[serde(default)]
    pub initial_prompt: String,
    #[serde(default)]
    pub autostart: bool,
    /// "local" or "remote"
    #[serde(default = "default_local")]
    pub transcription_mode: String,
    /// Path to a GGML .bin model file (e.g. ggml-base.en-q5_1.bin)
    #[serde(default)]
    pub whisper_model_path: String,
    /// Remote transcription server URL (used when transcription_mode = "remote")
    #[serde(default = "default_server_url")]
    pub server_url: String,
}

pub fn load(path: &PathBuf) -> AppConfig {
    std::fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

pub fn save(path: &PathBuf, config: &AppConfig) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    std::fs::write(path, json).map_err(|e| e.to_string())
}
