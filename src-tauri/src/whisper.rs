use std::sync::Mutex;
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters, WhisperState};

use crate::transcribe::Transcriber;

/// Newtype so we can store WhisperState inside a Mutex across thread boundaries.
/// Safety: recordings are serialised by RecordingMode; the Mutex enforces
/// exclusive access, and WhisperState/WhisperContext are otherwise self-contained.
struct SendableState(WhisperState);
unsafe impl Send for SendableState {}

pub struct LocalWhisper {
    /// Kept alive so the model weights are not freed while the state exists.
    _ctx: WhisperContext,
    /// Reused across calls — avoids reallocating KV cache / mel buffers every time.
    state: Mutex<SendableState>,
    is_english_only: bool,
}

unsafe impl Send for LocalWhisper {}
unsafe impl Sync for LocalWhisper {}

impl LocalWhisper {
    pub fn new(model_path: &str, local_backend: &str) -> Result<Self, String> {
        let mut params = WhisperContextParameters::default();
        let use_gpu = local_backend != "cpu";
        params.use_gpu(use_gpu);
        params.flash_attn(use_gpu);
        let ctx = WhisperContext::new_with_params(model_path, params)
            .map_err(|e| format!("Failed to load Whisper model '{}': {}", model_path, e))?;
        let state = ctx
            .create_state()
            .map_err(|e| format!("Failed to create Whisper state: {}", e))?;
        let is_english_only = model_path.contains(".en");
        Ok(Self {
            _ctx: ctx,
            state: Mutex::new(SendableState(state)),
            is_english_only,
        })
    }
}

impl Transcriber for LocalWhisper {
    fn transcribe(&self, samples: &[f32], prompt: Option<&str>) -> Result<String, String> {
        let mut guard = self.state.lock().map_err(|e| e.to_string())?;
        let state = &mut guard.0;

        let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });

        // Physical cores beat logical (hyperthreaded) ones for whisper.cpp's matrix ops.
        let n_threads = (num_cpus::get_physical() as i32).max(1).min(8);
        params.set_n_threads(n_threads);

        // Skip language detection for .en-only models — saves a classifier pass.
        if self.is_english_only {
            params.set_language(Some("en"));
            params.set_detect_language(false);
        } else {
            params.set_language(None);
        }

        // Limit encoder context to actual recording length instead of the full 30-second
        // window. whisper uses 50 encoder frames/sec; add a 32-frame safety margin.
        // A 3-second utterance needs ~182 frames vs the default 1500 — ~8x less work.
        let audio_ctx = ((samples.len() as f32 / 16000.0 * 50.0) as i32 + 32)
            .min(1500)
            .max(64);
        params.set_audio_ctx(audio_ctx);

        // Don't carry KV context across separate utterances.
        params.set_no_context(true);

        params.set_print_progress(false);
        params.set_print_realtime(false);
        params.set_print_special(false);
        params.set_print_timestamps(false);

        if let Some(p) = prompt {
            params.set_initial_prompt(p);
        }

        eprintln!(
            "[openfree] whisper: {:.2}s audio, audio_ctx={}, threads={}",
            samples.len() as f32 / 16000.0,
            audio_ctx,
            n_threads
        );

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
