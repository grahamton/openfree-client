use reqwest::multipart;
use std::error::Error;
use std::path::PathBuf;

pub async fn send_audio(audio_path: &PathBuf, server_url: &str) -> Result<String, String> {
    let file_bytes = std::fs::read(audio_path).map_err(|e| e.to_string())?;

    let part = multipart::Part::bytes(file_bytes)
        .file_name("audio.wav")
        .mime_str("audio/wav")
        .map_err(|e| e.to_string())?;

    let form = multipart::Form::new().part("audio", part);

    let client = reqwest::Client::builder()
        .no_proxy()
        .build()
        .map_err(|e| e.to_string())?;
    let response = client
        .post(server_url)
        .multipart(form)
        .timeout(std::time::Duration::from_secs(120))
        .send()
        .await
        .map_err(|e| format!("Request failed: {} (source: {:?})", e, e.source()))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Server error {}: {}", status, body));
    }

    let body: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    body["text"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| format!("Missing 'text' field in response: {}", body))
}
