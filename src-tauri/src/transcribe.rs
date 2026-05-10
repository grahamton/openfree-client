use std::path::PathBuf;

pub trait Transcriber: Send + Sync {
    fn transcribe(&self, samples: &[f32], prompt: Option<&str>) -> Result<String, String>;
}

/// Remote backend: writes samples to a temp WAV then POSTs to the server.
pub struct RemoteApi {
    server_url: String,
}

impl RemoteApi {
    pub fn new(server_url: String) -> Self {
        Self { server_url }
    }
}

impl Transcriber for RemoteApi {
    fn transcribe(&self, samples: &[f32], prompt: Option<&str>) -> Result<String, String> {
        let tmp = std::env::temp_dir().join("openfree_audio.wav");
        write_wav_16k(&tmp, samples)?;

        let prompt_owned = prompt.map(|s| s.to_string());
        let url = self.server_url.clone();
        let rt = tokio::runtime::Runtime::new().map_err(|e| e.to_string())?;
        let result = rt.block_on(crate::api::send_audio(&tmp, &url, prompt_owned));
        let _ = std::fs::remove_file(&tmp);
        result
    }
}

pub fn write_wav_16k(path: &PathBuf, samples: &[f32]) -> Result<(), String> {
    let spec = hound::WavSpec {
        channels: 1,
        sample_rate: 16000,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };
    let mut writer = hound::WavWriter::create(path, spec).map_err(|e| e.to_string())?;
    for &s in samples {
        let val = (s.clamp(-1.0, 1.0) * i16::MAX as f32) as i16;
        writer.write_sample(val).map_err(|e| e.to_string())?;
    }
    writer.finalize().map_err(|e| e.to_string())
}
