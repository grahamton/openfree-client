use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use std::sync::{Arc, Mutex};

const TARGET_RATE: u32 = 16000;

pub struct ActiveRecording {
    pub stream: cpal::Stream,
    pub buffer: Arc<Mutex<Vec<f32>>>,
    pub source_rate: u32,
}

pub fn start_recording() -> Result<ActiveRecording, String> {
    let host = cpal::default_host();
    let device = host
        .default_input_device()
        .ok_or("No input device found")?;
    let supported = device
        .default_input_config()
        .map_err(|e| e.to_string())?;

    let sample_rate = supported.sample_rate().0;
    let channels = supported.channels() as usize;

    let buffer = Arc::new(Mutex::new(Vec::<f32>::new()));
    let buffer_clone = buffer.clone();

    let stream = device
        .build_input_stream(
            &supported.into(),
            move |data: &[f32], _: &cpal::InputCallbackInfo| {
                let mut buf = buffer_clone.lock().unwrap();
                for chunk in data.chunks(channels) {
                    let mono: f32 = chunk.iter().sum::<f32>() / channels as f32;
                    buf.push(mono);
                }
            },
            |err| eprintln!("Audio stream error: {}", err),
            None,
        )
        .map_err(|e| e.to_string())?;

    stream.play().map_err(|e| e.to_string())?;

    Ok(ActiveRecording {
        stream,
        buffer,
        source_rate: sample_rate,
    })
}

/// Linear interpolation downsample to 16 kHz. Good enough for voice dictation.
pub fn resample_to_16k(samples: &[f32], source_rate: u32) -> Vec<f32> {
    let ratio = source_rate as f64 / TARGET_RATE as f64;
    let out_len = (samples.len() as f64 / ratio) as usize;
    (0..out_len)
        .map(|i| {
            let pos = i as f64 * ratio;
            let idx = pos as usize;
            let frac = (pos - idx as f64) as f32;
            let a = samples.get(idx).copied().unwrap_or(0.0);
            let b = samples.get(idx + 1).copied().unwrap_or(a);
            a + (b - a) * frac
        })
        .collect()
}
