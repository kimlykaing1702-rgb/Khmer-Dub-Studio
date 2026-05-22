// ============================================================
// PATCH FILE: src/patches/fixes.ts
// Three self-contained fixes to drop into App.tsx / your codebase
// ============================================================

// ──────────────────────────────────────────────────────────────
// FIX 1: WAV EXPORT — no sound when dub clips are stacked
// ──────────────────────────────────────────────────────────────
//
// ROOT CAUSE: audioClips uses `audioUrl` for fetch(), but after
// dragging/stacking, the object-URL may be revoked OR the clip's
// `audioBlob` was never attached back. We now prefer `audioBlob`
// first (always in memory) and fall back to fetch(audioUrl).
// We also fix the OfflineAudioContext length calculation that
// sometimes results in a 0-length buffer → silent WAV.
//
// REPLACE your handleExportDubbedWav with this version:

export async function handleExportDubbedWAV_FIXED(
  audioClips: any[],
  dubVolume: number,
  encodeWAV: (samples: Int16Array, sampleRate: number) => Blob,
  setIsExportingAudio: (v: boolean) => void,
  setExportStatus: (v: string | null) => void,
  setErrorMsg: (v: string | null) => void
) {
  if (audioClips.length === 0) {
    setErrorMsg('No generated audio clips to export.');
    return;
  }

  setIsExportingAudio(true);
  setExportStatus('Preparing export...');
  setErrorMsg(null);

  try {
    // ── Step 1: Decode every clip's audio into an AudioBuffer ──
    const SAMPLE_RATE = 24000; // matches Gemini TTS output
    const decoded: { startTime: number; trimStart: number; trimEnd: number; buffer: AudioBuffer }[] = [];

    let maxEndTime = 0;
    for (const clip of audioClips) {
      const clipEnd = clip.endTime ?? (clip.startTime + (clip.audioDuration ?? 0));
      if (clipEnd > maxEndTime) maxEndTime = clipEnd;
    }

    if (maxEndTime <= 0) throw new Error('All clips have zero duration.');

    // Use a REAL AudioContext just for decoding (OfflineAudioContext can't decode in some browsers)
    const decoderCtx = new AudioContext({ sampleRate: SAMPLE_RATE });

    let decodedCount = 0;
    let failedCount = 0;

    for (const clip of audioClips) {
      try {
        let arrayBuffer: ArrayBuffer | null = null;

        // Prefer in-memory blob (always valid, even after URL revoke)
        if (clip.audioBlob instanceof Blob) {
          arrayBuffer = await clip.audioBlob.arrayBuffer();
        } else if (clip.audioUrl) {
          const resp = await fetch(clip.audioUrl);
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          arrayBuffer = await resp.arrayBuffer();
        }

        if (!arrayBuffer) {
          console.warn(`Clip ${clip.id}: no audio data, skipping.`);
          failedCount++;
          continue;
        }

        // decodeAudioData needs a copy — it detaches the buffer
        const buffer = await decoderCtx.decodeAudioData(arrayBuffer.slice(0));
        decoded.push({
          startTime: clip.startTime ?? 0,
          trimStart: clip.audioTrimStart ?? 0,
          trimEnd: clip.audioTrimEnd ?? buffer.duration,
          buffer,
        });
        decodedCount++;
      } catch (err) {
        console.warn(`Clip ${clip.id} decode failed:`, err);
        failedCount++;
      }
    }

    await decoderCtx.close();

    if (decodedCount === 0) {
      throw new Error(`No valid clips. (Total: ${audioClips.length}, Failed: ${failedCount})`);
    }

    setExportStatus(`Mixing ${decodedCount} clips into WAV...`);

    // ── Step 2: Mix into an OfflineAudioContext ──
    // Add 0.5s padding so the last clip doesn't get cut
    const totalSamples = Math.ceil((maxEndTime + 0.5) * SAMPLE_RATE);
    const offlineCtx = new OfflineAudioContext(1, totalSamples, SAMPLE_RATE);

    for (const { startTime, trimStart, trimEnd, buffer } of decoded) {
      // Re-create a buffer in the offline context's sample rate
      const resampledDuration = trimEnd - trimStart;
      if (resampledDuration <= 0) continue;

      const source = offlineCtx.createBufferSource();

      // If sample rates differ, OfflineAudioContext handles resampling automatically
      source.buffer = buffer;

      const gain = offlineCtx.createGain();
      gain.gain.value = Math.max(0, Math.min(2, dubVolume));
      source.connect(gain);
      gain.connect(offlineCtx.destination);

      // source.start(when, offset, duration)
      source.start(
        Math.max(0, startTime),
        trimStart,
        resampledDuration
      );
    }

    const rendered = await offlineCtx.startRendering();

    // ── Step 3: Convert Float32 → Int16 PCM → WAV ──
    const floatData = rendered.getChannelData(0);
    const int16 = new Int16Array(floatData.length);
    for (let i = 0; i < floatData.length; i++) {
      const s = Math.max(-1, Math.min(1, floatData[i]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }

    const wavBlob = encodeWAV(int16, rendered.sampleRate);
    const url = URL.createObjectURL(wavBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dubbed-output.wav';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Don't revoke immediately — give browser time to start download
    setTimeout(() => URL.revokeObjectURL(url), 5000);

    setExportStatus('Export complete! 🎉');
    setTimeout(() => setExportStatus(null), 3000);
  } catch (err: any) {
    console.error('WAV export failed:', err);
    setErrorMsg(`Export failed: ${err.message}`);
    setExportStatus(null);
  } finally {
    setIsExportingAudio(false);
  }
}


// ──────────────────────────────────────────────────────────────
// FIX 2: VIRTUAL SCROLL for Subtitle List
// ──────────────────────────────────────────────────────────────
//
// DROP-IN replacement for the subtitle list `<div>` inside App.tsx.
// Renders only what's visible — 800 rows feel as fast as 10.
//
// Usage in App.tsx:
//   Replace the section that maps subtitles with <VirtualSubtitleList />

import React, { useRef, useState, useEffect, useCallback } from 'react';

const ITEM_HEIGHT = 168; // px — approximate height of one SubtitleListItem

interface VirtualSubtitleListProps {
  subtitles: any[];
  renderItem: (sub: any, index: number) => React.ReactNode;
  scrollToActiveId?: number | null;
}

export const VirtualSubtitleList: React.FC<VirtualSubtitleListProps> = ({
  subtitles,
  renderItem,
  scrollToActiveId,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(600);

  // Observe container resize
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerHeight(entry.contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Scroll to active subtitle
  useEffect(() => {
    if (scrollToActiveId == null) return;
    const idx = subtitles.findIndex((s) => s.id === scrollToActiveId);
    if (idx < 0) return;
    const target = idx * ITEM_HEIGHT;
    const el = containerRef.current;
    if (!el) return;
    // Only scroll if out of view
    if (target < el.scrollTop || target + ITEM_HEIGHT > el.scrollTop + el.clientHeight) {
      el.scrollTo({ top: target - el.clientHeight / 2, behavior: 'smooth' });
    }
  }, [scrollToActiveId, subtitles]);

  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const overscan = 4;
  const totalHeight = subtitles.length * ITEM_HEIGHT;

  const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - overscan);
  const endIndex = Math.min(
    subtitles.length - 1,
    Math.ceil((scrollTop + containerHeight) / ITEM_HEIGHT) + overscan
  );

  const visibleItems = [];
  for (let i = startIndex; i <= endIndex; i++) {
    visibleItems.push({ sub: subtitles[i], index: i });
  }

  return (
    <div
      ref={containerRef}
      onScroll={onScroll}
      className="flex-1 overflow-y-auto custom-scrollbar"
      style={{ position: 'relative' }}
    >
      {/* Full height spacer so scrollbar is correct */}
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems.map(({ sub, index }) => (
          <div
            key={sub.id}
            style={{
              position: 'absolute',
              top: index * ITEM_HEIGHT,
              left: 0,
              right: 0,
              height: ITEM_HEIGHT,
              overflow: 'hidden',
            }}
          >
            {renderItem(sub, index)}
          </div>
        ))}
      </div>
    </div>
  );
};


// ──────────────────────────────────────────────────────────────
// FIX 3: GPU / Worker waveform generation
// ──────────────────────────────────────────────────────────────
//
// Creates a shared pool of Web Workers so waveform generation
// never blocks the main thread. Falls back gracefully if Workers
// aren't supported.
//
// Usage: replace calls to generateWaveform(url) with
//        generateWaveformWorker(url)

type WaveformJob = {
  resolve: (peaks: number[]) => void;
  reject: (err: any) => void;
};

const workerPool: Worker[] = [];
const jobMap = new Map<string, WaveformJob>();
const waveformCache = new Map<string, number[]>();
let workerIndex = 0;

function getWorkerPool(): Worker[] {
  if (workerPool.length > 0) return workerPool;

  // Use 2 workers — enough parallelism without thrashing
  const count = Math.min(2, navigator.hardwareConcurrency ?? 2);
  for (let i = 0; i < count; i++) {
    try {
      // The worker file must be placed in /public/waveform.worker.js
      const w = new Worker('/waveform.worker.js');
      w.onmessage = (e) => {
        const { id, peaks, error } = e.data;
        const job = jobMap.get(id);
        if (!job) return;
        jobMap.delete(id);
        if (error) {
          job.reject(new Error(error));
        } else {
          if (peaks.length > 0) waveformCache.set(id, peaks);
          job.resolve(peaks);
        }
      };
      workerPool.push(w);
    } catch {
      // Workers not available (e.g., certain sandboxed environments)
      break;
    }
  }
  return workerPool;
}

export async function generateWaveformWorker(url: string, samples = 120): Promise<number[]> {
  // Return cached result immediately
  if (waveformCache.has(url)) return waveformCache.get(url)!;

  const pool = getWorkerPool();

  // No worker available → fall back to main-thread (original logic)
  if (pool.length === 0) {
    return generateWaveformMainThread(url, samples);
  }

  return new Promise(async (resolve, reject) => {
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const arrayBuffer = await resp.arrayBuffer();

      // Round-robin worker selection
      const worker = pool[workerIndex % pool.length];
      workerIndex++;

      const jobId = url;
      jobMap.set(jobId, { resolve, reject });

      // Transfer the ArrayBuffer to the worker (zero-copy)
      worker.postMessage({ id: jobId, arrayBuffer, samples }, [arrayBuffer]);
    } catch (err) {
      reject(err);
    }
  });
}

async function generateWaveformMainThread(url: string, samples = 120): Promise<number[]> {
  try {
    const resp = await fetch(url);
    const arrayBuffer = await resp.arrayBuffer();
    const audioCtx = new AudioContext();
    const buffer = await audioCtx.decodeAudioData(arrayBuffer);
    const data = buffer.getChannelData(0);
    const blockSize = Math.floor(data.length / samples);
    const peaks: number[] = [];
    for (let i = 0; i < samples; i++) {
      let sum = 0;
      for (let j = 0; j < blockSize; j++) {
        const v = data[i * blockSize + j];
        sum += v * v;
      }
      peaks.push(Math.sqrt(sum / blockSize));
    }
    await audioCtx.close();
    const max = Math.max(...peaks) || 1;
    const norm = peaks.map((p) => Math.pow(p / max, 0.75));
    waveformCache.set(url, norm);
    return norm;
  } catch {
    return [];
  }
}

// Export cache for compatibility with existing globalWaveformCache references
export const globalWaveformCache = waveformCache;
