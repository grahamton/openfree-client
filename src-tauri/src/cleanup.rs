use reqwest::blocking::Client;
use serde_json::Value;
use std::time::Duration;

const TIMEOUT_SECS: u64 = 30;

const CLEANUP_SYSTEM: &str =
    "You are a voice transcription cleaner. Fix the transcription by: removing filler words \
     (um, uh, like, you know, right, so, basically, literally, I mean), fixing grammar, \
     punctuation and capitalization. If the user dictates a list (e.g., saying 'number one', \
     'bullet point', 'firstly', etc.), format it as a clean Markdown list with proper newlines \
     (e.g., using '-' or '1.', '2.', etc.). Keep the meaning and wording as close as possible. \
     Reply with ONLY the fixed text — no explanation, no quotes.";

const SMART_SYSTEM: &str =
    "You are a voice transcription editor. Rewrite the transcription as polished prose: \
     remove fillers, fix grammar, improve clarity and flow. \
     If the user dictates a list (e.g., saying 'number one', 'bullet point', 'firstly', etc.), \
     format it as a clean Markdown list with proper newlines (e.g., using '-' or '1.', '2.', etc.). \
     Reply with ONLY the rewritten text — no explanation, no quotes.";

pub fn fallback_format(text: &str) -> String {
    let chars: Vec<char> = text.chars().collect();
    let mut result = String::new();
    if chars.is_empty() {
        return result;
    }

    let mut i = 0;
    while i < chars.len() {
        let curr = chars[i];
        
        // Skip duplicate spaces
        if curr == ' ' && i > 0 && chars[i - 1] == ' ' {
            i += 1;
            continue;
        }

        result.push(curr);

        if i < chars.len() - 1 {
            let next = chars[i + 1];

            // Heuristic for inserting missing space after punctuation
            if (curr == '.' || curr == '?' || curr == '!' || curr == ',' || curr == ';' || curr == ':')
                && next.is_alphanumeric()
            {
                let mut should_space = true;

                // Avoid spacing decimals (e.g. 3.14) or numbers with commas (e.g. 1,000)
                if curr == '.' || curr == ',' {
                    let prev_is_digit = i > 0 && chars[i - 1].is_ascii_digit();
                    let next_is_digit = next.is_ascii_digit();
                    if prev_is_digit && next_is_digit {
                        should_space = false;
                    }
                }

                // Avoid spacing ellipses (e.g. ... or ..)
                if curr == '.' && (next == '.' || (i > 0 && chars[i - 1] == '.')) {
                    should_space = false;
                }

                // Avoid spacing domain names / URLs (e.g. google.com) by only spacing after '.' if next is uppercase
                if curr == '.' && !next.is_uppercase() && !next.is_ascii_digit() {
                    should_space = false;
                }

                if should_space {
                    result.push(' ');
                }
            }
        }
        i += 1;
    }
    result.trim().to_string()
}

pub fn cleanup_text(
    text: &str,
    backend: &str,
    model: &str,
    mode: &str,
    ollama_url: &str,
    lmstudio_url: &str,
    openai_api_key: &str,
) -> Result<String, String> {
    if text.is_empty() {
        return Ok(text.to_string());
    }
    let system = if mode == "smart" {
        SMART_SYSTEM
    } else {
        CLEANUP_SYSTEM
    };
    let client = Client::builder()
        .timeout(Duration::from_secs(TIMEOUT_SECS))
        .build()
        .map_err(|e| e.to_string())?;

    match backend {
        "openai" => call_openai(&client, text, model, system, openai_api_key),
        "lmstudio" => call_lmstudio(&client, text, model, system, lmstudio_url),
        _ => call_ollama(&client, text, model, system, ollama_url),
    }
}

fn call_ollama(
    client: &Client,
    text: &str,
    model: &str,
    system: &str,
    base_url: &str,
) -> Result<String, String> {
    let url = format!("{}/api/chat", base_url.trim_end_matches('/'));
    let body = serde_json::json!({
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": text}
        ],
        "stream": false
    });

    let resp = client
        .post(&url)
        .json(&body)
        .send()
        .map_err(|e| format!("Ollama request failed: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Ollama error: HTTP {}", resp.status()));
    }

    let json: Value = resp.json().map_err(|e| e.to_string())?;
    json["message"]["content"]
        .as_str()
        .map(|s| s.trim().to_string())
        .ok_or_else(|| "Ollama response missing message.content".to_string())
}

/// LM Studio exposes an OpenAI-compatible API at a local URL with no auth required.
fn call_lmstudio(
    client: &Client,
    text: &str,
    model: &str,
    system: &str,
    base_url: &str,
) -> Result<String, String> {
    let url = format!("{}/v1/chat/completions", base_url.trim_end_matches('/'));
    let body = serde_json::json!({
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": text}
        ],
        "max_tokens": 1024,
        "temperature": 0.2
    });

    let resp = client
        .post(&url)
        .json(&body)
        .send()
        .map_err(|e| format!("LM Studio request failed: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("LM Studio error: HTTP {}", resp.status()));
    }

    let json: Value = resp.json().map_err(|e| e.to_string())?;
    json["choices"][0]["message"]["content"]
        .as_str()
        .map(|s| s.trim().to_string())
        .ok_or_else(|| "LM Studio response missing choices[0].message.content".to_string())
}

fn call_openai(
    client: &Client,
    text: &str,
    model: &str,
    system: &str,
    api_key: &str,
) -> Result<String, String> {
    if api_key.is_empty() {
        return Err("OpenAI API key not configured".to_string());
    }

    let body = serde_json::json!({
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": text}
        ],
        "max_tokens": 1024,
        "temperature": 0.2
    });

    let resp = client
        .post("https://api.openai.com/v1/chat/completions")
        .bearer_auth(api_key)
        .json(&body)
        .send()
        .map_err(|e| format!("OpenAI request failed: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("OpenAI error: HTTP {}", resp.status()));
    }

    let json: Value = resp.json().map_err(|e| e.to_string())?;
    json["choices"][0]["message"]["content"]
        .as_str()
        .map(|s| s.trim().to_string())
        .ok_or_else(|| "OpenAI response missing choices[0].message.content".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fallback_format_spacing() {
        assert_eq!(fallback_format("How about that?Do you"), "How about that? Do you");
        assert_eq!(fallback_format("river.Number"), "river. Number");
        assert_eq!(fallback_format("google.com"), "google.com");
        assert_eq!(fallback_format("3.14"), "3.14");
        assert_eq!(fallback_format("hello,world"), "hello, world");
        assert_eq!(fallback_format("ellipses...next"), "ellipses...next");
    }
}
