// public/waveform.worker.js
// Web Worker for GPU-friendly waveform generation - keeps UI thread silky smooth

self.onmessage = async (e) => {
  const { id, arrayBuffer, samples = 120 } = e.data;

  try {
    // OfflineAudioContext runs on a background thread - no GPU needed, but
    // keeps the MAIN thread free so the UI never jank
    const audioCtx = new OfflineAudioContext(1, 1, 44100);
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const channelData = audioBuffer.getChannelData(0);

    const blockSize = Math.floor(channelData.length / samples);
    const peaks = new Float32Array(samples);

    for (let i = 0; i < samples; i++) {
      let sum = 0;
      const start = i * blockSize;
      const end = Math.min(start + blockSize, channelData.length);
      for (let j = start; j < end; j++) {
        const v = channelData[j];
        sum += v * v;
      }
      peaks[i] = Math.sqrt(sum / (end - start));
    }

    // Normalize with power curve for visual appeal
    let max = 0;
    for (let i = 0; i < peaks.length; i++) {
      if (peaks[i] > max) max = peaks[i];
    }
    if (max > 0) {
      for (let i = 0; i < peaks.length; i++) {
        peaks[i] = Math.pow(peaks[i] / max, 0.75);
      }
    }

    self.postMessage({ id, peaks: Array.from(peaks), error: null });
  } catch (err) {
    self.postMessage({ id, peaks: [], error: err.message });
  }
};
