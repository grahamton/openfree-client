use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use std::path::PathBuf;

pub fn record_to_file(path: &PathBuf, stop_signal: Arc<AtomicBool>) -> Result<(), String> {
    let host = cpal::default_host();
    let device = host
        .default_input_device()
        .ok_or("No input device found")?;
    let supported = device
        .default_input_config()
        .map_err(|e| e.to_string())?;

    let sample_rate = supported.sample_rate().0;
    let channels = supported.channels() as usize;

    let spec = hound::WavSpec {
        channels: 1,
        sample_rate,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };

    let writer = Arc::new(Mutex::new(
        hound::WavWriter::create(path, spec).map_err(|e| e.to_string())?,
    ));
    let writer_clone = writer.clone();

    let stream = device
        .build_input_stream(
            &supported.into(),
            move |data: &[f32], _: &cpal::InputCallbackInfo| {
                if let Ok(mut w) = writer_clone.lock() {
                    for chunk in data.chunks(channels) {
                        let mono: f32 = chunk.iter().sum::<f32>() / channels as f32;
                        let s = (mono.clamp(-1.0, 1.0) * i16::MAX as f32) as i16;
                        let _ = w.write_sample(s);
                    }
                }
            },
            |err| eprintln!("Audio stream error: {}", err),
            None,
        )
        .map_err(|e| e.to_string())?;

    stream.play().map_err(|e| e.to_string())?;

    let start = std::time::Instant::now();
    while !stop_signal.load(Ordering::Relaxed) {
        if start.elapsed().as_secs() >= 60 {
            break;
        }
        std::thread::sleep(std::time::Duration::from_millis(50));
    }

    drop(stream);

    Arc::try_unwrap(writer)
        .map_err(|_| "Writer still in use".to_string())?
        .into_inner()
        .map_err(|e| e.to_string())?
        .finalize()
        .map_err(|e| e.to_string())
}
