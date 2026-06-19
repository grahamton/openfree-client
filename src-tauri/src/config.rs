use serde::{Deserialize, Serialize};
use std::path::PathBuf;

fn default_local() -> String {
    "local".to_string()
}

fn default_server_url() -> String {
    "http://100.120.247.76:8766/transcribe".to_string()
}

fn default_ai_backend() -> String {
    "ollama".to_string()
}

fn default_ai_model() -> String {
    "llama3.2".to_string()
}

fn default_ollama_url() -> String {
    "http://localhost:11434".to_string()
}

fn default_lmstudio_url() -> String {
    "http://localhost:1234".to_string()
}

fn default_ai_mode() -> String {
    "cleanup".to_string()
}

fn default_local_backend() -> String {
    "cpu".to_string()
}

#[derive(Serialize, Deserialize, Clone)]
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
    /// Run transcription through an LLM to clean up filler words / grammar
    #[serde(default)]
    pub ai_cleanup_enabled: bool,
    /// "ollama" or "openai"
    #[serde(default = "default_ai_backend")]
    pub ai_backend: String,
    /// Model name, e.g. "llama3.2" or "gpt-4o-mini"
    #[serde(default = "default_ai_model")]
    pub ai_model: String,
    /// Ollama base URL
    #[serde(default = "default_ollama_url")]
    pub ai_ollama_url: String,
    /// OpenAI API key (stored locally in config.json)
    #[serde(default)]
    pub openai_api_key: String,
    /// LM Studio base URL
    #[serde(default = "default_lmstudio_url")]
    pub ai_lmstudio_url: String,
    /// "cleanup" (conservative) or "smart" (rephrase for clarity)
    #[serde(default = "default_ai_mode")]
    pub ai_mode: String,
    /// Hardware acceleration backend: "cpu", "cuda", or "vulkan"
    #[serde(default = "default_local_backend")]
    pub local_backend: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            initial_prompt: String::new(),
            autostart: false,
            transcription_mode: default_local(),
            whisper_model_path: String::new(),
            server_url: default_server_url(),
            ai_cleanup_enabled: false,
            ai_backend: default_ai_backend(),
            ai_model: default_ai_model(),
            ai_ollama_url: default_ollama_url(),
            openai_api_key: String::new(),
            ai_lmstudio_url: default_lmstudio_url(),
            ai_mode: default_ai_mode(),
            local_backend: default_local_backend(),
        }
    }
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_app_config_default_local_backend() {
        let config = AppConfig::default();
        assert_eq!(config.local_backend, "cpu");
    }

    #[test]
    fn test_app_config_deserialization_defaults() {
        let json = r#"{}"#;
        let config: AppConfig = serde_json::from_str(json).unwrap();
        assert_eq!(config.local_backend, "cpu");
    }

    #[test]
    fn test_app_config_serialization() {
        let mut config = AppConfig::default();
        config.local_backend = "vulkan".to_string();
        let json = serde_json::to_string(&config).unwrap();
        assert!(json.contains(r#""local_backend":"vulkan""#));
    }
}

