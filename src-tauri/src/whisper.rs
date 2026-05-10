use std::sync::Mutex;
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

use crate::transcribe::Transcriber;

pub struct LocalWhisper {
    ctx: Mutex<WhisperContext>,
}

// WhisperContext wraps a raw pointer. whisper-rs marks it Send; Mutex makes it Sync.
unsafe impl Send for LocalWhisper {}
unsafe impl Sync for LocalWhisper {}

impl LocalWhisper {
    pub fn new(model_path: &str) -> Result<Self, String> {
        let params = WhisperContextParameters::default();
        #[cfg(feature = "gpu")]
        {
            params.use_gpu(true);
        }
        let ctx = WhisperContext::new_with_params(model_path, params)
            .map_err(|e| format!("Failed to load Whisper model '{}': {}", model_path, e))?;
        Ok(Self {
            ctx: Mutex::new(ctx),
        })
    }
}

impl Transcriber for LocalWhisper {
    fn transcribe(&self, samples: &[f32], prompt: Option<&str>) -> Result<String, String> {
        let ctx = self.ctx.lock().map_err(|e| e.to_string())?;
        let mut state = ctx.create_state().map_err(|e| e.to_string())?;

        let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
        params.set_language(Some("en"));
        params.set_print_progress(false);
        params.set_print_realtime(false);
        params.set_print_special(false);
        params.set_print_timestamps(false);
        if let Some(p) = prompt {
            params.set_initial_prompt(p);
        }

        state
            .full(params, samples)
            .map_err(|e| format!("Whisper inference failed: {}", e))?;

        let n = state.full_n_segments();
        let mut text = String::new();
        for i in 0..n {
            if let Some(seg) = state.get_segment(i) {
                if let Ok(s) = seg.to_str() {
                    text.push_str(s);
                }
            }
        }
        Ok(text.trim().to_string())
    }
}
