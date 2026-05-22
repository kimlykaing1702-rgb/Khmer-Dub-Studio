import { Film, FileText, Play, Pause, Languages, Loader2, Music, Download, Settings, Square, ListChecks, X, Undo2, Redo2, Link2, Link2Off, Plus, Minus, ZoomIn, ZoomOut, HelpCircle, Volume1, Volume2, VolumeX, AlertTriangle } from 'lucide-react';
import React, { useEffect, useRef, useState, useMemo, useCallback, Component } from 'react';
import { motion } from 'motion/react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import * as workspaceLib from './lib/workspace';
import * as workspaceExport from './lib/workspace-export';
import { WorkspaceManager } from './components/WorkspaceManager';
import { WorkspaceData } from './lib/workspace-types';
import { handleExportDubbedWAV_FIXED, VirtualSubtitleList } from './patches/fixes';

const TTS_VOICES = [
  { id: 'Puck', label: 'Male: Puck' },
  { id: 'Charon', label: 'Male: Charon' },
  { id: 'Kore', label: 'Female: Kore' },
  { id: 'Fenrir', label: 'Male: Fenrir' },
  { id: 'Aoede', label: 'Female: Aoede' }
];

const VOXCPM_VOICES = [
  { id: 'alloy', label: 'Neutral: Alloy' },
  { id: 'echo', label: 'Male: Echo' },
  { id: 'fable', label: 'British Male: Fable' },
  { id: 'onyx', label: 'Deep Male: Onyx' },
  { id: 'nova', label: 'Female: Nova' },
  { id: 'shimmer', label: 'Clear Female: Shimmer' }
];

const SPEAKER_COLORS = [
  '#f59e0b', // amber
  '#10b981', // emerald
  '#3b82f6', // blue
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
];

const EMOTIONS = [
  { id: 'angry', label: 'Angry', icon: '🔥', color: 'text-red-500', bg: 'bg-red-500/20', glow: 'shadow-red-500/50', border: 'border-red-500/50' },
  { id: 'calm', label: 'Calm', icon: '❄', color: 'text-blue-400', bg: 'bg-blue-400/20', glow: 'shadow-blue-400/50', border: 'border-blue-400/50' },
  { id: 'nervous', label: 'Nervous', icon: '⚡', color: 'text-yellow-400', bg: 'bg-yellow-400/20', glow: 'shadow-yellow-400/50', border: 'border-yellow-400/50' },
  { id: 'sad', label: 'Sad', icon: '💧', color: 'text-purple-400', bg: 'bg-purple-400/20', glow: 'shadow-purple-400/50', border: 'border-purple-400/50' },
  { id: 'sarcastic', label: 'Sarcastic', icon: '🎭', color: 'text-green-400', bg: 'bg-green-400/20', glow: 'shadow-green-400/50', border: 'border-green-400/50' },
  { id: 'seductive', label: 'Seductive', icon: '💋', color: 'text-pink-400', bg: 'bg-pink-400/20', glow: 'shadow-pink-400/50', border: 'border-pink-400/50' },
  { id: 'cold', label: 'Cold', icon: '🧊', color: 'text-cyan-300', bg: 'bg-cyan-300/20', glow: 'shadow-cyan-300/50', border: 'border-cyan-300/50' },
  { id: 'commanding', label: 'Commanding', icon: '📢', color: 'text-orange-500', bg: 'bg-orange-500/20', glow: 'shadow-orange-500/50', border: 'border-orange-500/50' },
  { id: 'exhausted', label: 'Exhausted', icon: '😴', color: 'text-slate-400', bg: 'bg-slate-400/20', glow: 'shadow-slate-400/50', border: 'border-slate-400/50' },
  { id: 'arrogant', label: 'Arrogant', icon: '💅', color: 'text-rose-400', bg: 'bg-rose-400/20', glow: 'shadow-rose-400/50', border: 'border-rose-400/50' },
  { id: 'scared', label: 'Scared', icon: '😨', color: 'text-amber-300', bg: 'bg-amber-300/20', glow: 'shadow-amber-300/50', border: 'border-amber-300/50' },
  { id: 'childish', label: 'Childish', icon: '🧸', color: 'text-lime-400', bg: 'bg-lime-400/20', glow: 'shadow-lime-400/50', border: 'border-lime-400/50' },
  { id: 'confident', label: 'Confident', icon: '🦁', color: 'text-indigo-400', bg: 'bg-indigo-400/20', glow: 'shadow-indigo-400/50', border: 'border-indigo-400/50' },
  { id: 'emotional', label: 'Emotional', icon: '🫂', color: 'text-violet-400', bg: 'bg-violet-400/20', glow: 'shadow-violet-400/50', border: 'border-violet-400/50' },
  { id: 'shouting', label: 'Shouting', icon: '🔊', color: 'text-red-600', bg: 'bg-red-600/20', glow: 'shadow-red-600/50', border: 'border-red-600/50' },
  { id: 'whispering', label: 'Whispering', icon: '🤫', color: 'text-teal-400', bg: 'bg-teal-400/20', glow: 'shadow-teal-400/50', border: 'border-teal-400/50' },
  { id: 'crying', label: 'Crying', icon: '😭', color: 'text-blue-500', bg: 'bg-blue-500/20', glow: 'shadow-blue-500/50', border: 'border-blue-500/50' },
  { id: 'fast', label: 'Fast', icon: '🏃', color: 'text-emerald-400', bg: 'bg-emerald-400/20', glow: 'shadow-emerald-400/50', border: 'border-emerald-400/50' },
  { id: 'slow', label: 'Slow', icon: '🐢', color: 'text-orange-400', bg: 'bg-orange-400/20', glow: 'shadow-orange-400/50', border: 'border-orange-400/50' },
];

const DEFAULT_EMOTION_DATA = {
  emotions: ['calm'],
  tone: 'normal',
  energy: 0.5,
  speed: 1.0,
};

const detectLocalKeywords = (text: string) => {
  const data = { ...DEFAULT_EMOTION_DATA };
  
  if (text.includes('!')) {
    data.emotions = ['confident'];
    data.energy = 0.8;
  }
  if (text.includes('?')) {
    data.emotions = ['nervous'];
    data.tone = 'questioning';
  }
  if (text.includes('...')) {
    data.emotions = ['sad'];
    data.energy = 0.3;
  }
  if (text === text.toUpperCase() && text.length > 3) {
    data.emotions = ['shouting'];
    data.energy = 0.9;
  }
  
  return data;
};

const cleanTextForTTS = (text: string) => {
  return text
    .replace(/^Speaker\s*\d+\s*(\([^)]*\))?\s*:\s*/gim, "") // Remove "Speaker 1 (angry): "
    .replace(/^Default Speaker\s*:\s*/gim, "") // Remove "Default Speaker: "
    .replace(/^\([^)]*\)\s*/gm, "") // Remove leading "(shouting) "
    .replace(/\([^)]+\)/g, "") // Remove any remaining (metadata)
    .replace(/\[[^\]]+\]/g, "") // Remove any remaining [metadata]
    .trim();
};

interface Speaker {
  id: string;
  name: string;
  voice: string;
  engine: string;
  refAudioFile: File | null;
  refAudioBase64: string | null;
  color: string;
  defaultEmotion?: string;
  emotionSensitivity?: number;
}

interface Subtitle {
  id: number;
  startTime: number;
  endTime: number;
  text: string;
  cleanText: string;
  speakerId: string;
  audioUrl?: string; // object URL to the generated WAV
  audioBlob?: Blob; // blob of the generated audio
  audioDuration?: number; // duration of the generated audio in seconds
  audioTrimStart?: number; // offset from beginning (seconds)
  audioTrimEnd?: number; // point where it stops (seconds)
  isGenerating?: boolean;
  voice: string;
  engine?: string;
  refAudioFile?: File;
  refAudioBase64?: string;
  audioStartTime?: number;
  isLinked?: boolean;
  waveformPeaks?: number[];
  audioBufferId?: string;
  emotions?: string[];
  tone?: string;
  energy?: number;
  speed?: number;
  emotionDetected?: boolean;
  emotionStatus?: 'detecting' | 'detected' | 'failed' | 'fallback';
}

// Convert "00:00:01,000" to seconds
function parseTime(time: string): number {
  if (!time) return 0;
  const [hms, ms = "0"] = time.trim().replace(".", ",").split(",");
  const parts = hms.split(":").map(Number);

  let h = 0, m = 0, s = 0;

  if (parts.length === 3) {
    [h, m, s] = parts;
  } else if (parts.length === 2) {
    [m, s] = parts;
  } else {
    [s] = parts;
  }

  return h * 3600 + m * 60 + s + Number(ms.padEnd(3, "0").slice(0, 3)) / 1000;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return "00:00:00";

  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function getAudioDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const audio = new Audio(url);
    audio.onloadedmetadata = () => {
      resolve(audio.duration);
    };
    audio.onerror = () => {
      resolve(0);
    };
  });
}
import { generateWaveformWorker as generateWaveform, globalWaveformCache } from './patches/fixes';





async function autoTrimSilence(url: string, threshold: number = 0.015): Promise<{ start: number; end: number }> {
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    
    let firstSample = 0;
    for (let i = 0; i < channelData.length; i++) {
        if (Math.abs(channelData[i]) > threshold) {
            firstSample = i;
            break;
        }
    }
    
    let lastSample = channelData.length - 1;
    for (let i = channelData.length - 1; i >= 0; i--) {
        if (Math.abs(channelData[i]) > threshold) {
            lastSample = i;
            break;
        }
    }
    
    const start = firstSample / sampleRate;
    const end = lastSample / sampleRate;
    
    await audioContext.close();
    return { start, end };
  } catch (e) {
    console.warn('Failed to auto trim silence', e);
    return { start: 0, end: 0 };
  }
}

function detectSpeaker(text: string): { speakerName: string; cleanText: string } {
  // Priority patterns: Speaker 1:, Default Speaker:, Character Name:
  const patterns = [
    /^(Speaker\s*\d+)\s*[:\s]*(.*)/si,
    /^(Default Speaker)\s*[:\s]*(.*)/si,
    /^\[([^\]]+)\][:\s]*(.*)/s,    
    /^\(([^)]+)\)[:\s]*(.*)/s,    
    /^([^:\n]+):[:\s]*(.*)/s,    
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      // If it's a generic colon match, check if it looks like a name (not too long)
      if (pattern.source.includes('^([^:\n]+):') && match[1].length > 25) continue;
      return { speakerName: match[1].trim(), cleanText: match[2].trim() };
    }
  }

  return { speakerName: 'Default Speaker', cleanText: text.trim() };
}

// Parse standard SRT format
function parseSRT(srt: string): Subtitle[] {
  const normalized = srt.replace(/\r\n/g, '\n');
  const blocks = normalized.split('\n\n');
  const subtitles: Subtitle[] = [];

  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length >= 3) {
      const id = parseInt(lines[0], 10);
      const timeMatch = lines[1].match(/(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/);
      if (timeMatch) {
        const startTime = parseTime(timeMatch[1]);
        const endTime = parseTime(timeMatch[2]);
        const text = lines.slice(2).join(' ').trim();
        if (text) {
          const { speakerName, cleanText } = detectSpeaker(text);
          subtitles.push({ 
            id, 
            startTime, 
            endTime, 
            text, 
            cleanText,
            speakerId: speakerName, // Initially use speakerName as ID
            voice: 'default', 
            audioStartTime: startTime, 
            isLinked: true 
          });
        }
      }
    }
  }
  return subtitles;
}

// Convert PCM16 to WAV
function encodeWAV(samples: Int16Array, sampleRate: number = 24000): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    view.setInt16(offset, samples[i], true);
  }

  return new Blob([view], { type: 'audio/wav' });
}

// Memoized Timeline Clip for better performance
interface TimelineClipProps {
  id: number;
  type: 'subtitle' | 'audio';
  startTime: number;
  endTime: number;
  text?: string;
  zoomLevel: number;
  audioUrl?: string;
  waveformPeaks?: number[];
  audioTrimStart?: number;
  audioTrimEnd?: number;
  audioDuration?: number;
  engine?: string;
  voice?: string;
  isActive: boolean;
  isSelected: boolean;
  isDragging?: boolean;
  onSelect: () => void;
  onAutoTrim?: (id: number) => void;
  onDragStart: (e: React.PointerEvent, id: number, type: any) => void;
  onDragMove: (e: React.PointerEvent) => void;
  onDragEnd: (e: React.PointerEvent) => void;
  isOverlapping?: boolean;
  emotions?: string[];
  laneTopPct?: number;
  laneHeightPct?: number;
}

const TimelineClip = React.memo(({
  id, type, startTime, endTime, text, zoomLevel, audioUrl, waveformPeaks,
  audioTrimStart, audioTrimEnd, audioDuration, engine, voice,
  isActive, isSelected, isDragging, onSelect, onAutoTrim, onDragStart, onDragMove, onDragEnd, isOverlapping,
  emotions, laneTopPct, laneHeightPct
}: TimelineClipProps) => {
  const [localWaveform, setLocalWaveform] = useState<number[] | undefined>(waveformPeaks);

  // Guard against invalid or crash-inducing values
  const safeStartTime = Number.isFinite(startTime) ? startTime : 0;
  const safeEndTime = Number.isFinite(endTime) ? endTime : safeStartTime + 0.1;
  const duration = Math.max(0.01, safeEndTime - safeStartTime);
  
  const left = safeStartTime * zoomLevel;
  const width = Math.max(2, duration * zoomLevel);

  useEffect(() => {
    // If we have peaks, use them
    if (waveformPeaks && waveformPeaks.length > 0) {
      setLocalWaveform(waveformPeaks);
      if (audioUrl) globalWaveformCache.set(audioUrl, waveformPeaks);
    } 
    // If peaks are missing but we have a URL, check global cache or rebuild
    else if (audioUrl) {
       const cached = globalWaveformCache.get(audioUrl);
       if (cached) {
         setLocalWaveform(cached);
       } else if (!localWaveform || localWaveform.length === 0) {
         console.log(`[Waveform] Rebuilding for clip ${id}...`);
         generateWaveform(audioUrl).then(peaks => {
           if (peaks && peaks.length > 0) {
             setLocalWaveform(peaks);
           }
         });
       }
    }
  }, [waveformPeaks, audioUrl, id]);

  const getClipColor = () => {
    if (type === 'subtitle') {
      if (isActive) return 'bg-amber-400 border-amber-300 text-amber-950 ring-2 ring-amber-400/50';
      if (audioUrl) return 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300';
      return 'bg-slate-800/50 border-slate-700 text-slate-400';
    } else {
      if (isOverlapping) return 'bg-rose-500/30 border-rose-400 ring-rose-500/50';
      if (isActive) return 'bg-purple-900 border-purple-400 ring-1 ring-white/30';

      if (emotions && emotions.length > 0) {
        const config = EMOTIONS.find(e => e.id === emotions[0]);
        if (config) {
          return `${config.bg} border-current ring-1 ring-current/20 ${config.color} ${config.glow}`;
        }
      }

      const colors: Record<string, string> = {
        alloy: 'bg-blue-500/20 border-blue-500/60 text-blue-300',
        echo: 'bg-indigo-500/20 border-indigo-500/60 text-indigo-300',
        fable: 'bg-purple-500/20 border-purple-500/60 text-purple-300',
        nova: 'bg-pink-500/20 border-pink-500/60 text-pink-300',
        shimmer: 'bg-orange-500/20 border-orange-500/60 text-orange-300'
      };
      return (voice && colors[voice]) || 'bg-violet-500/20 border-violet-500/60 text-violet-300';
    }
  };

  const handleResetTrim = (e: React.MouseEvent) => {
    e.stopPropagation();
    // This will be handled by the parent component via a custom event or a dedicated prop if needed
    // But for now we can just use a DOM event or the parent's updateSubtitles
    const event = new CustomEvent('reset-trim', { detail: { id, type } });
    window.dispatchEvent(event);
  };

  return (
    <div 
      className={`absolute rounded-lg border cursor-grab active:cursor-grabbing transition-all timeline-clip ${getClipColor()} ${isSelected ? 'ring-2 ring-white z-50' : 'z-10'} group overflow-hidden`}
      style={{ 
        left, 
        width,
        ...(laneTopPct !== undefined && laneHeightPct !== undefined
          ? { top: `${laneTopPct + 2}%`, height: `${laneHeightPct - 4}%`, minHeight: '24px' }
          : { top: '10%', height: '80%', minHeight: '28px' }),
        opacity: isDragging ? 0.7 : 1,
        transform: isDragging ? 'scale(1.02)' : 'none',
        filter: isDragging ? 'drop-shadow(0 0 8px rgba(251,191,36,0.4))' : 'drop-shadow(0 0 0px transparent)',
        transition: isDragging ? 'none' : 'all 0.2s ease-out'
      }}
      onPointerDown={(e) => {
        onSelect();
        onDragStart(e, id, type);
      }}
      onPointerMove={onDragMove}
      onPointerUp={onDragEnd}
      onDoubleClick={handleResetTrim}
    >
      {type === 'subtitle' && (
        <>
          <div className="absolute inset-0 px-3 py-1 flex items-center justify-center overflow-hidden pointer-events-none">
            <span className="text-[11px] font-semibold truncate">{text}</span>
          </div>
          
          {/* Left Trim Handle - Improved */}
          <div 
             className="absolute left-0 top-0 bottom-0 w-3 hover:bg-white/30 cursor-ew-resize z-20 group hover:shadow-lg hover:shadow-white/20"
             onPointerDown={(e) => { e.stopPropagation(); onDragStart(e, id, 'trim-text-start'); }}
          >
            <div className="absolute inset-y-2 left-1 w-0.5 bg-white/50 group-hover:bg-white opacity-0 group-hover:opacity-100 transition-all" />
            <div className="absolute inset-y-2 left-[6px] w-0.5 bg-white/50 group-hover:bg-white opacity-0 group-hover:opacity-100 transition-all" />
          </div>
          
          {/* Right Trim Handle - Improved */}
          <div 
             className="absolute right-0 top-0 bottom-0 w-3 hover:bg-white/30 cursor-ew-resize z-20 group hover:shadow-lg hover:shadow-white/20"
             onPointerDown={(e) => { e.stopPropagation(); onDragStart(e, id, 'trim-text-end'); }}
          >
            <div className="absolute inset-y-2 right-1 w-0.5 bg-white/50 group-hover:bg-white opacity-0 group-hover:opacity-100 transition-all" />
            <div className="absolute inset-y-2 right-[6px] w-0.5 bg-white/50 group-hover:bg-white opacity-0 group-hover:opacity-100 transition-all" />
          </div>
        </>
      )}

      {type === 'audio' && (
        <>
          {/* Waveform with Gradient */}
          {(localWaveform && localWaveform.length > 0) ? (
            <div 
              className="absolute inset-0 h-full overflow-hidden pointer-events-none"
            >
              <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/5 z-10" />
              <div
                className="absolute h-full"
                style={{
                  left: Number.isFinite(audioTrimStart) ? -(audioTrimStart! * zoomLevel) : 0,
                  width: Number.isFinite(audioDuration) ? (audioDuration! * zoomLevel) : (duration * zoomLevel)
                }}
              >
                <svg className="w-full h-full" preserveAspectRatio="none" viewBox={`0 0 ${localWaveform.length} 100`}>
                  <defs>
                    <linearGradient id={`waveGradient-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="currentColor" stopOpacity="0.6" />
                      <stop offset="100%" stopColor="currentColor" stopOpacity="0.2" />
                    </linearGradient>
                  </defs>
                  <path 
                    d={localWaveform.map((v, i) => `M${i},${50 - v * 45} L${i},${50 + v * 45}`).join(' ')} 
                    stroke={`url(#waveGradient-${id})`}
                    strokeWidth="1.5" 
                  />
                </svg>
              </div>

              {/* Hatched overlay for trimmed regions */}
              {Number.isFinite(audioTrimStart) && audioTrimStart! > 0 && (
                <div
                  className="absolute top-0 bottom-0 opacity-40"
                  style={{
                    left: 0,
                    width: `${audioTrimStart! * zoomLevel}px`,
                    background: 'repeating-linear-gradient(45deg, rgba(0,0,0,0.4) 0px, rgba(0,0,0,0.4) 1px, transparent 1px, transparent 3px)'
                  }}
                />
              )}
              {Number.isFinite(audioTrimEnd) && Number.isFinite(audioDuration) && audioTrimEnd! < audioDuration! && (
                <div
                  className="absolute top-0 bottom-0 opacity-40"
                  style={{
                    right: 0,
                    width: `${(audioDuration! - audioTrimEnd!) * zoomLevel}px`,
                    background: 'repeating-linear-gradient(45deg, rgba(0,0,0,0.4) 0px, rgba(0,0,0,0.4) 1px, transparent 1px, transparent 3px)'
                  }}
                />
              )}
            </div>
          ) : audioUrl ? (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-50">
              <span className="text-[8px] animate-pulse">Building waveform...</span>
            </div>
          ) : null}

          {/* Duration label inside clip */}
          <div className="absolute inset-0 px-2 py-1 flex items-center justify-between pointer-events-none z-20">
            <span className="text-[9px] font-bold text-white/80 bg-black/40 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">{duration.toFixed(2)}s</span>
            {engine && voice && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/30 text-amber-300 border border-amber-500/50">{engine}</span>
              </div>
            )}
          </div>
          
          {/* Overlap Warning Badge */}
          {isOverlapping && (
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-rose-500/80 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full border border-rose-400/50 shadow-lg shadow-rose-500/30 whitespace-nowrap z-30">
              ⚠ Overlap
            </div>
          )}

          {/* Left Trim Handle - Improved */}
          <div 
             className="absolute left-0 top-0 bottom-0 w-3 hover:bg-white/20 cursor-ew-resize z-20 group hover:shadow-lg hover:shadow-white/20"
             onPointerDown={(e) => { e.stopPropagation(); onDragStart(e, id, 'trim-audio-start'); }}
          >
            <div className="absolute inset-y-2 left-1 w-0.5 bg-white/50 group-hover:bg-white opacity-0 group-hover:opacity-100 transition-all" />
            <div className="absolute inset-y-2 left-[6px] w-0.5 bg-white/50 group-hover:bg-white opacity-0 group-hover:opacity-100 transition-all" />
          </div>

          {/* Right Trim Handle - Improved */}
          <div 
             className="absolute right-0 top-0 bottom-0 w-3 hover:bg-white/20 cursor-ew-resize z-20 group hover:shadow-lg hover:shadow-white/20"
             onPointerDown={(e) => { e.stopPropagation(); onDragStart(e, id, 'trim-audio-end'); }}
          >
            <div className="absolute inset-y-2 right-1 w-0.5 bg-white/50 group-hover:bg-white opacity-0 group-hover:opacity-100 transition-all" />
            <div className="absolute inset-y-2 right-[6px] w-0.5 bg-white/50 group-hover:bg-white opacity-0 group-hover:opacity-100 transition-all" />
          </div>

          {onAutoTrim && (
            <button 
              onClick={(e) => { e.stopPropagation(); onAutoTrim(id); }}
              className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-[9px] text-slate-300 hover:text-white hover:bg-slate-700 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-30 flex items-center gap-1 active:scale-95 shadow-lg"
              title="Auto Trim Silence"
            >
              <ListChecks className="w-3 h-3" />
              Auto Trim
            </button>
          )}
        </>
      )}
    </div>
  );
});

// Memoized Sidebar List Item for better performance
interface SubtitleListItemProps {
  sub: Subtitle;
  isActive: boolean;
  isBatchEditMode: boolean;
  selectedSubtitles: Set<number>;
  previewingId: number | null;
  isGeneratingAll: boolean;
  ttsEngine: string;
  defaultVoxCPMVoice: string;
  referenceAudioFile: File | null;
  referenceAudioBase64: string | null;
  handleToggleLink: (id: number) => void;
  toggleSubtitleSelection: (id: number) => void;
  handlePreviewAudio: (e: React.MouseEvent, sub: Subtitle) => void;
  handleGenerateSingle: (e: React.MouseEvent, sub: Subtitle) => void;
  handleEngineChange: (id: number, engine: string) => void;
  handleVoiceChange: (id: number, voice: string) => void;
  handleSubReferenceAudioUpload: (id: number, e: React.ChangeEvent<HTMLInputElement>) => void;
  playAudioFile: (file: File) => void;
  updateSubtitles: (updater: Subtitle[] | ((prev: Subtitle[]) => Subtitle[]), skipHistory?: boolean) => void;
  videoRef: React.RefObject<HTMLVideoElement>;
}

const SubtitleListItem = React.memo(({ 
  sub, 
  isActive, 
  isBatchEditMode, 
  selectedSubtitles, 
  previewingId,
  isGeneratingAll,
  ttsEngine,
  defaultVoxCPMVoice,
  referenceAudioFile,
  referenceAudioBase64,
  handleToggleLink,
  toggleSubtitleSelection,
  handlePreviewAudio,
  handleGenerateSingle,
  handleEngineChange,
  handleVoiceChange,
  handleSubReferenceAudioUpload,
  playAudioFile,
  updateSubtitles,
  videoRef
}: SubtitleListItemProps) => {
  return (
    <div 
      className={`p-3 border-b border-slate-800/50 transition-colors cursor-pointer ${isActive && !isBatchEditMode ? 'bg-slate-800/30 border-l-2 border-l-amber-500' : 'hover:bg-slate-800/20'} ${selectedSubtitles.has(sub.id) ? 'bg-amber-900/20 border-l-2 border-l-amber-500' : ''}`}
      onClick={() => {
        if (isBatchEditMode) {
          toggleSubtitleSelection(sub.id);
        } else {
          if (videoRef.current) {
            videoRef.current.currentTime = sub.startTime;
          }
        }
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <button 
            onClick={(e) => { e.stopPropagation(); handleToggleLink(sub.id); }}
            className={`p-1 rounded transition ${sub.isLinked === false ? 'bg-rose-500/10 text-rose-500' : 'text-slate-500 hover:text-slate-300'}`}
            title={sub.isLinked === false ? "Unlinked" : "Linked"}
          >
            {sub.isLinked === false ? <Link2Off className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
          </button>
          {isBatchEditMode && (
            <input 
              type="checkbox" 
              checked={selectedSubtitles.has(sub.id)}
              readOnly
              className="w-3 h-3 rounded border-slate-700 bg-slate-900 checked:bg-amber-500"
            />
          )}
          <span className={`text-[10px] ${isActive && !isBatchEditMode ? 'text-amber-500' : 'text-slate-500'}`}>
            {formatTime(sub.startTime)}
            {sub.speakerId && (
              <span className="ml-2 px-1.5 py-0.5 rounded-sm bg-slate-800 text-[9px] uppercase font-bold border border-slate-700 max-w-[80px] truncate inline-block align-middle" title={sub.speakerId}>
                {sub.speakerId}
              </span>
            )}
          </span>
          
          {/* Emotion Badges */}
          <div className="flex items-center gap-1">
            {sub.emotionStatus === 'detecting' && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 flex items-center gap-1 animate-pulse border border-amber-500/20">
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                AI
              </span>
            )}
            {sub.emotionStatus === 'failed' && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500 border border-red-500/20" title="AI detection failed">
                ERROR
              </span>
            )}
            {sub.emotionStatus === 'fallback' && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20" title="Using local logic fallback">
                AUTO
              </span>
            )}
            {sub.emotions?.map(eid => {
              const config = EMOTIONS.find(e => e.id === eid);
              if (!config) return null;
              return (
                <span 
                  key={eid} 
                  className={`text-[9px] px-1.5 py-0.5 rounded-full flex items-center gap-1 font-bold border border-current/20 ${config.bg} ${config.color}`}
                  title={config.label}
                >
                  <span className="text-[10px] leading-none">{config.icon}</span>
                  <span className="uppercase tracking-tighter">{eid}</span>
                </span>
              );
            })}
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          {sub.audioUrl && sub.audioDuration && (sub.audioDuration > sub.endTime - sub.startTime + 0.2) && (
            <span className="text-[10px] text-rose-500 font-bold bg-rose-500/10 px-1 rounded animate-pulse" title="Audio is longer than subtitle clip">
              Drift!
            </span>
          )}
          {sub.isGenerating ? (
            <span className="text-[10px] text-amber-500 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin"/>
            </span>
          ) : sub.audioUrl ? (
             <div className="flex items-center gap-2">
              {isActive && <span className="text-[10px] text-emerald-400">Playing</span>}
              <button 
                onClick={(e) => handlePreviewAudio(e, sub)}
                className="text-amber-500 hover:text-amber-400 transition-colors p-1 hover:bg-slate-800 rounded"
                title="Preview Audio"
              >
                {previewingId === sub.id ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              </button>
              <a href={sub.audioUrl} download={`sub_${sub.id}.wav`} className="text-slate-500 hover:text-white transition-colors p-1 hover:bg-slate-800 rounded" title="Download WAV" onClick={(e) => e.stopPropagation()}>
                <Download className="w-3.5 h-3.5" />
              </a>
            </div>
          ) : (
            <button
                onClick={(e) => handleGenerateSingle(e, sub)}
                disabled={isGeneratingAll}
                className="text-[10px] text-slate-400 hover:text-amber-500 transition-colors px-2 py-1 border border-slate-700 hover:border-amber-500/50 rounded bg-slate-800 disabled:opacity-50"
            >
                Generate
            </button>
          )}
        </div>
      </div>
      <textarea 
        value={sub.text}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
           updateSubtitles(prev => prev.map(s => s.id === sub.id ? { ...s, text: e.target.value } : s));
        }}
        className={`w-full bg-slate-900/50 border border-slate-700/50 rounded-md p-2 text-sm leading-relaxed mb-2 focus:outline-none focus:border-amber-500/50 focus:bg-slate-900 resize-y min-h-[60px] custom-scrollbar transition-colors ${isActive ? 'text-slate-200 font-medium' : 'text-slate-400 focus:text-slate-200'}`}
        placeholder="Subtitle text..."
      />
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar scrollbar-hide no-scrollbar max-w-[140px]">
           {EMOTIONS.map(emo => (
             <button
               key={emo.id}
               onClick={(e) => {
                 e.stopPropagation();
                 const current = sub.emotions || [];
                 const next = current.includes(emo.id) 
                   ? current.filter(id => id !== emo.id)
                   : [...current, emo.id];
                 updateSubtitles(prev => prev.map(s => s.id === sub.id ? { ...s, emotions: next } : s));
               }}
               className={`shrink-0 w-6 h-6 flex items-center justify-center rounded-full border transition-all ${sub.emotions?.includes(emo.id) ? `${emo.bg} ${emo.border} ${emo.glow}` : 'border-slate-800 bg-slate-950/50 grayscale opacity-50 hover:grayscale-0 hover:opacity-100'}`}
               title={emo.label}
             >
               <span className="text-xs">{emo.icon}</span>
             </button>
           ))}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={sub.engine || 'voxcpm'}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => handleEngineChange(sub.id, e.target.value)}
          className="bg-slate-900 text-[10px] text-slate-400 border border-slate-700 rounded px-2 py-1 outline-none hover:border-slate-500/50 transition-colors"
        >
          <option value="voxcpm">VoxCPM</option>
          <option value="gemini">Gemini</option>
          <option value="google-free">Google Free</option>
        </select>
        {(() => {
          const eng = (!sub.engine) ? 'voxcpm' : sub.engine;
          return eng === 'gemini' ? (
          <select 
            value={sub.voice} 
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => handleVoiceChange(sub.id, e.target.value)}
            className="bg-slate-900 text-[10px] text-slate-400 border border-slate-700 rounded px-2 py-1 outline-none hover:border-amber-500/50 transition-colors"
          >
            <option value="default">Global Default</option>
            {TTS_VOICES.map((v) => (
              <option key={v.id} value={v.id}>{v.label}</option>
            ))}
          </select>
        ) : eng === 'voxcpm' ? (
          <div className="flex items-center gap-2">
            <label className={`text-[10px] text-purple-400 border border-slate-700 rounded px-2 py-1 ${!sub.refAudioFile ? 'hover:border-purple-500 cursor-pointer' : ''} bg-slate-900 transition-colors flex items-center gap-1 min-h-[26px]`}>
               <Music className="w-3 h-3 shrink-0" />
               {sub.refAudioFile ? (
                 <div className="flex items-center gap-1.5 overflow-hidden">
                   <span className="truncate max-w-[50px] inline-block" title={sub.refAudioFile.name}>{sub.refAudioFile.name}</span>
                   <button 
                      className="hover:text-slate-200 text-slate-400 transition-colors ml-1 p-0.5 rounded hover:bg-slate-700" 
                      onClick={(e) => { 
                        e.preventDefault(); 
                        e.stopPropagation(); 
                        playAudioFile(sub.refAudioFile as File); 
                      }}
                      title="Play Subtitle Ref Audio"
                   >
                     <Play className="w-3 h-3 fill-current" />
                   </button>
                   <button 
                      className="hover:text-red-400 text-slate-400 transition-colors p-0.5 rounded hover:bg-red-500/20" 
                      onClick={(e) => { 
                        e.preventDefault(); 
                        e.stopPropagation(); 
                        updateSubtitles(prev => prev.map(s => s.id === sub.id ? { ...s, refAudioFile: undefined, refAudioBase64: undefined } : s)); 
                      }}
                      title="Remove Subtitle Ref Audio"
                   >
                     <X className="w-3 h-3" />
                   </button>
                 </div>
               ) : (
                 <span>Add Ref</span>
               )}
               {!sub.refAudioFile && <input type="file" accept="audio/*" onClick={(e) => e.stopPropagation()} onChange={(e) => handleSubReferenceAudioUpload(sub.id, e)} className="hidden" />}
            </label>
            <select
              value={sub.voice === 'default' ? '' : sub.voice}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => handleVoiceChange(sub.id, e.target.value || 'default')}
              className="w-32 bg-slate-900 text-[10px] text-purple-400/80 border border-slate-700 rounded px-2 py-1 outline-none hover:border-purple-500/50 transition-colors"
              title={(sub.refAudioFile || referenceAudioFile) ? "Ref Text (Auto if empty)" : `Prompt Text (Default: ${defaultVoxCPMVoice})`}
            >
              <option value="">Global Default</option>
              {VOXCPM_VOICES.map((v) => (
                <option key={v.id} value={v.id}>{v.label}</option>
              ))}
            </select>
          </div>
        ) : (
          <span className="text-[10px] text-slate-600 italic">Default Voice</span>
        );
        })()}
      </div>
    </div>
  </div>
  );
});

const SpeakerManager = ({ speakers, updateSpeaker, onAutoDetect, applySpeakerToAll, subtitles, ttsEngine, defaultGeminiVoice, defaultVoxCPMVoice }: any) => {
  // calculate line counts
  const speakerStats = useMemo(() => {
    const stats: Record<string, number> = {};
    subtitles.forEach((s: any) => {
      const id = s.speakerId || 'Default Speaker';
      stats[id] = (stats[id] || 0) + 1;
    });
    return stats;
  }, [subtitles]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Speakers ({speakers.length})</h3>
        <button 
          onClick={onAutoDetect}
          className="text-[10px] bg-slate-800 hover:bg-slate-700 text-amber-500 px-2 py-1 rounded border border-slate-700 flex items-center gap-1 transition-colors"
        >
          <ListChecks className="w-3 h-3" />
          Auto Detect
        </button>
      </div>

      <div className="space-y-3">
        {speakers.map((speaker: any) => (
          <div key={speaker.id} className="p-3 bg-slate-900 border border-slate-800 rounded-lg space-y-3 group">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-4 rounded-full" style={{ backgroundColor: speaker.color }} />
                <span className="text-sm font-bold text-slate-100">{speaker.name}</span>
                <span className="text-[10px] text-slate-500 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                  {speakerStats[speaker.id] || 0} Lines
                </span>
              </div>
              <button
                onClick={() => applySpeakerToAll(speaker)}
                className="text-[9px] text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-1.5 py-0.5 rounded transition-colors uppercase font-bold"
                title="Apply these voice settings to all lines assigned to this speaker"
              >
                Apply to all
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2">
               <div className="space-y-1">
                 <label className="text-[10px] text-slate-500 uppercase font-bold text-[9px]">Voice & Engine</label>
                 <div className="flex gap-1">
                   <select 
                      value={speaker.engine || 'voxcpm'}
                      onChange={(e) => updateSpeaker(speaker.id, { engine: e.target.value })}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-[11px] text-slate-200 outline-none focus:border-amber-500/50"
                   >
                     <option value="voxcpm">VoxCPM</option>
                     <option value="google-free">Google Free</option>
                     <option value="gemini">Gemini</option>
                   </select>

                   <input 
                      type="text"
                      list={speaker.engine === 'gemini' ? 'gemini-voices' : speaker.engine === 'voxcpm' ? 'voxcpm-voices' : ''}
                      value={speaker.voice}
                      onChange={(e) => updateSpeaker(speaker.id, { voice: e.target.value })}
                      placeholder={speaker.engine === 'google-free' ? 'km' : speaker.engine === 'gemini' ? defaultGeminiVoice : speaker.engine === 'voxcpm' ? defaultVoxCPMVoice : 'Voice ID'}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-[11px] text-slate-200 outline-none focus:border-amber-500/50"
                   />
                 </div>
               </div>

               <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 uppercase font-bold text-[9px]">Default Emotion</label>
                    <select
                      value={speaker.defaultEmotion || ''}
                      onChange={(e) => updateSpeaker(speaker.id, { defaultEmotion: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-[11px] text-slate-200 outline-none focus:border-amber-500/50"
                    >
                      <option value="">None</option>
                      {EMOTIONS.map(emo => (
                        <option key={emo.id} value={emo.id}>{emo.icon} {emo.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 uppercase font-bold text-[9px]">Sensitivity: {(speaker.emotionSensitivity ?? 0.5).toFixed(1)}</label>
                    <input 
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={speaker.emotionSensitivity ?? 0.5}
                      onChange={(e) => updateSpeaker(speaker.id, { emotionSensitivity: parseFloat(e.target.value) })}
                      className="w-full accent-amber-500 h-4 bg-slate-950 rounded cursor-pointer"
                    />
                  </div>
               </div>

               <div className="space-y-1">
                 <label className="text-[10px] text-slate-500 uppercase font-bold text-[9px]">Reference Audio</label>
                 <div 
                    className="relative border border-dashed border-slate-800 hover:border-amber-500/50 hover:bg-slate-800/30 transition-colors rounded p-2 flex flex-col items-center justify-center group/drop cursor-pointer min-h-[40px]"
                 >
                    {speaker.refAudioFile ? (
                      <div className="flex items-center gap-2 w-full truncate px-1">
                        <Music className="w-3 h-3 text-amber-500 shrink-0" />
                        <span className="text-[10px] text-slate-300 truncate font-mono">{speaker.refAudioFile.name}</span>
                        <button 
                          onClick={(e) => { e.stopPropagation(); updateSpeaker(speaker.id, { refAudioFile: null, refAudioBase64: null }); }}
                          className="ml-auto p-0.5 hover:text-red-400 text-slate-500"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-500 group-hover/drop:text-slate-300">Drop Ref Audio</span>
                    )}
                    <input 
                      type="file" 
                      accept="audio/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = () => {
                             const base64 = (reader.result as string).split(',')[1];
                             updateSpeaker(speaker.id, { refAudioFile: file, refAudioBase64: base64 });
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                 </div>
               </div>
            </div>
          </div>
        ))}

        {speakers.length === 0 && (
          <div className="text-center py-12 px-4 bg-slate-900/20 border border-white/5 border-dashed rounded-lg">
            <p className="text-[11px] text-slate-500 leading-relaxed italic">
              No speakers detected.<br/>
              Use <span className="text-slate-400 font-mono">Speaker: Text</span> format<br/>
              or click Auto Detect.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// Error Boundary to prevent full app crash
interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-8 bg-[#020617] text-white h-screen">
          <AlertTriangle className="w-12 h-12 text-amber-500 mb-4" />
          <h2 className="text-xl font-bold mb-2 text-slate-100"> something went wrong</h2>
          <p className="text-slate-400 mb-6 text-center max-w-md">
            The application encountered an unexpected error. You can try to reload or dismiss the error if possible.
          </p>
          <pre className="p-4 bg-black/40 rounded border border-white/5 text-xs text-red-400 max-w-full overflow-auto mb-6 font-mono">
            {this.state.error?.message || "Unknown error"}
          </pre>
          <div className="flex gap-4">
             <button 
                onClick={() => window.location.reload()}
                className="px-6 py-2 bg-amber-500 text-slate-950 font-bold rounded-lg hover:bg-amber-400 transition-colors"
              >
                Reload Application
              </button>
              <button 
                onClick={() => this.setState({ hasError: false, error: null })}
                className="px-6 py-2 bg-slate-800 text-slate-200 font-bold rounded-lg hover:bg-slate-700 transition-colors"
              >
                Attempt Dismiss
              </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [timelineCurrentTime, setTimelineCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [isTranscodingVideo, setIsTranscodingVideo] = useState(false);
  const [showMKVWarning, setShowMKVWarning] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const isScrubbingRef = useRef(false);
  const isTimelinePlayingRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const playbackStartWallTimeRef = useRef<number>(0);
  const timelineStartTimeRef = useRef<number>(0);
  const lastScrollTriggerRef = useRef<number>(0);
  const activeAudioRefs = useRef<Map<number, HTMLAudioElement>>(new Map());
  const [videoVolume, setVideoVolume] = useState(0.1);
  const [dubVolume, setDubVolume] = useState(1.0);
  const [ttsEngine, setTtsEngine] = useState<'gemini' | 'google-free' | 'voxcpm'>(() => (localStorage.getItem('tts_engine') as any) || 'voxcpm');
  const [defaultGeminiVoice, setDefaultGeminiVoice] = useState<'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Aoede'>(() => (localStorage.getItem('default_gemini_voice') as any) || 'Puck');
  const [defaultVoxCPMVoice, setDefaultVoxCPMVoice] = useState(() => localStorage.getItem('default_voxcpm_voice') || 'khmer-male-1');
  const [leftPanelTab, setLeftPanelTab] = useState<'files' | 'speakers'>('files');

  const [referenceAudioFile, setReferenceAudioFile] = useState<File | null>(null);
  const [referenceAudioBase64, setReferenceAudioBase64] = useState<string | null>(null);

  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  // ── Auto-save / restore ──────────────────────────────────────────────────
  // Subtitles are serialised to localStorage on every change (debounced 2s).
  // Audio blobs / File objects can't be serialised, so only text/timing/meta
  // survive a reload — that is still enough to avoid losing hours of editing.
  const [subtitles, setSubtitles] = useState<Subtitle[]>(() => {
    try {
      const saved = localStorage.getItem('autosave_subtitles');
      if (saved) {
        const parsed: Subtitle[] = JSON.parse(saved);
        // Strip un-serialisable fields that will be stale anyway
        return parsed.map(s => ({
          ...s,
          audioUrl: undefined,
          audioBlob: undefined,
          waveformPeaks: undefined,
          isGenerating: false,
          refAudioFile: undefined,
        }));
      }
    } catch { /* corrupt data – start fresh */ }
    return [];
  });

  const [speakers, setSpeakers] = useState<Speaker[]>(() => {
    try {
      const saved = localStorage.getItem('autosave_speakers');
      if (saved) {
        const parsed: Speaker[] = JSON.parse(saved);
        return parsed.map(s => ({ ...s, refAudioFile: null, refAudioBase64: null }));
      }
    } catch {}
    return [];
  });

  // ── Workspace persistence system ─────────────────────────────────────────
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string>('');
  const [currentWorkspace, setCurrentWorkspace] = useState<WorkspaceData | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const workspaceAutoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize workspace system on mount
  useEffect(() => {
    (async () => {
      try {
        const activeId = await workspaceLib.getOrCreateActiveWorkspace();
        setCurrentWorkspaceId(activeId);
        const workspace = await workspaceLib.loadWorkspace(activeId);
        if (workspace) {
          setCurrentWorkspace(workspace);
          // Restore workspace state
          setSubtitles(workspace.subtitles);
          setSpeakers(workspace.speakers);
          setTtsEngine(workspace.ttsSettings.ttsEngine);
          setDefaultGeminiVoice(workspace.ttsSettings.defaultGeminiVoice as any);
          setDefaultVoxCPMVoice(workspace.ttsSettings.defaultVoxCPMVoice);
          if (workspace.videoBlob) {
            const videoUrl = URL.createObjectURL(workspace.videoBlob);
            setVideoUrl(videoUrl);
            setVideoFile(new File([workspace.videoBlob], workspace.metadata.videoFileName));
          }
          setTimelineCurrentTime(workspace.uiState.timelineCurrentTime);
          setIsDirty(false);
        }
      } catch (error) {
        console.error('Failed to initialize workspace:', error);
      }
    })();
  }, []);

  // Mark as dirty when subtitles or speakers change
  useEffect(() => {
    if (currentWorkspace) {
      setIsDirty(true);
    }
  }, [subtitles, speakers, ttsEngine, defaultGeminiVoice, defaultVoxCPMVoice, currentWorkspace]);

  // Auto-save workspace
  useEffect(() => {
    if (!currentWorkspace || !isDirty) return;

    if (workspaceAutoSaveRef.current) {
      clearTimeout(workspaceAutoSaveRef.current);
    }

    workspaceAutoSaveRef.current = setTimeout(async () => {
      try {
        const workspace: WorkspaceData = {
          ...currentWorkspace,
          metadata: {
            ...currentWorkspace.metadata,
            lastModified: Date.now(),
          },
          subtitles,
          speakers,
          ttsSettings: {
            ttsEngine,
            defaultGeminiVoice,
            defaultVoxCPMVoice,
            voxcpmUrl: currentWorkspace.ttsSettings.voxcpmUrl,
            geminiKey: currentWorkspace.ttsSettings.geminiKey,
          },
          uiState: {
            ...currentWorkspace.uiState,
            timelineCurrentTime,
          },
        };
        await workspaceLib.saveWorkspace(workspace);
        setCurrentWorkspace(workspace);
        setIsDirty(false);
      } catch (error) {
        console.error('Failed to save workspace:', error);
      }
    }, 3000); // Save every 3 seconds when dirty

    return () => {
      if (workspaceAutoSaveRef.current) {
        clearTimeout(workspaceAutoSaveRef.current);
      }
    };
  }, [currentWorkspace, isDirty, subtitles, speakers, ttsEngine, defaultGeminiVoice, defaultVoxCPMVoice, timelineCurrentTime]);

  const handleManualSave = async () => {
    if (!currentWorkspace) return;

    setAutosaveStatus('saving');
    try {
      const workspace: WorkspaceData = {
        ...currentWorkspace,
        metadata: {
          ...currentWorkspace.metadata,
          lastModified: Date.now(),
        },
        subtitles,
        speakers,
        ttsSettings: {
          ttsEngine,
          defaultGeminiVoice,
          defaultVoxCPMVoice,
          voxcpmUrl: currentWorkspace.ttsSettings.voxcpmUrl,
          geminiKey: currentWorkspace.ttsSettings.geminiKey,
        },
        uiState: {
          ...currentWorkspace.uiState,
          timelineCurrentTime,
        },
      };
      await workspaceLib.saveWorkspace(workspace);
      setCurrentWorkspace(workspace);
      setIsDirty(false);
      setAutosaveStatus('saved');
      if (autosaveFlashRef.current) clearTimeout(autosaveFlashRef.current);
      autosaveFlashRef.current = setTimeout(() => setAutosaveStatus('idle'), 3000);
    } catch (error) {
      console.error('Failed to save workspace:', error);
      setAutosaveStatus('idle');
    }
  };

  const handleWorkspaceChange = async (workspaceId: string) => {
    // Save current workspace if dirty
    if (isDirty && currentWorkspace) {
      try {
        await workspaceLib.saveWorkspace(currentWorkspace);
      } catch (error) {
        console.error('Failed to save workspace:', error);
      }
    }

    // Load new workspace
    try {
      const workspace = await workspaceLib.loadWorkspace(workspaceId);
      if (workspace) {
        setCurrentWorkspaceId(workspaceId);
        setCurrentWorkspace(workspace);
        setSubtitles(workspace.subtitles);
        setSpeakers(workspace.speakers);
        setTtsEngine(workspace.ttsSettings.ttsEngine);
        setDefaultGeminiVoice(workspace.ttsSettings.defaultGeminiVoice as any);
        setDefaultVoxCPMVoice(workspace.ttsSettings.defaultVoxCPMVoice);

        if (workspace.videoBlob) {
          const videoUrl = URL.createObjectURL(workspace.videoBlob);
          setVideoUrl(videoUrl);
          setVideoFile(new File([workspace.videoBlob], workspace.metadata.videoFileName));
        } else {
          setVideoUrl('');
          setVideoFile(null);
        }

        setTimelineCurrentTime(workspace.uiState.timelineCurrentTime);
        setIsDirty(false);
      }
    } catch (error) {
      console.error('Failed to load workspace:', error);
    }
  };

  // Debounced persist
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const autosaveFlashRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    if (subtitles.length === 0) return;
    setAutosaveStatus('saving');
    autosaveTimerRef.current = setTimeout(() => {
      try {
        const toSave = subtitles.map(s => ({
          ...s,
          audioUrl: undefined,
          audioBlob: undefined,
          waveformPeaks: undefined,
          isGenerating: false,
          refAudioFile: undefined,
        }));
        localStorage.setItem('autosave_subtitles', JSON.stringify(toSave));
        setAutosaveStatus('saved');
        if (autosaveFlashRef.current) clearTimeout(autosaveFlashRef.current);
        autosaveFlashRef.current = setTimeout(() => setAutosaveStatus('idle'), 3000);
      } catch { /* storage full – ignore */ }
    }, 2000);
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      if (autosaveFlashRef.current) clearTimeout(autosaveFlashRef.current);
    };
  }, [subtitles]);

  useEffect(() => {
    try {
      const toSave = speakers.map(s => ({ ...s, refAudioFile: null, refAudioBase64: null }));
      localStorage.setItem('autosave_speakers', JSON.stringify(toSave));
    } catch {}
  }, [speakers]);

  // Warn before accidental close when there is unsaved work
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (subtitles.length === 0) return;
      e.preventDefault();
      e.returnValue = '';           // Chrome requires returnValue to be set
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [subtitles.length]);

  const formatSRTTime = (seconds: number) => {
    const pad = (num: number, size: number) => num.toString().padStart(size, '0');
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)},${pad(ms, 3)}`;
  };

  const handleExportSRT = () => {
    if (subtitles.length === 0) return;
    let srtText = '';
    subtitles.forEach((sub, index) => {
      srtText += `${index + 1}\n`;
      srtText += `${formatSRTTime(sub.startTime)} --> ${formatSRTTime(sub.endTime)}\n`;
      
      const speakerDoc = speakers.find(s => s.id === sub.speakerId);
      const speakerName = speakerDoc ? speakerDoc.name : sub.speakerId;
      
      let emotionsStr = '';
      if (sub.emotions && sub.emotions.length > 0) {
        emotionsStr = ` (${sub.emotions.join(', ')})`;
      }
      
      srtText += `${speakerName}${emotionsStr}: ${sub.text}\n\n`;
    });

    const blob = new Blob([srtText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dubbed-subtitles.srt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const [isDetectingEmotions, setIsDetectingEmotions] = useState(false);

  const handleAutoDetectEmotions = async () => {
    if (subtitles.length === 0) return;
    
    setIsDetectingEmotions(true);
    setErrorMsg(null);
    setExportStatus("Analyzing emotions...");
    
    try {
      const batchSize = 5;
      const emotionList = EMOTIONS.map(e => e.id).join(', ');
      
      // Only process clips that are not yet detected or fallback
      const toProcess = subtitles.filter(s => !s.emotionDetected);
      
      if (toProcess.length === 0) {
        setExportStatus("All clips already analyzed!");
        setTimeout(() => setExportStatus(null), 2000);
        setIsDetectingEmotions(false);
        return;
      }

      for (let i = 0; i < toProcess.length; i += batchSize) {
        const batch = toProcess.slice(i, i + batchSize);
        const localGeminiKey = localStorage.getItem('gemini_api_key');
        console.log("Detecting emotions with key present:", !!localGeminiKey);
        
        // Mark as detecting
        updateSubtitles(prev => prev.map(s => 
          batch.some(b => b.id === s.id) ? { ...s, emotionStatus: 'detecting' } : s
        ));

        let retryCount = 0;
        let success = false;
        let detectedRaw: any[] = [];

        while (retryCount < 2 && !success) {
          try {
            const response = await fetch('/api/detect-emotions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                batch: batch.map(s => ({ id: s.id, text: s.text })),
                emotionList,
                userApiKey: localGeminiKey
              })
            });

            if (!response.ok) throw new Error('API Error');

            const data = await response.json();
            const jsonMatch = data.text.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              detectedRaw = JSON.parse(jsonMatch[0]);
              success = true;
            } else {
              throw new Error('No JSON found');
            }
          } catch (e) {
            retryCount++;
            if (retryCount < 2) await new Promise(r => setTimeout(r, 1000));
          }
        }

        // Apply results or fallbacks for this batch
        updateSubtitles(prev => prev.map(s => {
          const inBatch = batch.find(b => b.id === s.id);
          if (!inBatch) return s;

          const d = detectedRaw.find((item: any) => item.id === s.id);
          if (success && d) {
            return { 
              ...s, 
              emotions: Array.isArray(d.emotions) ? d.emotions.filter((e: string) => EMOTIONS.some(ex => ex.id === e)) : ['calm'], 
              tone: d.tone || 'normal',
              energy: typeof d.energy === 'number' ? d.energy : 0.5,
              speed: typeof d.speed === 'number' ? d.speed : 1.0,
              emotionDetected: true,
              emotionStatus: 'detected'
            };
          }
          
          // Failed AI detection for this sub - use local keywords
          const fallback = detectLocalKeywords(s.text);
          return { 
            ...s, 
            ...fallback, 
            emotionDetected: true, 
            emotionStatus: 'fallback' 
          };
        }));

        setExportStatus(`Analyzed ${Math.min(i + batchSize, toProcess.length)} / ${toProcess.length}`);
        await new Promise(r => setTimeout(r, 500));
      }
      
      setExportStatus("Tone analysis complete!");
      setTimeout(() => setExportStatus(null), 2000);
    } catch (err: any) {
      console.error("Emotion detection batch failed", err);
      setErrorMsg("Some clips failed AI detection, fallbacks used.");
    } finally {
      setIsDetectingEmotions(false);
    }
  };

  const handleAutoDetectSpeakers = useCallback(() => {
    const speakerMap = new Map<string, Speaker>();
    // Pre-populate with current manual speakers to preserve settings
    speakers.forEach(s => speakerMap.set(s.name, s));

    const updatedSubtitles = subtitles.map(sub => {
      const { speakerName, cleanText } = detectSpeaker(sub.text);
      
      if (!speakerMap.has(speakerName)) {
        const color = SPEAKER_COLORS[speakerMap.size % SPEAKER_COLORS.length];
        speakerMap.set(speakerName, {
          id: speakerName,
          name: speakerName,
          voice: sub.voice || 'default',
          engine: sub.engine || ttsEngine,
          refAudioFile: sub.refAudioFile || null,
          refAudioBase64: sub.refAudioBase64 || null,
          color,
          emotionSensitivity: 0.5
        });
      }
      
      return { ...sub, speakerId: speakerName, cleanText };
    });

    setSubtitles(updatedSubtitles);
    setSpeakers(Array.from(speakerMap.values()));
  }, [subtitles, ttsEngine, speakers]);

  const applySpeakerToAll = (speaker: Speaker) => {
    updateSubtitles(prev => prev.map(s => {
      if (s.speakerId === speaker.id) {
        return {
          ...s,
          voice: speaker.voice,
          engine: speaker.engine,
          refAudioFile: speaker.refAudioFile || undefined,
          refAudioBase64: speaker.refAudioBase64 || undefined,
          emotions: speaker.defaultEmotion ? [speaker.defaultEmotion] : s.emotions
        };
      }
      return s;
    }));
  };

  const updateSpeaker = (id: string, updates: Partial<Speaker>) => {
    setSpeakers(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  
  const [history, setHistory] = useState<Subtitle[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const historyTimeoutRef = useRef<any>(null);

  const pushToHistory = useCallback((newSubs: Subtitle[]) => {
    setHistory(prevHistory => {
      if (prevHistory.length > 0 && historyIndex >= 0 && historyIndex < prevHistory.length) {
        const last = prevHistory[historyIndex];
        if (last.length === newSubs.length) {
          let changed = false;
          for (let i = 0; i < Math.min(last.length, 100); i++) { // Sample check for speed
            if (last[i].text !== newSubs[i].text || last[i].startTime !== newSubs[i].startTime) {
              changed = true;
              break;
            }
          }
          if (!changed && last.length > 100) {
             // Deeper check if sample passed but might still be changed elsewhere
             for (let i = 100; i < last.length; i++) {
               if (last[i].text !== newSubs[i].text || last[i].startTime !== newSubs[i].startTime) {
                 changed = true;
                 break;
               }
             }
          }
          if (!changed) return prevHistory;
        }
      }

      const snapshot = newSubs.map(s => ({ ...s }));
      const newHistory = prevHistory.slice(0, historyIndex + 1);
      newHistory.push(snapshot);
      if (newHistory.length > 50) {
        newHistory.shift();
        setHistoryIndex(prev => Math.max(0, prev)); // keep index in sync with shift
      }
      
      return newHistory;
    });

    setHistoryIndex(prev => prev + 1);
  }, [historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      const snapshot = history[prevIndex].map((s: Subtitle) => ({ ...s }));
      setSubtitles(snapshot);
      setHistoryIndex(prevIndex);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      const snapshot = history[nextIndex].map((s: Subtitle) => ({ ...s }));
      setSubtitles(snapshot);
      setHistoryIndex(nextIndex);
    }
  }, [history, historyIndex]);

  const updateSubtitles = useCallback((updater: Subtitle[] | ((prev: Subtitle[]) => Subtitle[]), skipHistory: boolean = false) => {
    setSubtitles(prev => {
      let next = typeof updater === 'function' ? updater(prev) : updater;
      
      // Performance optimization: only sanitize if we really have to
      // next = sanitize(next);

      if (!skipHistory) {
        if (historyTimeoutRef.current) clearTimeout(historyTimeoutRef.current);
        historyTimeoutRef.current = setTimeout(() => pushToHistory(next), 1000); // 1s debounce
      }
      return next;
    });
  }, [pushToHistory]);
  
  const audioClips = useMemo(() => {
    return subtitles
      .filter(s => !!s.audioUrl || !!s.audioBlob)
      .map(s => {
        const startTime = s.isLinked ? s.startTime : (s.audioStartTime ?? s.startTime);
        const audioDur = s.audioDuration || (s.endTime - s.startTime);
        const trimStart = s.audioTrimStart ?? 0;
        const trimEnd = s.audioTrimEnd ?? audioDur;
        const duration = trimEnd - trimStart;
        return {
          ...s,                    // ← this spreads audioBlob correctly
          startTime,
          endTime: startTime + duration,
          duration,
          audioTrimStart: trimStart,
          audioTrimEnd: trimEnd,
          audioDuration: audioDur,
          // Ensure audioBlob is always present if we generated it
          audioBlob: s.audioBlob,
        };
      });
  }, [subtitles]);

  const activeSub = useMemo(() => {
    return subtitles.find(s => timelineCurrentTime >= s.startTime && timelineCurrentTime < s.endTime);
  }, [subtitles, timelineCurrentTime]);

  const srtDuration = useMemo(() => {
    if (subtitles.length === 0) return 0;
    return Math.max(...subtitles.map(s => s.endTime));
  }, [subtitles]);

  const fitSrtToVideo = useCallback(() => {
    if (videoDuration <= 0 || srtDuration <= 0) return;
    const scale = videoDuration / srtDuration;
    
    updateSubtitles(prev => prev.map(s => {
      // Scale subtitle timing
      const newStart = s.startTime * scale;
      const newEnd = s.endTime * scale;
      
      // Update linked audio context if it exists
      let audioUpdate: Partial<Subtitle> = {};
      if (s.audioUrl) {
         // If it's linked, it usually follows the text start
         // but if it has manual timing, we scale that too
         if (s.audioStartTime !== undefined) {
             audioUpdate.audioStartTime = s.audioStartTime * scale;
         }
         // Duration scaling: trim ends might need adjustment if they were relative to original length
         // But the instructions say "scale all subtitle timings"
      }

      return {
        ...s,
        startTime: newStart,
        endTime: newEnd,
        ...audioUpdate
      };
    }));
  }, [videoDuration, srtDuration, updateSubtitles]);

  // Timeline UI State
  const [timelineViewMode, setTimelineViewMode] = useState<'content' | 'video'>('content');
  const [zoomLevel, setZoomLevel] = useState(60); 
  const [timelineHeight, setTimelineHeight] = useState(() => {
    const saved = localStorage.getItem('timeline_height');
    return saved ? parseInt(saved, 10) : 280;
  });
  const [leftPanelWidth, setLeftPanelWidth] = useState(() => {
    const saved = localStorage.getItem('left_panel_width');
    return saved ? parseInt(saved, 10) : 320;
  });
  const [videoPanelWidth, setVideoPanelWidth] = useState(() => {
    const saved = localStorage.getItem('video_panel_width');
    return saved ? parseInt(saved, 10) : 288;
  });
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingVideo, setIsResizingVideo] = useState(false);
  const liveLeftWidthRef = useRef(320);
  const liveVideoWidthRef = useRef(288);
  const [followPlayhead, setFollowPlayhead] = useState(true);
  const [timelineScrollLeft, setTimelineScrollLeft] = useState(0);
  const [timelineViewportWidth, setTimelineViewportWidth] = useState(0);
  
  const TIMELINE_LEFT_OFFSET = 128; // w-32 for sticky labels
  const pixelsPerSecond = zoomLevel;
  const viewportStartTime = timelineScrollLeft / pixelsPerSecond;
  const [isResizingTimeline, setIsResizingTimeline] = useState(false);

  const timelineContainerRef = useRef<HTMLDivElement>(null);

  // Track Selection State
  const [selectedClipId, setSelectedClipId] = useState<{ id: number; type: 'subtitle' | 'audio' } | null>(null);

  const safePlay = useCallback(async (media: HTMLMediaElement) => {
    try {
      const promise = media.play();
      if (promise !== undefined) {
        await promise;
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Playback error:', err);
      }
    }
  }, []);

  const syncGeneratedAudio = useCallback((time: number, isPaused: boolean = false, playbackRate: number = 1) => {
    const activeSubIdsThisTick = new Set<number>();
    
    audioClips.forEach((clip) => {
      const inRange = time >= clip.startTime && time < clip.endTime;

      if (!inRange) {
        const existingAudio = activeAudioRefs.current.get(clip.id);
        if (existingAudio) {
           console.log(`[DUB] STOP ${clip.id}`);
           existingAudio.pause();
           activeAudioRefs.current.delete(clip.id);
        }
        return;
      }

      // Safety assertion
      if (time < clip.startTime || time >= clip.endTime) {
        console.error("BUG: Tried to play audio outside waveform range", clip);
        return;
      }

      activeSubIdsThisTick.add(clip.id);
      const expectedTimeInFile = (time - clip.startTime) + clip.audioTrimStart;
      let audio = activeAudioRefs.current.get(clip.id);

      if (!audio) {
        console.log("TIMELINE AUDIO START", {
          clipId: clip.id,
          clipStart: clip.startTime,
          clipEnd: clip.endTime,
          timelineCurrentTime: time,
          offset: time - clip.startTime,
          playheadPx: (time * zoomLevel).toFixed(1),
          waveformLeftPx: (clip.startTime * zoomLevel).toFixed(1),
        });

        const newAudio = new Audio(clip.audioUrl);
        newAudio.currentTime = expectedTimeInFile;
        newAudio.playbackRate = playbackRate;
        newAudio.volume = dubVolume;
        if (!isPaused && expectedTimeInFile < clip.audioTrimEnd) {
          safePlay(newAudio);
        }
        activeAudioRefs.current.set(clip.id, newAudio);
      } else {
        // Sync existing audio
        if (isPaused && !audio.paused) {
          audio.pause();
        } else if (!isPaused && audio.paused && expectedTimeInFile < clip.audioTrimEnd) {
          safePlay(audio);
        }
        
        if (Math.abs(audio.playbackRate - playbackRate) > 0.01) {
          audio.playbackRate = playbackRate;
        }
        if (Math.abs(audio.volume - dubVolume) > 0.01) {
          audio.volume = dubVolume;
        }

        const drift = Math.abs(audio.currentTime - expectedTimeInFile);
        const isSeekingOrScrubbing = isScrubbingRef.current || (videoRef.current?.seeking ?? false);
        const sensitivity = isSeekingOrScrubbing ? 0.005 : 0.15;

        if (drift > sensitivity) {
          const safeTime = Math.max(clip.audioTrimStart, Math.min(clip.audioTrimEnd, expectedTimeInFile));
          audio.currentTime = safeTime;
          if (expectedTimeInFile > clip.audioTrimEnd + 0.05) {
            if (!audio.paused) audio.pause();
          }
        }
      }
    });
    
    // Stop audio for clips that are no longer active
    activeAudioRefs.current.forEach((audio, id) => {
      if (!activeSubIdsThisTick.has(id)) {
        audio.pause();
        activeAudioRefs.current.delete(id);
      }
    });
  }, [audioClips, dubVolume, safePlay, zoomLevel]);

  useEffect(() => {
    if (videoRef.current) {
        videoRef.current.volume = videoVolume;
    }
  }, [videoVolume]);

  useEffect(() => {
    activeAudioRefs.current.forEach(audio => {
      audio.volume = dubVolume;
    });
  }, [dubVolume]);

  const maxEndTime = useMemo(() => {
    if (subtitles.length === 0) return 0;
    let max = 0;
    for (let i = 0; i < subtitles.length; i++) {
      if (subtitles[i].endTime > max) max = subtitles[i].endTime;
    }
    return max;
  }, [subtitles]);

  const totalDuration = useMemo(() => {
    // Strictly respect video duration if present
    const dur = (videoUrl && videoDuration > 0) ? videoDuration : (srtDuration > 0 ? srtDuration : 30);
    return dur;
  }, [videoDuration, srtDuration, videoUrl]);

  const timelineContentWidth = useMemo(() => {
    return TIMELINE_LEFT_OFFSET + totalDuration * pixelsPerSecond;
  }, [totalDuration, pixelsPerSecond]);

  const handleTimelineScrub = (time: number) => {
    const video = videoRef.current;
    
    // Calculate limit correctly
    let limitFactor = totalDuration;
    if (video && videoUrl && videoDuration > 0) {
      limitFactor = videoDuration;
    }

    const clampedTime = Math.max(0, Math.min(time, limitFactor));
    
    if (Number.isFinite(clampedTime)) {
      const video = videoRef.current;
      if (video && videoUrl) {
        video.currentTime = clampedTime;
      }
      setTimelineCurrentTime(clampedTime);
      
      if (isTimelinePlayingRef.current) {
        playbackStartWallTimeRef.current = performance.now();
        timelineStartTimeRef.current = clampedTime;
      }
    }
    
    // Stop all active audio on scrub/seek
    activeAudioRefs.current.forEach(audio => {
      audio.pause();
    });
    activeAudioRefs.current.clear();
  };

  const stopTimeline = useCallback(() => {
    console.log("Timeline: STOP called");
    setIsPlaying(false);
    isTimelinePlayingRef.current = false;
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
      console.log("Timeline: RAF cancelled");
    }
    
    if (videoRef.current) {
      videoRef.current.pause();
    }
    
    activeAudioRefs.current.forEach(audio => {
      audio.pause();
    });
    activeAudioRefs.current.clear();
  }, []);

  const tickTimeline = useCallback(() => {
    if (!isTimelinePlayingRef.current) {
      console.log("Timeline: RAF tick skipped - not playing");
      return;
    }

    const now = performance.now();
    console.log("Timeline: RAF tick", now);

    const video = videoRef.current;
    const hasVideo = !!(video && videoUrl);
    let time: number;
    let isPaused: boolean;
    let playbackRate: number = 1;

    if (hasVideo && video) {
      time = video.currentTime;
      isPaused = video.paused;
      playbackRate = video.playbackRate;

      // Force sync if drift is detected outside expected range
      if (Math.abs(timelineCurrentTime - time) > 0.05) {
        // This will be picked up by the next setTimelineCurrentTime if we just use 'time'
      }
      
      // Update video volume
      if (video.volume !== videoVolume) {
        video.volume = videoVolume;
      }
      
      if (isTimelinePlayingRef.current && isPaused) {
         setIsPlaying(false);
         isTimelinePlayingRef.current = false;
         console.log("Timeline: Video paused externally, stopping timeline");
      }
    } else {
      const elapsed = (now - playbackStartWallTimeRef.current) / 1000;
      time = Math.min(totalDuration, timelineStartTimeRef.current + elapsed);
      isPaused = !isTimelinePlayingRef.current;
    }

    if (Number.isFinite(time)) {
      setTimelineCurrentTime(time);
      syncGeneratedAudio(time, isPaused, playbackRate);
      if (isTimelinePlayingRef.current && time >= totalDuration - 0.01) {
        stopTimeline();
      }
    }

    if (timelineContainerRef.current && !isPaused && !isScrubbingRef.current && followPlayhead) {
      const container = timelineContainerRef.current;
      const playheadX = time * zoomLevel;
      const containerWidth = container.offsetWidth;
      const scrollLeft = container.scrollLeft;

      // Auto-scroll threshold: 75% of visible width
      const thresholdRight = scrollLeft + (containerWidth * 0.75);
      // Backwards threshold: 5% of visible width (if user jumps back)
      const thresholdLeft = scrollLeft + (containerWidth * 0.05);

      if (playheadX > thresholdRight || playheadX < thresholdLeft) {
        const nowMs = performance.now();
        // Thrortle scroll triggers to allow smooth animation to finish (approx 500ms)
        if (nowMs - lastScrollTriggerRef.current > 500) {
          const targetScroll = playheadX - (containerWidth * 0.25);
          container.scrollTo({
            left: Math.max(0, targetScroll),
            behavior: 'smooth'
          });
          lastScrollTriggerRef.current = nowMs;
        }
      }
    }

    animationFrameRef.current = requestAnimationFrame(tickTimeline);
  }, [totalDuration, zoomLevel, followPlayhead, subtitles, videoUrl, stopTimeline, syncGeneratedAudio]);

  const playTimeline = useCallback(() => {
    if (isTimelinePlayingRef.current) return;
    console.log("Timeline: PLAY start");
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setIsPlaying(true);
    isTimelinePlayingRef.current = true;
    playbackStartWallTimeRef.current = performance.now();
    timelineStartTimeRef.current = timelineCurrentTime;
    if (videoRef.current && videoUrl) {
      safePlay(videoRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(tickTimeline);
  }, [videoUrl, timelineCurrentTime, tickTimeline]);

  const togglePlayback = useCallback(() => {
    if (isTimelinePlayingRef.current) {
      stopTimeline();
    } else {
      playTimeline();
    }
  }, [playTimeline, stopTimeline]);

  // Refs for keydown listener to avoid frequent re-subscribing
  const stateRef = useRef({ togglePlayback, handleTimelineScrub, subtitles, timelineCurrentTime, videoRef, isPlaying });
  useEffect(() => {
    stateRef.current = { togglePlayback, handleTimelineScrub, subtitles, timelineCurrentTime, videoRef, isPlaying };
  }, [togglePlayback, handleTimelineScrub, subtitles, timelineCurrentTime, videoRef, isPlaying]);



  const [dragVisuals, setDragVisuals] = useState<{
    id: number;
    type: string;
    startTime: number;
    endTime: number;
    audioStartTime: number;
    audioTrimStart: number;
    audioTrimEnd: number;
  } | null>(null);

  // High-performance drag refs
  const dragInfoRef = useRef<{
    id: number;
    type: 'text' | 'audio' | 'trim-audio-start' | 'trim-audio-end' | 'trim-text-start' | 'trim-text-end';
    startX: number;
    initialTime: number;
    initialEndTime: number;
    initialAudioStartTime: number;
    initialAudioTrimStart: number;
    initialAudioTrimEnd: number;
    initialAudioDuration: number;
    element: HTMLElement | null;
    isLinked: boolean;
    rafId: number | null;
    lastDx: number;
  } | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => {
       console.log("Timeline: PLAY start (via video event)");
       setIsPlaying(true);
       isTimelinePlayingRef.current = true;
       if (!animationFrameRef.current) {
          animationFrameRef.current = requestAnimationFrame(tickTimeline);
       }
    };
    const onPause = () => {
       console.log("Timeline: STOP (via video event)");
       setIsPlaying(false);
       isTimelinePlayingRef.current = false;
    };
    const onTimeUpdate = () => {
      if (!isScrubbingRef.current) {
        setTimelineCurrentTime(video.currentTime);
      }
    };
    const onLoadedMetadata = () => {
      setVideoDuration(video.duration);
    };

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('loadedmetadata', onLoadedMetadata);

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
    };
  }, [videoUrl]);

  const audioOverlaps = useMemo(() => {
    const overlaps = new Set<number>();
    if (audioClips.length > 1) {
      for (let i = 0; i < audioClips.length; i++) {
        const c1 = audioClips[i];
        for (let j = i + 1; j < audioClips.length; j++) {
          const c2 = audioClips[j];
          if (c1.startTime < c2.endTime - 0.01 && c1.endTime > c2.startTime + 0.01) {
            overlaps.add(c1.id);
            overlaps.add(c2.id);
          }
        }
      }
    }
    return overlaps;
  }, [audioClips]);

  // Assign each audio clip to a lane (row) so overlapping clips render in separate rows
  const audioLanes = useMemo(() => {
    const laneMap = new Map<number, number>(); // clipId -> laneIndex
    const laneEnds: number[] = []; // end time of last clip in each lane
    const sorted = [...audioClips].sort((a, b) => a.startTime - b.startTime);
    for (const clip of sorted) {
      let placed = false;
      for (let lane = 0; lane < laneEnds.length; lane++) {
        if (clip.startTime >= laneEnds[lane] - 0.01) {
          laneMap.set(clip.id, lane);
          laneEnds[lane] = clip.endTime;
          placed = true;
          break;
        }
      }
      if (!placed) {
        laneMap.set(clip.id, laneEnds.length);
        laneEnds.push(clip.endTime);
      }
    }
    return { laneMap, laneCount: Math.max(1, laneEnds.length) };
  }, [audioClips]);



  const visibleSubtitles = useMemo(() => {
    const viewportStartTime = timelineScrollLeft / pixelsPerSecond;
    const viewportEndTime = (timelineScrollLeft + timelineViewportWidth) / pixelsPerSecond;
    const padding = 2;
    
    // Quick lookup map for audio clips
    const audioClipMap = new Map<number, typeof audioClips[0]>(audioClips.map(c => [c.id, c]));

    return subtitles.filter(s => {
      const subStart = s.startTime;
      const subEnd = s.endTime;
      
      const clip = audioClipMap.get(s.id);
      const audioStart = clip ? clip.startTime : subStart;
      const audioEnd = clip ? clip.endTime : subEnd;

      const contentStart = Math.min(subStart, audioStart);
      const contentEnd = Math.max(subEnd, audioEnd);
      return (contentStart <= viewportEndTime + padding) && (contentEnd >= viewportStartTime - padding);
    });
  }, [subtitles, audioClips, timelineScrollLeft, timelineViewportWidth, zoomLevel]);



  const liveTimelineHeightRef = useRef(timelineHeight);
  useEffect(() => { liveTimelineHeightRef.current = timelineHeight; }, [timelineHeight]);
  useEffect(() => { liveLeftWidthRef.current = leftPanelWidth; }, [leftPanelWidth]);
  useEffect(() => { liveVideoWidthRef.current = videoPanelWidth; }, [videoPanelWidth]);

  useEffect(() => {
    if (!isResizingLeft) return;
    const handleMouseMove = (e: MouseEvent) => {
      const w = Math.max(200, Math.min(e.clientX, 520));
      setLeftPanelWidth(w);
    };
    const handleMouseUp = () => {
      setIsResizingLeft(false);
      localStorage.setItem('left_panel_width', liveLeftWidthRef.current.toString());
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingLeft]);

  useEffect(() => {
    if (!isResizingVideo) return;
    const handleMouseMove = (e: MouseEvent) => {
      const w = Math.max(200, Math.min(window.innerWidth - e.clientX, 520));
      setVideoPanelWidth(w);
    };
    const handleMouseUp = () => {
      setIsResizingVideo(false);
      localStorage.setItem('video_panel_width', liveVideoWidthRef.current.toString());
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingVideo]);

  useEffect(() => {
    if (!isResizingTimeline) return;
    const handleMouseMove = (e: MouseEvent) => {
      const h = window.innerHeight - e.clientY;
      const boundedH = Math.max(120, Math.min(h, window.innerHeight * 0.75));
      setTimelineHeight(boundedH);
    };
    const handleMouseUp = () => {
      setIsResizingTimeline(false);
      localStorage.setItem('timeline_height', liveTimelineHeightRef.current.toString());
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingTimeline]);



  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement instanceof HTMLInputElement || 
          document.activeElement instanceof HTMLTextAreaElement ||
          (document.activeElement as HTMLElement)?.isContentEditable) {
        return;
      }
      
      const { togglePlayback, handleTimelineScrub, subtitles, timelineCurrentTime } = stateRef.current;

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlayback();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handleTimelineScrub(stateRef.current.timelineCurrentTime - (e.shiftKey ? 1 : 0.1));
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleTimelineScrub(stateRef.current.timelineCurrentTime + (e.shiftKey ? 1 : 0.1));
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        // Jump to previous subtitle
        const prevSub = [...subtitles].reverse().find(s => s.startTime < stateRef.current.timelineCurrentTime - 0.1);
        if (prevSub) {
          handleTimelineScrub(prevSub.startTime);
        }
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        // Jump to next subtitle
        const nextSub = subtitles.find(s => s.startTime > stateRef.current.timelineCurrentTime + 0.1);
        if (nextSub) {
          handleTimelineScrub(nextSub.startTime);
        }
      } else if (e.code === 'Delete' || e.code === 'Backspace') {
        // Only delete if something is active and we're not typing
        const activeSub = subtitles.find(s => stateRef.current.timelineCurrentTime >= s.startTime && stateRef.current.timelineCurrentTime <= s.endTime);
        if (activeSub) {
          e.preventDefault();
          updateSubtitles(prev => prev.filter(s => s.id !== activeSub.id));
        }
      } else if (e.code === 'Slash' && e.shiftKey) {
        e.preventDefault();
        setShowShortcuts(prev => !prev);
      } else if (e.code === 'Equal' || e.code === 'KeyV' || e.code === 'NumpadAdd') { // + key
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault();
          setZoomLevel(prev => Math.min(500, prev * 1.2));
        }
      } else if (e.code === 'Minus' || e.code === 'NumpadSubtract') { // - key
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault();
          setZoomLevel(prev => Math.max(2, prev / 1.2));
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlayback]); // Only depend on stable togglePlayback

  const timelineRulerCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = timelineRulerCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI screens
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, rect.width, rect.height);
    
    // Sidebar cover for the ruler area (sticky appearance)
    ctx.fillStyle = 'rgb(15, 23, 42)'; // slate-950
    ctx.fillRect(0, 0, TIMELINE_LEFT_OFFSET, rect.height);
    
    // Background background for the ruler area
    ctx.fillStyle = 'rgba(15, 23, 42, 0.5)'; // slate-900/50
    ctx.fillRect(TIMELINE_LEFT_OFFSET, 0, rect.width - TIMELINE_LEFT_OFFSET, 24);
    
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.4)'; // slate-500/40
    ctx.fillStyle = 'rgba(203, 213, 225, 0.8)'; // slate-300
    ctx.font = '500 9px ui-monospace, monospace';
    ctx.textAlign = 'center';

    const totalD = totalDuration;
    if (!Number.isFinite(totalD) || totalD <= 0) return;
    
    // Adaptive steps based on zoomLevel (pixels per second)
    let majorStep = 5;
    if (zoomLevel > 150) majorStep = 0.5;
    else if (zoomLevel > 80) majorStep = 1;
    else if (zoomLevel > 40) majorStep = 2;
    else if (zoomLevel > 10) majorStep = 5;
    else if (zoomLevel > 5) majorStep = 10;
    else majorStep = 30;

    let minorStep = majorStep / 5;
    
    const maxMajorMarks = 500;
    if (totalD / majorStep > maxMajorMarks) {
      majorStep = Math.ceil(totalD / maxMajorMarks);
      minorStep = majorStep / 5;
    }

    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let s = 0; s <= totalD; s += majorStep) {
      const x = TIMELINE_LEFT_OFFSET + (s * pixelsPerSecond) - timelineScrollLeft;
      
      // Only draw if within reasonable bounds of viewport
      if (x < -100 || x > rect.width + 100) continue;

      // Major Tick
      ctx.moveTo(x, 12);
      ctx.lineTo(x, 24);
      
      const timeStr = s % 1 === 0 ? formatTime(s) : `${formatTime(Math.floor(s))}.${Math.floor((s % 1) * 10)}`;
      ctx.fillText(timeStr, x, 10);
      
      // Vertical Grid Line (very subtle)
      ctx.save();
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.3)'; // slate-700/30
      ctx.beginPath();
      ctx.moveTo(x, 24);
      ctx.lineTo(x, rect.height + 1000); 
      ctx.stroke();
      ctx.restore();
      
      for (let m = minorStep; m < majorStep; m += minorStep) {
        if (s + m <= totalD) {
          const mx = TIMELINE_LEFT_OFFSET + ((s + m) * pixelsPerSecond) - timelineScrollLeft;
          // Minor Tick
          ctx.moveTo(mx, 18);
          ctx.lineTo(mx, 24);
        }
      }
    }
    ctx.stroke();
  }, [totalDuration, videoDuration, zoomLevel]); // Only redraw on dimension/scale changes, NOT on state/time changes

  const timelineRuler = <canvas ref={timelineRulerCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />;

  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const [previewingId, setPreviewingId] = useState<number | null>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const toggleSubtitleSelection = useCallback((id: number) => {
    setSelectedSubtitles(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const [selectedSubtitles, setSelectedSubtitles] = useState<Set<number>>(new Set());
  const [isBatchEditMode, setIsBatchEditMode] = useState(false);
  const [batchFindText, setBatchFindText] = useState('');
  const [batchReplaceText, setBatchReplaceText] = useState('');
  const [batchTimeShift, setBatchTimeShift] = useState<string>('0');

  const [playingAudio, setPlayingAudio] = useState<HTMLAudioElement | null>(null);

  const playAudioFile = (file: File) => {
    if (playingAudio) {
      playingAudio.pause();
    }
    const url = createTrackedUrl(file);
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    safePlay(audio);
    setPlayingAudio(audio);
  };

  const handleSelectAll = () => {
    setSelectedSubtitles(new Set(subtitles.map(s => s.id)));
  };

  const handleDeselectAll = () => {
    setSelectedSubtitles(new Set());
  };

  const handleBatchReplace = () => {
    if (!batchFindText) return;
    updateSubtitles(prev => prev.map(s => {
      if (selectedSubtitles.has(s.id)) {
        return {
          ...s,
          text: s.text.split(batchFindText).join(batchReplaceText)
        };
      }
      return s;
    }));
  };

  const handleBatchTimeShift = () => {
    const shift = parseFloat(batchTimeShift);
    if (isNaN(shift)) return;
    updateSubtitles(prev => prev.map(s => {
      if (selectedSubtitles.has(s.id)) {
        const duration = s.endTime - s.startTime;
        const newStart = Math.max(0, s.startTime + shift);
        return {
          ...s,
          startTime: newStart,
          endTime: newStart + duration,
          audioStartTime: s.isLinked ? newStart : (s.audioStartTime ?? s.startTime) + shift
        };
      }
      return s;
    }));
  };

  const handleReferenceAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setReferenceAudioFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        setReferenceAudioBase64(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubReferenceAudioUpload = (id: number, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        updateSubtitles(prev => prev.map(s => {
          if (s.id === id) {
            return {
              ...s,
              refAudioFile: file,
              refAudioBase64: base64
            };
          }
          return s;
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      console.log("file name", file.name);
      console.log("file type", file.type);
      console.log("file size", file.size);

      setVideoFile(file);
      // Revoke old URL if exists before creating new one
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
        allObjectUrlsRef.current.delete(videoUrl);
      }

      // Use URL.createObjectURL directly as requested
      const url = URL.createObjectURL(file);
      allObjectUrlsRef.current.add(url);
      setVideoUrl(url);
      setErrorMsg(null);

      const name = file.name.toLowerCase();
      const isUnsupported = name.endsWith('.mkv') || name.endsWith('.avi') || name.endsWith('.mov') || name.endsWith('.ts');

      if (isUnsupported) {
        setShowMKVWarning(true);
      } else {
        setShowMKVWarning(false);
      }

      // Save video blob to workspace
      if (currentWorkspace) {
        const updatedWorkspace: WorkspaceData = {
          ...currentWorkspace,
          metadata: {
            ...currentWorkspace.metadata,
            videoFileName: file.name,
            videoFileSize: file.size,
          },
          videoBlob: file,
        };
        setCurrentWorkspace(updatedWorkspace);
        setIsDirty(true);
      }
    }
  };

  const handleOptimizeMKV = async () => {
    if (!videoFile) return;
    setIsTranscodingVideo(true);
    setExportStatus("Transcoding for browser support...");
    
    try {
      if (!ffmpegRef.current) {
        const ffmpeg = new FFmpeg();
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
        await ffmpeg.load({
            coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
            wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });
        ffmpegRef.current = ffmpeg;
      }

      const ffmpeg = ffmpegRef.current;
      const inputName = 'input_original' + (videoFile.name.substring(videoFile.name.lastIndexOf('.')) || '.mkv');
      const outputName = 'optimized.mp4';
      
      await ffmpeg.writeFile(inputName, await fetchFile(videoFile));
      
      // Try fast remux first (copy streams, just change container)
      try {
        await ffmpeg.exec(['-i', inputName, '-c', 'copy', '-f', 'mp4', '-movflags', '+faststart', outputName, '-y']);
      } catch (remuxErr) {
        console.warn("Remux failed, performing full transcode", remuxErr);
        // Full transcode if streams are incompatible
        await ffmpeg.exec([
          '-i', inputName, 
          '-c:v', 'libx264', 
          '-preset', 'ultrafast', 
          '-crf', '28', 
          '-pix_fmt', 'yuv420p', // Crucial for browser support
          '-c:a', 'aac', 
          '-b:a', '128k',
          '-s', '1280x720', // Downscale for speed
          '-movflags', '+faststart',
          '-f', 'mp4', 
          outputName, 
          '-y'
        ]);
      }
      
      const data = await ffmpeg.readFile(outputName);
      const mp4Blob = new Blob([data as any], { type: 'video/mp4' });
      const mp4File = new File([mp4Blob], videoFile.name.replace(/\.[^/.]+$/, "") + "_optimized.mp4", { type: 'video/mp4' });
      
      setVideoFile(mp4File);
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
        allObjectUrlsRef.current.delete(videoUrl);
      }
      const newUrl = createTrackedUrl(mp4File);
      setVideoUrl(newUrl);
      setShowMKVWarning(false);
      setExportStatus("Video successfully optimized!");
      setTimeout(() => setExportStatus(null), 2000);
    } catch (err: any) {
      console.error("Optimization failed:", err);
      setErrorMsg("Failed to optimize video. Please try an MP4 file instead.");
    } finally {
      setIsTranscodingVideo(false);
      setExportStatus(null);
    }
  };

  // Load and parse SRT
  const handleSRTUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const parsed = parseSRT(text);
        updateSubtitles(parsed);
        setTimelineViewMode('content');
        setErrorMsg(null);
      };
      reader.readAsText(file);
    }
  };

  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [voxcpmUrl, setVoxcpmUrl] = useState(() => localStorage.getItem('voxcpm_url') || 'http://127.0.0.1:8808');

  const saveSettings = () => {
    localStorage.setItem('gemini_api_key', geminiKey);
    localStorage.setItem('voxcpm_url', voxcpmUrl);
    localStorage.setItem('default_gemini_voice', defaultGeminiVoice);
    localStorage.setItem('default_voxcpm_voice', defaultVoxCPMVoice);
    setShowSettings(false);
  };

  // Generate audio for a single subtitle
  const generateSubtitleAudio = async (sub: Subtitle): Promise<Blob | null> => {
    try {
      const speaker = speakers.find(s => s.id === sub.speakerId);
      const engineToUse = (speaker?.engine && speaker.engine !== 'default') ? speaker.engine : ((!sub.engine || sub.engine === 'default') ? ttsEngine : sub.engine);
      
      let voiceToUse = speaker?.voice || sub.voice;
      const refFile = speaker?.refAudioFile || sub.refAudioFile || referenceAudioFile;
      const refBase64 = speaker?.refAudioBase64 || sub.refAudioBase64 || referenceAudioBase64;
      
      const isCloning = !!(refBase64 || refFile);
      let textToSynthesize = cleanTextForTTS(sub.text);
      
      if (!textToSynthesize) {
        console.warn("Skipping audio generation for empty text after cleaning:", sub.id);
        return null;
      }
      
      // Emotion & Tone Context
      const emotions = sub.emotions?.length ? sub.emotions : (speaker?.defaultEmotion ? [speaker.defaultEmotion] : []);
      const sensitivity = speaker?.emotionSensitivity ?? 0.5;
      
      const emotionContext = emotions.length ? `with ${emotions.join(', ')} emotions` : '';
      const toneContext = sub.tone ? `in a ${sub.tone} tone` : '';
      const energyContext = sub.energy !== undefined ? `with ${sub.energy > 0.7 ? 'high' : sub.energy < 0.3 ? 'low' : 'moderate'} energy` : '';
      const speedContext = sub.speed !== undefined ? `speaking ${sub.speed > 0.7 ? 'rapidly' : sub.speed < 0.3 ? 'slowly' : 'at a normal pace'}` : '';
      const styleContext = [emotionContext, toneContext, energyContext, speedContext].filter(Boolean).join(' and ');
      
      const intensitySuffix = sensitivity > 0.7 ? " exaggerated and intense" : sensitivity < 0.3 ? " subtle and understated" : "";

      if (!voiceToUse || voiceToUse === 'default') {
        if (engineToUse === 'gemini') voiceToUse = defaultGeminiVoice;
        else if (engineToUse === 'voxcpm') {
           voiceToUse = isCloning ? '' : defaultVoxCPMVoice;
        }
        else voiceToUse = 'km'; // fallback
      }

      if (engineToUse === 'voxcpm') {
        const baseURL = (localStorage.getItem('voxcpm_url') || 'http://127.0.0.1:8808')
          .replace(/\/$/, '');

        let refWavPayload = null;
        
        if (refFile) {
          const formData = new FormData();
          formData.append("files", refFile);
          
          try {
            const uploadRes = await fetch(`${baseURL}/gradio_api/upload`, {
              method: 'POST',
              body: formData
            });
            
            if (!uploadRes.ok) {
              throw new Error(`Failed to upload reference audio: ${uploadRes.status}`);
            }
            
            const uploadedPaths = await uploadRes.json();
            if (Array.isArray(uploadedPaths) && uploadedPaths.length > 0) {
              refWavPayload = {
                path: uploadedPaths[0],
                orig_name: refFile.name,
                meta: { _type: "gradio.FileData" }
              };
            }
          } catch (uploadErr) {
            console.warn("Gradio /upload failed, attempting base64 fallback...", uploadErr);
            // Fallback for older Gradio versions
            if (refBase64) {
              const mimeType = refFile.type || 'audio/wav';
              const dataUri = `data:${mimeType};base64,${refBase64}`;
              refWavPayload = {
                data: dataUri,
                name: refFile.name,
                orig_name: refFile.name,
                meta: { _type: "gradio.FileData" }
              };
            }
          }
        }

        let promptText = voiceToUse && voiceToUse !== 'default' ? voiceToUse : '';
        if (refWavPayload && (promptText === defaultVoxCPMVoice || promptText.toLowerCase() === 'alloy')) {
            promptText = '';
        }

        const controlInstruction = styleContext ? `Speak ${styleContext}${intensitySuffix}` : 'Speak naturally and clearly.';
        
        // Use the official /generate API with named fields as requested
        const payload = {
          text: textToSynthesize,
          control_instruction: controlInstruction,
          ref_wav: refWavPayload, // This might need to be a URL or FileData depending on the backend, 
                                 // keeping the current payload structure which usually handles both.
          use_prompt_text: !!promptText,
          prompt_text_value: promptText,
          cfg_value: 2.0,
          do_normalize: false,
          denoise: false,
          dit_steps: 10
        };

        let res;
        try {
          // Attempt the new /generate direct endpoint first
          res = await fetch(`${baseURL}/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
            body: JSON.stringify(payload)
          });
          
          if (!res.ok) {
            // Fallback to Gradio array style if /generate fails
            console.warn("/generate failed, falling back to Gradio API...");
            const gradioPayload = {
              data: [
                payload.text,
                payload.control_instruction,
                payload.ref_wav,
                payload.use_prompt_text,
                payload.prompt_text_value,
                payload.cfg_value,
                payload.do_normalize,
                payload.denoise,
                payload.dit_steps
              ]
            };
            
            const startRes = await fetch(`${baseURL}/gradio_api/call/generate`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
              body: JSON.stringify(gradioPayload)
            });
            
            if (!startRes.ok) throw new Error(`VoxCPM Gradio start failed: ${startRes.status}`);
            
            const startData = await startRes.json();
            const eventId = startData.event_id;
            
            // Poll for result
            const resultRes = await fetch(`${baseURL}/gradio_api/call/generate/${eventId}`, {
              headers: { 'ngrok-skip-browser-warning': 'true' }
            });
            
            if (!resultRes.ok) throw new Error("Gradio result fetch failed");
            
            const resultText = await resultRes.text();
            const match = resultText.match(/data:\s*(\[.*\])/s);
            if (!match) throw new Error("No data in Gradio response");
            
            const parsed = JSON.parse(match[1]);
            const audioPath = parsed?.[0]?.url || parsed?.[0]?.path;
            if (!audioPath) throw new Error("No audio path in Gradio result");
            
            const audioUrl = audioPath.startsWith('http') ? audioPath : `${baseURL}${audioPath}`;
            const finalAudioRes = await fetch(audioUrl, { headers: { 'ngrok-skip-browser-warning': 'true' } });
            return await finalAudioRes.blob();
          }

          const blob = await res.blob();
          return blob;
        } catch (err: any) {
          if (err.name === 'TypeError' && err.message.includes('Failed to fetch')) {
            throw new Error(`Failed to connect to VoxCPM at ${baseURL}. Ensure ngrok is running and HTTPS is used.`);
          }
          throw err;
        }
      }

      if (engineToUse === 'google-free') {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: textToSynthesize, lang: 'km' })
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Failed to fetch free TTS');
        }
        const data = await res.json();
        
        if (!data.results || data.results.length === 0) {
          throw new Error('No audio returned');
        }

        // Fix: googleTTS returns base64 MP3 chunks. We encode them to a single MP3 blob.
        const base64Chunks = data.results.map((r: any) => r.base64);
        const audioData = base64Chunks.join('');
        const binary = atob(audioData);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'audio/mp3' });
        return blob;
      }

      // Create a prompt that encourages dramatic, expressive Khmer
      const prompt = `Read the following Khmer text ${styleContext ? (styleContext + intensitySuffix) : 'vividly and passionately, with deeply emotional and dramatic tone resembling a Chinese short video drama'}: ${textToSynthesize}`;
      
      const localGeminiKey = localStorage.getItem('gemini_api_key');
      
      const response = await fetch('/api/generate-gemini-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          voiceName: voiceToUse,
          userApiKey: localGeminiKey
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to generate Gemini audio');
      }

      const { base64Audio } = await response.json();
      if (!base64Audio) {
        throw new Error('No audio data received');
      }

      // Decode base64 PCM16 into WAV blob
      const binary = atob(base64Audio);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const pcm16 = new Int16Array(bytes.buffer);
      const wavBlob = encodeWAV(pcm16, 24000); // TTS endpoint sample rate is 24kHz

      return wavBlob;
    } catch (err: any) {
      console.error('Failed to generate audio for subtitle', sub.id, err);
      let errMsg = err.message || String(err);
      let advice = "";

      if (errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED')) {
         errMsg = "Rate limit or quota exceeded.";
         advice = " Please wait a few minutes before trying again or use a different API key.";
      } else if (errMsg.includes('403') || errMsg.includes('PERMISSION_DENIED') || errMsg.includes('API_KEY_INVALID')) {
         errMsg = "API Key error.";
         advice = " Please check your Gemini API key in the 'Settings' tab. Ensure it's active and has access to 'gemini-3.1-flash-tts-preview'.";
      } else if (errMsg.includes('401') || errMsg.includes('UNAUTHENTICATED')) {
         errMsg = "Unauthenticated request.";
         advice = " Ensure your API key is correct and properly configured in Settings.";
      } else if (errMsg.includes('NetworkError') || errMsg.includes('Failed to fetch')) {
         errMsg = "Network error.";
         advice = " Please check your internet connection and ensure the TTS service is accessible.";
      } else if (errMsg.includes('No audio data received') || errMsg.includes('No audio returned')) {
         errMsg = "Empty audio response.";
         advice = " The model was unable to generate speech for this text. Try modifying the text or using a different voice.";
      } else if (errMsg.includes('Safety') || errMsg.includes('SAFETY')) {
         errMsg = "Safety filter trigger.";
         advice = " The content was flagged by the safety filter. Try rephrasing the text.";
      }

      setErrorMsg(`${errMsg}${advice}`);
      return null;
    }
  };

  const handleVoiceChange = (id: number, voice: string) => {
    updateSubtitles((prev) => prev.map((s) => (s.id === id ? { ...s, voice, audioUrl: undefined, waveformPeaks: undefined } : s)));
  };

  const handleDragPointerDown = useCallback((
    e: React.PointerEvent, 
    subId: number, 
    type: 'text' | 'audio' | 'trim-audio-start' | 'trim-audio-end' | 'trim-text-start' | 'trim-text-end'
  ) => {
    const sub = subtitles.find(s => s.id === subId);
    if (!sub) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    
    const initialAudioDuration = sub.audioDuration ?? (sub.endTime - sub.startTime);
    const initialAudioTrimStart = sub.audioTrimStart ?? 0;
    const initialAudioTrimEnd = sub.audioTrimEnd ?? initialAudioDuration;
    const initialAudioStartTime = sub.audioStartTime ?? sub.startTime;

    dragInfoRef.current = {
      id: subId,
      type,
      startX: e.clientX,
      initialTime: sub.startTime,
      initialEndTime: sub.endTime,
      initialAudioStartTime,
      initialAudioTrimStart,
      initialAudioTrimEnd,
      initialAudioDuration,
      element: target,
      isLinked: sub.isLinked ?? true,
      rafId: null,
      lastDx: 0
    };

    setDragVisuals({
      id: subId,
      type,
      startTime: sub.startTime,
      endTime: sub.endTime,
      audioStartTime: initialAudioStartTime,
      audioTrimStart: initialAudioTrimStart,
      audioTrimEnd: initialAudioTrimEnd
    });
  }, [subtitles]);

  const handleDragPointerMove = useCallback((e: React.PointerEvent) => {
    const drag = dragInfoRef.current;
    if (!drag) return;
    
    const dx = e.clientX - drag.startX;
    if (Math.abs(dx - drag.lastDx) < 0.2) return; 
    drag.lastDx = dx;
    
    if (drag.rafId === null) {
      drag.rafId = requestAnimationFrame(() => {
        const currentDrag = dragInfoRef.current;
        if (!currentDrag) return;
        
        const currentDx = currentDrag.lastDx;
        const deltaTime = zoomLevel > 0 ? currentDx / zoomLevel : 0;
        
        // Snapping Logic
        const snapThreshold = 10 / zoomLevel; 
        const findSnap = (targetTime: number) => {
          if (Math.abs(targetTime - timelineCurrentTime) < snapThreshold) {
            return timelineCurrentTime - targetTime;
          }
          for (const s of subtitles) {
            if (s.id === currentDrag.id) continue;
            if (Math.abs(targetTime - s.startTime) < snapThreshold) return s.startTime - targetTime;
            if (Math.abs(targetTime - s.endTime) < snapThreshold) return s.endTime - targetTime;
          }
          return 0;
        };

        const snappedDeltaTime = deltaTime + findSnap(
          currentDrag.type === 'text' ? currentDrag.initialTime + deltaTime :
          currentDrag.type === 'audio' ? currentDrag.initialAudioStartTime + deltaTime :
          0
        );

        setDragVisuals(prev => {
          if (!prev || prev.id !== currentDrag.id) return prev;
          const next = { ...prev };
          const dt = snappedDeltaTime;
          const isLinked = currentDrag.isLinked;
          const MIN_DUR = 0.1;

          if (currentDrag.type === 'text') {
            const duration = currentDrag.initialEndTime - currentDrag.initialTime;
            next.startTime = Math.max(0, currentDrag.initialTime + dt);
            next.endTime = next.startTime + duration;
            if (isLinked) next.audioStartTime = next.startTime;
          } else if (currentDrag.type === 'audio') {
            next.audioStartTime = Math.max(0, currentDrag.initialAudioStartTime + dt);
            if (isLinked) {
              const duration = currentDrag.initialEndTime - currentDrag.initialTime;
              next.startTime = next.audioStartTime;
              next.endTime = next.startTime + duration;
            }
          } else if (currentDrag.type === 'trim-text-start') {
            next.startTime = Math.max(0, Math.min(currentDrag.initialEndTime - MIN_DUR, currentDrag.initialTime + dt));
            if (isLinked) next.audioStartTime = next.startTime;
          } else if (currentDrag.type === 'trim-text-end') {
            next.endTime = Math.max(currentDrag.initialTime + MIN_DUR, currentDrag.initialEndTime + dt);
          } else if (currentDrag.type === 'trim-audio-start') {
            const maxTrimStart = currentDrag.initialAudioTrimEnd - MIN_DUR;
            next.audioTrimStart = Math.max(0, Math.min(maxTrimStart, currentDrag.initialAudioTrimStart + dt));
            const actualDelta = next.audioTrimStart - currentDrag.initialAudioTrimStart;
            next.audioStartTime = Math.max(0, currentDrag.initialAudioStartTime + actualDelta);
            if (isLinked) next.startTime = next.audioStartTime;
          } else if (currentDrag.type === 'trim-audio-end') {
            const minTrimEnd = currentDrag.initialAudioTrimStart + MIN_DUR;
            next.audioTrimEnd = Math.max(minTrimEnd, Math.min(currentDrag.initialAudioDuration, currentDrag.initialAudioTrimEnd + dt));
            if (isLinked) next.endTime = next.audioStartTime + (next.audioTrimEnd - next.audioTrimStart);
          }
          return next;
        });

        currentDrag.rafId = null;
      });
    }
  }, [zoomLevel, timelineCurrentTime, subtitles]);

  const handleDragPointerUp = useCallback((e: React.PointerEvent) => {
    const drag = dragInfoRef.current;
    if (!drag) return;
    
    if (drag.rafId) cancelAnimationFrame(drag.rafId);
    
    const target = e.currentTarget as HTMLElement;
    target.releasePointerCapture(e.pointerId);
    
    setDragVisuals(finalVisuals => {
      if (finalVisuals && finalVisuals.id === drag.id) {
        console.log(`[Timeline] Commit ${drag.type} for clip ${drag.id}.`);
        if (drag.type === 'audio' || drag.type === 'text') {
           console.log("drag clip", drag.id, "final startTime:", finalVisuals.startTime);
        } else if (drag.type.startsWith('trim')) {
           console.log("trim clip", drag.id, "trimStart:", finalVisuals.audioTrimStart, "trimEnd:", finalVisuals.audioTrimEnd);
        }

        updateSubtitles(prev => prev.map(s => {
          if (s.id !== drag.id) return s;
          return {
            ...s,
            startTime: finalVisuals.startTime,
            endTime: finalVisuals.endTime,
            audioStartTime: finalVisuals.audioStartTime,
            audioTrimStart: finalVisuals.audioTrimStart,
            audioTrimEnd: finalVisuals.audioTrimEnd
          };
        }));
      }
      return null;
    });

    dragInfoRef.current = null;
  }, [updateSubtitles]);

  const handleToggleLink = (id: number) => {
    updateSubtitles(prev => prev.map(s => {
      if (s.id === id) {
        const isLinked = !(s.isLinked ?? true);
        return {
          ...s,
          isLinked,
          audioStartTime: isLinked ? s.startTime : (s.audioStartTime ?? s.startTime)
        };
      }
      return s;
    }));
  };

  const handleEngineChange = (id: number, engine: string) => {
    updateSubtitles((prev) => prev.map((s) => (s.id === id ? { ...s, engine, voice: 'default', audioUrl: undefined, waveformPeaks: undefined } : s)));
  };

  const handlePreviewAudio = (e: React.MouseEvent, sub: Subtitle) => {
    e.stopPropagation();
    if (!sub.audioUrl) return;

    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.onended = null;
    }

    if (previewingId === sub.id) {
      setPreviewingId(null);
      return;
    }

    const audio = new Audio(sub.audioUrl);
    previewAudioRef.current = audio;
    setPreviewingId(sub.id);

    audio.onended = () => {
      setPreviewingId(null);
    };
    
    safePlay(audio);
  };

  // Generate audio for a single subtitle from UI
  const handleGenerateSingle = async (e: React.MouseEvent, sub: Subtitle) => {
    e.stopPropagation();
    setErrorMsg(null);
    setSubtitles((prev) => prev.map((s) => (s.id === sub.id ? { ...s, isGenerating: true } : s)));
    const blob = await generateSubtitleAudio(sub);
    let url = "";
    let duration = 0;
    let waveformPeaks: number[] | undefined;
    if (blob) {
      url = createTrackedUrl(blob);
      duration = await getAudioDuration(url);
      waveformPeaks = await generateWaveform(url);
    }
    // Stack new audio right after this subtitle's own previous clip (if any),
    // so re-generating a single line never jumps to the end of all clips.
    const thisClip = audioClips.find(c => c.id === sub.id);
    const suggestedStart = thisClip
      ? thisClip.endTime + 0.02            // stack after its own previous audio
      : sub.startTime;                     // first generation – align to subtitle

    updateSubtitles((prev) =>
      prev.map((s) => (s.id === sub.id ? {
        ...s,
        isGenerating: false,
        audioUrl: url || undefined,
        audioBlob: blob || undefined,
        audioDuration: duration || undefined,
        waveformPeaks,
        audioBufferId: url || undefined,
        audioTrimStart: 0,
        audioTrimEnd: duration || undefined,
        audioStartTime: suggestedStart
      } : s))
    );

    // Save audio blob to workspace
    if (blob && currentWorkspace) {
      const audioData = new Map(currentWorkspace.generatedAudio);
      audioData.set(sub.id, {
        blob,
        duration: duration || 0,
        waveformPeaks: waveformPeaks || [],
      });
      setCurrentWorkspace({
        ...currentWorkspace,
        generatedAudio: audioData,
      });
      setIsDirty(true);
    }

    if (url) {
       // Stop any existing preview
       if (previewAudioRef.current) {
         previewAudioRef.current.pause();
       }
       const audio = new Audio(url);
       previewAudioRef.current = audio;
       setPreviewingId(sub.id);
       audio.onended = () => setPreviewingId(null);
       safePlay(audio);
    }
  };

  // Generate all sequentially
  const handleGenerateAll = async () => {
    setErrorMsg(null);
    setIsGeneratingAll(true);
    // Start from the latest end among existing audio clips to avoid overlaps
    let currentMaxEnd = audioClips.reduce((m, c) => Math.max(m, c.endTime), 0);
    for (let i = 0; i < subtitles.length; i++) {
      if (subtitles[i].audioUrl) continue; // skip already generated

      // Optimistic update for loading state
      setSubtitles((prev) =>
        prev.map((s, idx) => (idx === i ? { ...s, isGenerating: true } : s))
      );

      const blob = await generateSubtitleAudio(subtitles[i]);
      let url = "";
      let duration = 0;
      let waveformPeaks: number[] | undefined;
      if (blob) {
        url = createTrackedUrl(blob);
        duration = await getAudioDuration(url);
        waveformPeaks = await generateWaveform(url);
      }
      
      // Compute non-overlapping start time for this generated clip
      const suggestedStart = Math.max(subtitles[i].startTime, currentMaxEnd + 0.02);

      // Update with result (and set suggested audio start)
      updateSubtitles((prev) =>
        prev.map((s, idx) =>
          idx === i ? {
            ...s,
            isGenerating: false,
            audioUrl: url || undefined,
            audioBlob: blob || undefined,
            audioDuration: duration || undefined,
            waveformPeaks,
            audioBufferId: url || undefined,
            audioTrimStart: 0,
            audioTrimEnd: duration || undefined,
            audioStartTime: suggestedStart
          } : s
        )
      );

      // Save audio blob to workspace
      if (blob && currentWorkspace) {
        const audioData = new Map(currentWorkspace.generatedAudio);
        audioData.set(subtitles[i].id, {
          blob,
          duration: duration || 0,
          waveformPeaks: waveformPeaks || [],
        });
        setCurrentWorkspace({
          ...currentWorkspace,
          generatedAudio: audioData,
        });
        setIsDirty(true);
      }

      // Advance our current max end for subsequent clips in this batch
      currentMaxEnd = suggestedStart + (duration || 0);

      if (!blob) {
        // Break the loop if there was an error (e.g., 429 quota exceeded)
        break;
      }

      // Auto-play the audio snippet we just generated, and wait for it to finish!
      if (previewAudioRef.current) previewAudioRef.current.pause();
      const audio = new Audio(url);
      previewAudioRef.current = audio;
      setPreviewingId(subtitles[i].id);
        
      await new Promise<void>((resolve) => {
         audio.onended = () => {
            setPreviewingId(null);
            resolve();
         };
         safePlay(audio).then(() => {
            // Fallback for end in case onended doesn't fire as expected
            const duration = audio.duration;
            if (Number.isFinite(duration)) {
              setTimeout(resolve, duration * 1000 + 100);
            }
         });
      });

      // Add a delay to avoid rate limiting (Gemini Free Tier is 15 RPM, so 4.1s per request to be safe)
      if (i < subtitles.length - 1) {
        await new Promise((res) => setTimeout(res, 4100));
      }
    }
    setIsGeneratingAll(false);
  };

  const [isExportingAudio, setIsExportingAudio] = useState(false);

  const [refStartTime, setRefStartTime] = useState("00:00:00");
  const [refEndTime, setRefEndTime] = useState("00:00:10");
  const [isExtractingRef, setIsExtractingRef] = useState(false);
  const ffmpegRef = useRef<FFmpeg | null>(null);

  const handleExtractVoiceRef = async () => {
    if (!videoFile) return;
    
    const startSec = parseTime(refStartTime);
    const endSec = parseTime(refEndTime);
    const duration = endSec - startSec;

    if (duration <= 0) {
      setErrorMsg("End time must be greater than start time.");
      return;
    }
    
    if (duration > 30) {
       if (!window.confirm(`Extraction duration is ${duration.toFixed(0)}s, which is longer than the recommended 30s for voice cloning. Continue?`)) return;
    }

    setIsExtractingRef(true);
    setErrorMsg(null);

    try {
      if (!ffmpegRef.current) {
        const ffmpeg = new FFmpeg();
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
        await ffmpeg.load({
            coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
            wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });
        ffmpegRef.current = ffmpeg;
      }

      const ffmpeg = ffmpegRef.current;
      const fileExt = videoFile.name.split('.').pop() || 'mp4';
      const inputName = 'input.' + fileExt;
      await ffmpeg.writeFile(inputName, await fetchFile(videoFile));

      const timeStamp = `${refStartTime.replace(/:/g, '-')}_${refEndTime.replace(/:/g, '-')}`;
      const outputName = `voice-ref-${timeStamp}.wav`;
      
      // ffmpeg -i input.mp4 -ss START -to END -vn -ac 1 -ar 16000 voice-ref.wav
      await ffmpeg.exec([
        '-i', inputName,
        '-ss', startSec.toString(),
        '-to', endSec.toString(),
        '-vn',
        '-ac', '1',
        '-ar', '16000',
        outputName
      ]);

      const data = await ffmpeg.readFile(outputName);
      const wavBlob = new Blob([data as any], { type: 'audio/wav' });
      const wavFile = new File([wavBlob], outputName, { type: 'audio/wav' });

      // Automatically set as global ref audio
      setReferenceAudioFile(wavFile);
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        if (typeof result === 'string') {
          const base64 = result.split(',')[1];
          setReferenceAudioBase64(base64);
        }
      };
      reader.readAsDataURL(wavFile);
      
      // Download
      const url = createTrackedUrl(wavBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = outputName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setExportStatus("Voice reference extracted and set!");
      setTimeout(() => setExportStatus(null), 3000);
    } catch (err) {
      console.error('Failed to extract voice ref:', err);
      setErrorMsg("Failed to extract voice ref. Ensure cross-origin isolation is enabled and video is loaded.");
    } finally {
      setIsExtractingRef(false);
    }
  };

  const handleAutoTrim = useCallback(async (id: number) => {
    const sub = subtitles.find(s => s.id === id);
    if (!sub || !sub.audioUrl) return;

    setExportStatus("Auto trimming...");
    try {
      const { start, end } = await autoTrimSilence(sub.audioUrl);
      updateSubtitles(prev => prev.map(s => {
        if (s.id === id) {
          const originalDuration = s.audioDuration || (s.endTime - s.startTime);
          const newDuration = end - start;
          const shift = start; // How much we cut from the beginning
          
          return {
            ...s,
            audioTrimStart: start,
            audioTrimEnd: end,
            // Adjust timeline positions to match the trimmed length if it's linked
            // or just update duration
            endTime: s.startTime + newDuration
          };
        }
        return s;
      }));
      setExportStatus("Trimmed!");
      setTimeout(() => setExportStatus(null), 2000);
    } catch (e) {
      console.error("Auto trim failed", e);
      setErrorMsg("Failed to auto trim silence.");
      setExportStatus(null);
    }
  }, [subtitles, updateSubtitles]);

  const handleExportDubbedWav = async () => {
    await handleExportDubbedWAV_FIXED(
      audioClips,
      dubVolume,
      encodeWAV,
      setIsExportingAudio,
      setExportStatus,
      setErrorMsg
    );
  };

  // Synchronize audio playback with transport
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      activeAudioRefs.current.forEach(audio => {
        audio.pause();
      });
      activeAudioRefs.current.clear();
    };
  }, []);


  useEffect(() => {
    if (!timelineContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setTimelineViewportWidth(entry.contentRect.width);
      }
    });
    observer.observe(timelineContainerRef.current);
    return () => observer.disconnect();
  }, [timelineViewportWidth]);

  const allObjectUrlsRef = useRef<Set<string>>(new Set());
  
  // Helper to create and track object URLs
  const createTrackedUrl = (blob: Blob | File) => {
    const url = URL.createObjectURL(blob);
    allObjectUrlsRef.current.add(url);
    return url;
  };

  // 1. Manage Event Listeners
  useEffect(() => {
    const handleResetTrimEvent = (e: any) => {
      const { id, type } = e.detail;
      updateSubtitles(prev => prev.map(s => {
        if (s.id === id) {
          if (type === 'audio') {
            return {
              ...s,
              audioTrimStart: 0,
              audioTrimEnd: s.audioDuration,
              startTime: s.audioStartTime ?? s.startTime,
              endTime: (s.audioStartTime ?? s.startTime) + (s.audioDuration ?? (s.endTime - s.startTime))
            };
          }
        }
        return s;
      }));
    };

    window.addEventListener('reset-trim', handleResetTrimEvent);
    return () => {
      window.removeEventListener('reset-trim', handleResetTrimEvent);
    };
  }, [updateSubtitles]);

  // 2. Cleanup ALL object URLs ONLY on unmount
  useEffect(() => {
    return () => {
      console.log("Cleaning up all object URLs on unmount...");
      allObjectUrlsRef.current.forEach(url => {
        try {
          URL.revokeObjectURL(url);
        } catch (e) {
          // Ignore errors during cleanup
        }
      });
      allObjectUrlsRef.current.clear();
    };
  }, []);

  return (
    <ErrorBoundary>
    <div className="w-full h-screen bg-[#020617] text-slate-200 font-sans overflow-hidden flex flex-col">
      <DebugOverlay 
        selectedClipId={selectedClipId} 
        audioClips={audioClips} 
        activeSub={activeSub}
        timelineCurrentTime={timelineCurrentTime} 
        zoomLevel={zoomLevel} 
        videoRef={videoRef}
        videoDuration={videoDuration}
        srtDuration={srtDuration}
        fitSrtToVideo={fitSrtToVideo}
        setSelectedClipId={setSelectedClipId} 
      />
      <datalist id="voxcpm-voices">
        {VOXCPM_VOICES.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
      </datalist>

      {/* Top Header */}
      <header className="h-14 shrink-0 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/50 backdrop-blur-md">
        {/* Shortcuts Modal */}
        {showShortcuts && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowShortcuts(false)}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden" 
              onClick={e => e.stopPropagation()}
            >
              <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-amber-500" />
                  <h3 className="text-lg font-bold text-white">Keyboard Shortcuts</h3>
                </div>
                <button onClick={() => setShowShortcuts(false)} className="p-1 hover:bg-slate-800 rounded-full transition-colors text-slate-400">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 grid grid-cols-2 gap-6 text-sm">
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Playback</h4>
                  <div className="flex justify-between items-center bg-slate-950/50 p-2 rounded border border-slate-800/50">
                    <span className="text-slate-400">Play / Pause</span>
                    <kbd className="px-2 py-1 bg-slate-800 rounded text-amber-500 font-mono text-xs shadow-sm shadow-black/40 border border-slate-700/50">Space</kbd>
                  </div>
                  <div className="flex justify-between items-center bg-slate-950/50 p-2 rounded border border-slate-800/50">
                    <span className="text-slate-400">Step Back</span>
                    <kbd className="px-2 py-1 bg-slate-800 rounded text-amber-500 font-mono text-xs shadow-sm shadow-black/40 border border-slate-700/50">←</kbd>
                  </div>
                  <div className="flex justify-between items-center bg-slate-950/50 p-2 rounded border border-slate-800/50">
                    <span className="text-slate-400">Step Forward</span>
                    <kbd className="px-2 py-1 bg-slate-800 rounded text-amber-500 font-mono text-xs shadow-sm shadow-black/40 border border-slate-700/50">→</kbd>
                  </div>
                  <div className="flex justify-between items-center bg-slate-950/50 p-2 rounded border border-slate-800/50">
                    <span className="text-slate-400">1s Jump</span>
                    <kbd className="px-2 py-1 bg-slate-800 rounded text-amber-500 font-mono text-xs shadow-sm shadow-black/40 border border-slate-700/50">Shift + ←/→</kbd>
                  </div>
                </div>
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Editor</h4>
                  <div className="flex justify-between items-center bg-slate-950/50 p-2 rounded border border-slate-800/50">
                    <span className="text-slate-400">Prev Subtitle</span>
                    <kbd className="px-2 py-1 bg-slate-800 rounded text-amber-500 font-mono text-xs shadow-sm shadow-black/40 border border-slate-700/50">↑</kbd>
                  </div>
                  <div className="flex justify-between items-center bg-slate-950/50 p-2 rounded border border-slate-800/50">
                    <span className="text-slate-400">Next Subtitle</span>
                    <kbd className="px-2 py-1 bg-slate-800 rounded text-amber-500 font-mono text-xs shadow-sm shadow-black/40 border border-slate-700/50">↓</kbd>
                  </div>
                  <div className="flex justify-between items-center bg-slate-950/50 p-2 rounded border border-slate-800/50">
                    <span className="text-slate-400">Delete Clip</span>
                    <kbd className="px-2 py-1 bg-slate-800 rounded text-amber-500 font-mono text-xs shadow-sm shadow-black/40 border border-slate-700/50">Del / BS</kbd>
                  </div>
                  <div className="flex justify-between items-center bg-slate-950/50 p-2 rounded border border-slate-800/50">
                    <span className="text-slate-400">Keyboard help</span>
                    <kbd className="px-2 py-1 bg-slate-800 rounded text-amber-500 font-mono text-xs shadow-sm shadow-black/40 border border-slate-700/50">?</kbd>
                  </div>
                </div>
                <div className="col-span-2 space-y-4 pt-2">
                   <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Timeline</h4>
                   <div className="flex justify-between items-center bg-slate-950/50 p-2 rounded border border-slate-800/50">
                    <span className="text-slate-400">Zoom Canvas</span>
                    <kbd className="px-2 py-1 bg-slate-800 rounded text-amber-500 font-mono text-xs shadow-sm shadow-black/40 border border-slate-700/50">Ctrl / ⌘ + (+/-)</kbd>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-slate-950/50 border-t border-slate-800 text-xs text-slate-500 text-center italic">
                You can also drag handles on the timeline for fine-tuning audio start/end.
              </div>
            </motion.div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-500 rounded flex items-center justify-center text-slate-950 font-bold">
            K
          </div>
          <span className="font-semibold tracking-tight text-lg">KhmerDub <span className="text-amber-500">Studio</span></span>
        </div>

        {/* Workspace Manager */}
        {currentWorkspaceId && (
          <WorkspaceManager
            currentWorkspaceId={currentWorkspaceId}
            onWorkspaceChange={handleWorkspaceChange}
            currentWorkspace={currentWorkspace}
            isDirty={isDirty}
          />
        )}

        <div className="flex items-center gap-4">
          <button onClick={() => setShowSettings(true)} className="p-2 hover:bg-slate-800 rounded-md text-slate-400 hover:text-white transition-colors">
            <Settings className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-1 bg-slate-800/50 rounded-md p-1 mr-2">
            <button 
              onClick={undo} 
              disabled={historyIndex <= 0}
              className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:hover:bg-transparent"
              title="Undo"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button 
              onClick={redo} 
              disabled={historyIndex >= history.length - 1}
              className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:hover:bg-transparent"
              title="Redo"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>

          {/* Autosave indicator */}
          {autosaveStatus !== 'idle' && (
            <div className={`flex items-center gap-1.5 text-[10px] font-medium px-2 py-1 rounded border transition-all ${autosaveStatus === 'saving' ? 'text-amber-400 border-amber-500/30 bg-amber-500/10' : 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'}`}>
              {autosaveStatus === 'saving'
                ? <><Loader2 className="w-3 h-3 animate-spin" />Saving…</>
                : <><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />Saved</>
              }
            </div>
          )}

          <button
            onClick={handleManualSave}
            disabled={!isDirty}
            className="px-4 py-1.5 bg-slate-800 rounded-md text-sm font-medium border border-slate-700 hidden md:block hover:bg-slate-700 disabled:opacity-50 transition-colors"
          >
            រក្សាទុក
          </button>
          <button 
            disabled={isExportingAudio || audioClips.length === 0}
            onClick={handleExportDubbedWav}
            className="px-4 py-1.5 bg-amber-500 text-slate-950 rounded-md text-sm font-bold shadow-lg shadow-amber-500/20 disabled:opacity-50 min-w-[140px]"
          >
            {isExportingAudio ? (exportStatus || 'កំពុងនាំចេញ...') : (exportStatus === "Export complete!" ? "Export complete!" : 'Export Dubbed WAV')}
          </button>
          <button className="px-4 py-1.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-md text-sm font-bold shadow-lg shadow-amber-500/5 hidden md:block">នាំចេញវីដេអូ</button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Panels Row */}
        <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Left Panel: Upload Controls & Speakers */}
        <aside className="border-r border-slate-800 flex flex-col bg-[#020617] hidden md:flex shrink-0 relative" style={{width: leftPanelWidth + 'px'}}>
          {/* Left panel resize handle */}
          <div
            className={`absolute top-0 right-0 bottom-0 w-3 cursor-col-resize z-50 flex items-center justify-center group transition-colors ${isResizingLeft ? 'bg-amber-500/20' : 'hover:bg-amber-500/10'}`}
            onMouseDown={(e) => { e.preventDefault(); setIsResizingLeft(true); }}
          >
            <div className={`flex flex-col gap-[3px] items-center transition-opacity ${isResizingLeft ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
              {[0,1,2,3,4].map(i => <div key={i} className={`h-5 w-[2px] rounded-full ${isResizingLeft ? 'bg-amber-400' : 'bg-slate-500 group-hover:bg-amber-500/70'}`} />)}
            </div>
          </div>
          <div className="flex border-b border-slate-800 h-11 shrink-0">
            <button 
              onClick={() => setLeftPanelTab('files')}
              className={`flex-1 text-[10px] font-bold uppercase tracking-widest transition-all relative ${leftPanelTab === 'files' ? 'text-amber-500 bg-slate-900/30' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Files
              {leftPanelTab === 'files' && <motion.div layoutId="leftTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500" />}
            </button>
            <button 
              onClick={() => setLeftPanelTab('speakers')}
              className={`flex-1 text-[10px] font-bold uppercase tracking-widest transition-all relative ${leftPanelTab === 'speakers' ? 'text-amber-500 bg-slate-900/30' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Speakers
              {leftPanelTab === 'speakers' && <motion.div layoutId="leftTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500" />}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 custom-scrollbar underline-offset-4">
            {leftPanelTab === 'files' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">ឯកសារ (Files)</h3>
                  <div className="space-y-4">
              {/* Video Upload */}
              <div className="relative border border-dashed border-slate-700 hover:border-amber-500 hover:bg-slate-800/50 transition-colors rounded p-4 flex flex-col items-center justify-center group cursor-pointer h-24">
                <Film className="w-5 h-5 text-slate-500 mb-2 group-hover:text-amber-400" />
                <span className="text-xs font-medium text-slate-400 group-hover:text-slate-200 text-center">
                  {videoFile ? videoFile.name : 'Upload Video (MP4/WebM/MKV)'}
                </span>
                <input 
                  type="file" 
                  accept="video/mp4,video/webm,video/x-matroska,.mkv" 
                  onChange={handleVideoUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </div>

              {/* SRT Upload */}
              <div className="relative border border-dashed border-slate-700 hover:border-amber-500 hover:bg-slate-800/50 transition-colors rounded p-4 flex flex-col items-center justify-center group cursor-pointer h-24">
                <FileText className="w-5 h-5 text-slate-500 mb-2 group-hover:text-amber-400" />
                <span className="text-xs font-medium text-slate-400 group-hover:text-slate-200 text-center">
                  {subtitles.length > 0 ? `${subtitles.length} lines loaded` : 'Upload Khmer SRT'}
                </span>
                <input 
                  type="file" 
                  accept=".srt" 
                  onChange={handleSRTUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </div>

              {/* Clear saved session */}
              {subtitles.length > 0 && (
                <button
                  onClick={() => {
                    if (window.confirm('Clear all subtitles and the saved session? Audio clips will be lost.')) {
                      localStorage.removeItem('autosave_subtitles');
                      localStorage.removeItem('autosave_speakers');
                      setSubtitles([]);
                      setSpeakers([]);
                    }
                  }}
                  className="w-full text-[10px] font-bold uppercase tracking-widest text-rose-500/70 hover:text-rose-400 border border-rose-500/20 hover:border-rose-500/50 rounded py-1.5 transition-colors bg-rose-500/5 hover:bg-rose-500/10"
                >
                  ✕ Clear Session
                </button>
              )}

              {/* Global Reference Audio Upload */}
              <div className="relative border border-dashed border-slate-700 hover:border-purple-500 hover:bg-slate-800/50 transition-colors rounded p-4 flex flex-col items-center justify-center group cursor-pointer h-24">
                {!referenceAudioFile ? (
                  <>
                    <Music className="w-5 h-5 text-slate-500 mb-2 group-hover:text-purple-400" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">VoxCPM Clone Ref</span>
                    <span className="text-xs font-medium text-slate-400 group-hover:text-slate-200 text-center truncate max-w-[90%]">
                      Upload Global Ref Audio
                    </span>
                    <input 
                      type="file" 
                      accept="audio/*" 
                      onChange={handleReferenceAudioUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </>
                ) : (
                  <div className="flex w-full items-center justify-between z-10 relative">
                    <div className="flex items-center gap-2 overflow-hidden flex-1">
                       <Music className="w-5 h-5 text-purple-400 shrink-0" />
                       <div className="flex flex-col overflow-hidden text-left">
                         <span className="text-[10px] text-purple-400 font-bold uppercase truncate">Ref Selected</span>
                         <span className="text-[11px] text-slate-300 truncate" title={referenceAudioFile.name}>{referenceAudioFile.name}</span>
                       </div>
                    </div>
                    <div className="flex gap-1 shrink-0 ml-1">
                      <button 
                         onClick={(e) => { e.preventDefault(); e.stopPropagation(); playAudioFile(referenceAudioFile); }} 
                         className="p-1.5 bg-slate-800 border border-slate-700 hover:border-slate-500 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200 transition-colors"
                         title="Play Reference Audio"
                      >
                         <Play className="w-3.5 h-3.5 fill-current" />
                      </button>
                      <button 
                         onClick={(e) => { e.preventDefault(); e.stopPropagation(); setReferenceAudioFile(null); setReferenceAudioBase64(null); }} 
                         className="p-1.5 bg-slate-800 border border-slate-700 hover:border-red-500/50 hover:bg-red-500/20 rounded text-slate-400 hover:text-red-400 transition-colors"
                         title="Remove Reference Audio"
                      >
                         <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Extract Voice Ref from Video */}
              <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-lg space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Square className="w-4 h-4 text-amber-500" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Extract Ref from Video</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 uppercase">Start</label>
                    <input 
                      type="text" 
                      value={refStartTime}
                      onChange={(e) => setRefStartTime(e.target.value)}
                      placeholder="00:00:00"
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 outline-none focus:border-amber-500/50"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 uppercase">End</label>
                    <input 
                      type="text" 
                      value={refEndTime}
                      onChange={(e) => setRefEndTime(e.target.value)}
                      placeholder="00:00:10"
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 outline-none focus:border-amber-500/50"
                    />
                  </div>
                </div>
                <button
                  onClick={handleExtractVoiceRef}
                  disabled={!videoFile || isExtractingRef}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold py-2 rounded border border-slate-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isExtractingRef ? <Loader2 className="w-3 h-3 animate-spin"/> : <Download className="w-3 h-3" />}
                  Extract Voice Ref
                </button>
              </div>
            </div>
          )}

          {leftPanelTab === 'speakers' && (
            <SpeakerManager 
              speakers={speakers} 
              updateSpeaker={updateSpeaker} 
              onAutoDetect={handleAutoDetectSpeakers}
              applySpeakerToAll={applySpeakerToAll}
              subtitles={subtitles}
              ttsEngine={ttsEngine}
              defaultGeminiVoice={defaultGeminiVoice}
              defaultVoxCPMVoice={defaultVoxCPMVoice}
            />
          )}
        </div>
          
          <div className="mt-auto p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-4 text-center mx-5 mb-5 shadow-2xl">
              {subtitles.length > 0 && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={handleAutoDetectEmotions}
                      disabled={isDetectingEmotions}
                      className="py-2 bg-slate-800 border border-slate-700 hover:border-amber-500/50 rounded-lg text-[10px] font-bold text-slate-300 uppercase tracking-wider flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    >
                      {isDetectingEmotions ? <Loader2 className="w-3 h-3 animate-spin"/> : <Languages className="w-3 h-3" />}
                      Detect Tone
                    </button>
                    <button 
                      onClick={handleExportSRT}
                      className="py-2 bg-slate-800 border border-slate-700 hover:border-amber-500/50 rounded-lg text-[10px] font-bold text-slate-300 uppercase tracking-wider flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    >
                      <Download className="w-3 h-3" />
                      Export SRT
                    </button>
                  </div>
                  <button
                    onClick={handleGenerateAll}
                    disabled={isGeneratingAll}
                    className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2.5 px-4 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm shadow-lg shadow-amber-500/20 active:scale-[0.98]"
                  >
                    {isGeneratingAll ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generating All...
                      </>
                    ) : (
                      'Generate All Clips'
                    )}
                  </button>
                </div>
              )}
          </div>
        </aside>

        {/* Right Panel: Subtitle List */}
        <aside className="flex-1 border-r border-slate-800 bg-slate-900/30 flex flex-col min-w-0 overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0">
            <h3 className="text-xs font-bold text-slate-500 uppercase">អត្ថបទ SRT (Subtitles)</h3>
            <div className="flex gap-2">
              <button 
                onClick={() => setIsBatchEditMode(!isBatchEditMode)}
                className={`p-1.5 rounded transition ${isBatchEditMode ? 'bg-amber-500/20 text-amber-500' : 'hover:bg-slate-800 text-slate-500 hover:text-slate-300'}`}
                title="Batch Edit"
              >
                <ListChecks className="w-4 h-4" />
              </button>
              <button className="p-1 hover:bg-slate-800 rounded">
                 <Music className="w-4 h-4 text-slate-500" />
              </button>
            </div>
          </div>
          
          {isBatchEditMode && (
            <div className="p-3 border-b border-slate-800 bg-slate-800/20 text-xs flex flex-col gap-3 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex gap-3 items-center">
                  <button 
                    onClick={handleSelectAll}
                    className="text-amber-500 hover:text-amber-400 capitalize underline"
                  >
                    Select All
                  </button>
                  <span className="text-slate-500">|</span>
                  <button 
                    onClick={handleDeselectAll}
                    className="text-slate-400 hover:text-slate-300 capitalize underline"
                  >
                    None
                  </button>
                </div>
                <span className="text-slate-400">{selectedSubtitles.size} selected</span>
              </div>
              <div className="flex flex-col gap-2">
                <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Find & Replace</div>
                <input 
                  type="text" 
                  placeholder="Find text..." 
                  value={batchFindText}
                  onChange={(e) => setBatchFindText(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 outline-none text-slate-200"
                />
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Replace with..." 
                    value={batchReplaceText}
                    onChange={(e) => setBatchReplaceText(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 outline-none text-slate-200"
                  />
                  <button 
                    onClick={handleBatchReplace}
                    className="bg-amber-500 hover:bg-amber-400 text-slate-900 px-3 rounded font-bold whitespace-nowrap transition-colors"
                  >
                    Replace
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                 <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Adjust Timing</div>
                 <div className="flex gap-2 items-center">
                   <input 
                     type="number"
                     step="0.1"
                     value={batchTimeShift}
                     onChange={(e) => setBatchTimeShift(e.target.value)}
                     className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 outline-none text-slate-200"
                     placeholder="Shift seconds (e.g. 1.5, -2)"
                   />
                   <button 
                     onClick={handleBatchTimeShift}
                     className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded font-bold whitespace-nowrap transition-colors"
                   >
                     Shift Time
                   </button>
                 </div>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 m-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-[11px] font-medium animate-in fade-in slide-in-from-top-2 duration-300 relative group pr-10 shadow-lg shadow-red-950/20">
              <div className="flex items-start gap-3.5">
                <div className="mt-0.5 shrink-0 p-1.5 bg-red-500/10 rounded-lg border border-red-500/20">
                  <X className="w-3 h-3 text-red-400/80" />
                </div>
                <div className="flex flex-col gap-1.5 flex-1 pr-2">
                  <span className="font-bold flex items-center gap-2 text-red-300">
                    <span className="w-1 h-1 rounded-full bg-red-500" />
                    TTS Generation Issue
                  </span>
                  <span className="opacity-80 leading-relaxed break-words">{errorMsg}</span>
                  <div className="mt-1 flex items-center gap-3">
                    <button 
                      onClick={() => setErrorMsg('')}
                      className="text-[10px] font-bold text-red-400/60 hover:text-red-400 underline underline-offset-2 transition-colors uppercase tracking-wider"
                    >
                      Dismiss
                    </button>
                    {(errorMsg.includes('API Key') || errorMsg.includes('Settings')) && (
                      <span className="text-[9px] text-slate-500 italic">Hint: Go to Settings tab above</span>
                    )}
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setErrorMsg('')}
                className="absolute top-3 right-3 p-1 rounded-md bg-transparent opacity-40 group-hover:opacity-100 transition-all hover:bg-red-500/20"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <VirtualSubtitleList
            subtitles={subtitles}
            scrollToActiveId={activeSub?.id}
            renderItem={(sub) => (
              <SubtitleListItem
                key={sub.id}
                sub={sub}
                isActive={activeSub?.id === sub.id}
                isBatchEditMode={isBatchEditMode}
                selectedSubtitles={selectedSubtitles}
                previewingId={previewingId}
                isGeneratingAll={isGeneratingAll}
                ttsEngine={ttsEngine}
                defaultVoxCPMVoice={defaultVoxCPMVoice}
                referenceAudioFile={referenceAudioFile}
                referenceAudioBase64={referenceAudioBase64}
                handleToggleLink={handleToggleLink}
                toggleSubtitleSelection={toggleSubtitleSelection}
                handlePreviewAudio={handlePreviewAudio}
                handleGenerateSingle={handleGenerateSingle}
                handleEngineChange={handleEngineChange}
                handleVoiceChange={handleVoiceChange}
                handleSubReferenceAudioUpload={handleSubReferenceAudioUpload}
                playAudioFile={playAudioFile}
                updateSubtitles={updateSubtitles}
                videoRef={videoRef}
              />
            )}
          />
        </aside>

        {/* Center: Video Player Area — portrait 9:16 */}
        <main className="bg-black/40 flex flex-col relative overflow-hidden shrink-0 border-l border-slate-800" style={{width: videoPanelWidth + 'px'}}>
          {/* Video panel resize handle */}
          <div
            className={`absolute top-0 left-0 bottom-0 w-3 cursor-col-resize z-50 flex items-center justify-center group transition-colors ${isResizingVideo ? 'bg-amber-500/20' : 'hover:bg-amber-500/10'}`}
            onMouseDown={(e) => { e.preventDefault(); setIsResizingVideo(true); }}
          >
            <div className={`flex flex-col gap-[3px] items-center transition-opacity ${isResizingVideo ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
              {[0,1,2,3,4].map(i => <div key={i} className={`h-5 w-[2px] rounded-full ${isResizingVideo ? 'bg-amber-400' : 'bg-slate-500 group-hover:bg-amber-500/70'}`} />)}
            </div>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center p-3 relative overflow-y-auto">
            <div className="w-full bg-slate-900 rounded-lg shadow-2xl relative overflow-hidden ring-1 ring-slate-800 flex items-center justify-center shrink-0" style={{aspectRatio:'9/16', maxHeight:'calc(100vh - 14rem)'}}>
              {videoUrl ? (
                <>
                  <video 
                    key={videoUrl}
                    ref={videoRef}
                    src={videoUrl}
                    controls 
                    preload="metadata"
                    onLoadedMetadata={(e) => {
                      const v = e.currentTarget;
                      console.log("Video Metadata Loaded:", {
                        duration: v.duration,
                        videoWidth: v.videoWidth,
                        videoHeight: v.videoHeight,
                        readyState: v.readyState,
                        networkState: v.networkState
                      });
                      setVideoDuration(v.duration || 0);
                    }}
                    onLoadStart={() => console.log("Video Load Start")}
                    onCanPlay={() => console.log("Video Can Play")}
                    onWaiting={() => console.log("Video Waiting (Buffering...)")}
                    onError={(e) => {
                      const target = e.target as HTMLVideoElement;
                      const err = target.error;
                      console.error("Video Playback Error Detail:", {
                        code: err?.code,
                        message: err?.message,
                        src: target.src,
                        currentSrc: target.currentSrc,
                        readyState: target.readyState,
                        networkState: target.networkState
                      });
                      // If there's an error and it's a format issue
                      if (err) {
                        setShowMKVWarning(true);
                      }
                    }}
                    className="w-full h-full bg-black"
                  />

                  {showMKVWarning && (
                    <div className="absolute inset-0 z-20 bg-slate-900/95 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300 backdrop-blur-sm">
                      <div className="bg-amber-500/10 p-4 rounded-full mb-4">
                        <AlertTriangle className="w-10 h-10 text-amber-500" />
                      </div>
                      <h3 className="text-lg font-bold text-white mb-2">បញ្ហានៃការចាក់វីដេអូ (Playback Error)</h3>
                      <p className="text-sm text-slate-400 mb-6 max-w-sm leading-relaxed">
                        វីដេអូនេះប្រហែលជាមិនត្រូវបានគាំទ្រដោយកម្មវិធីរុករកទេ។ ចុច "Optimize" ដើម្បីបំលែងវាទៅជា MP4 ។<br/>
                        <span className="text-[11px] opacity-70">(Your browser may not support this video format. Click "Optimize" to prepare it for smooth playback.)</span>
                      </p>
                      
                      <div className="flex flex-col gap-3 w-full max-w-xs">
                        <button 
                          onClick={handleOptimizeMKV}
                          disabled={isTranscodingVideo}
                          className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2.5 px-6 rounded-lg transition-all flex items-center justify-center gap-2 group shadow-lg shadow-amber-500/20 disabled:opacity-50"
                        >
                          {isTranscodingVideo ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Optimizing Video...
                            </>
                          ) : (
                            <>
                              <Play className="w-4 h-4 group-hover:scale-110 transition shrink-0" />
                              Optimize for Playback
                            </>
                          )}
                        </button>

                        <button 
                          onClick={() => {
                            if (videoFile) {
                              const oldUrl = videoUrl;
                              setVideoUrl('');
                              setTimeout(() => {
                                if (oldUrl) {
                                  URL.revokeObjectURL(oldUrl);
                                  allObjectUrlsRef.current.delete(oldUrl);
                                }
                                setVideoUrl(createTrackedUrl(videoFile));
                                setShowMKVWarning(false);
                              }, 100);
                            }
                          }}
                          className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-2 px-6 rounded-lg border border-slate-700 transition"
                        >
                          Retry Loading
                        </button>
                        
                        <button 
                          onClick={() => setShowMKVWarning(false)}
                          className="text-xs text-slate-500 hover:text-slate-300 underline py-2 hover:bg-white/5 rounded transition"
                        >
                          Ignore and try local player
                        </button>
                      </div>

                      {isTranscodingVideo && (
                        <div className="mt-8 w-64 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-500 animate-[progress_10s_ease-in-out_infinite]" style={{ width: '40%' }}></div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center flex-col gap-4 bg-gradient-to-t from-slate-950/60 to-transparent text-slate-600">
                  <Play className="w-12 h-12 opacity-30" />
                  <span className="text-sm font-medium">Waiting for video...</span>
                </div>
              )}

              {/* Subtitle Overlay */}
              {activeSub && (
                <div className="absolute bottom-[10%] left-0 right-0 flex justify-center px-8 pointer-events-none z-10">
                   <div className={`bg-black/60 backdrop-blur-md px-4 py-2 rounded-lg border border-white/10 shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200 transition-shadow ${activeSub.emotions?.[0] ? EMOTIONS.find(e => e.id === activeSub.emotions?.[0])?.glow : ''}`}>
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <div className="w-1.5 h-3 rounded-full" style={{ backgroundColor: speakers.find(s => s.id === activeSub.speakerId)?.color || '#fff' }} />
                        <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest flex items-center gap-1">
                          {speakers.find(s => s.id === activeSub.speakerId)?.name || 'Speaker'}
                          {activeSub.emotions?.map(eid => {
                            const config = EMOTIONS.find(e => e.id === eid);
                            return <span key={eid} className={config?.color}>{config?.icon}</span>
                          })}
                        </span>
                      </div>
                      <p className="text-white text-lg md:text-xl font-medium text-center drop-shadow-lg leading-relaxed">
                        {activeSub.text}
                      </p>
                   </div>
                </div>
              )}
            </div>
            
            {/* Sync Warning */}
            {(() => {
              const activeSub = subtitles.find(s => timelineCurrentTime >= s.startTime && timelineCurrentTime <= s.endTime);
              if (activeSub && activeSub.audioUrl && activeSub.audioDuration) {
                 const subDuration = activeSub.endTime - activeSub.startTime;
                 if (activeSub.audioDuration > subDuration + 0.2) {
                    return (
                      <div className="w-full max-w-4xl mt-3 shrink-0 flex justify-center">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-full shadow-[0_0_10px_rgba(244,63,94,0.1)] transition-opacity">
                           <span className="relative flex h-2 w-2 items-center justify-center">
                             <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                             <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500"></span>
                           </span>
                           Audio drift detected: Synthesized audio ({activeSub.audioDuration.toFixed(1)}s) is longer than subtitle clip ({subDuration.toFixed(1)}s).
                           <button 
                             onClick={() => {
                               updateSubtitles(prev => prev.map(s => 
                                 s.id === activeSub.id ? { ...s, endTime: s.startTime + (s.audioDuration || 0) } : s
                               ));
                             }}
                             className="ml-2 px-2 py-0.5 bg-rose-500 text-white rounded hover:bg-rose-600 transition-colors font-bold whitespace-nowrap"
                           >
                             Extend to Fit
                           </button>
                        </div>
                      </div>
                    );
                 }
              }
              return null;
            })()}
          </div>
        </main>
        </div>{/* end Panels Row */}

          {/* Audio Timeline Panel — full width under all panels */}
          <div 
            className="shrink-0 border-t border-slate-800 bg-slate-950 flex flex-col overflow-hidden shadow-[inset_0_4px_20px_rgba(0,0,0,0.5)] relative"
            style={{ height: `${timelineHeight}px` }}
          >
            {/* Resize Handle */}
            <div
              className={`absolute top-0 left-0 right-0 h-3 cursor-row-resize z-50 flex items-center justify-center group transition-colors ${isResizingTimeline ? 'bg-amber-500/30' : 'hover:bg-amber-500/15'}`}
              onMouseDown={(e) => { e.preventDefault(); setIsResizingTimeline(true); }}
            >
              <div className={`flex gap-[3px] items-center transition-opacity ${isResizingTimeline ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                {[0,1,2,3,4].map(i => (
                  <div key={i} className={`w-5 h-[2px] rounded-full transition-colors ${isResizingTimeline ? 'bg-amber-400' : 'bg-slate-500 group-hover:bg-amber-500/70'}`} />
                ))}
              </div>
            </div>
            
            <div className="flex flex-col h-full overflow-hidden">
              {/* Timeline Toolbar */}
              <div className="shrink-0 px-3 py-2.5 flex items-center gap-3 border-b border-slate-800 bg-slate-900/80 select-none flex-wrap">

                {/* Left: Label + Transport */}
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest hidden lg:block opacity-70">Timeline</span>
                  
                  {/* Enhanced Play Button */}
                  <button
                    onClick={togglePlayback}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg font-bold transition-all active:scale-95 shadow-lg ${
                      isPlaying 
                        ? 'bg-amber-500 text-slate-950 shadow-amber-500/50' 
                        : 'bg-slate-800 border border-slate-700/50 text-slate-400 hover:text-amber-400 hover:border-amber-500/30 hover:shadow-amber-500/20'
                    }`}
                    title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                  >
                    {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                  </button>
                </div>

                {/* Prominent Time Display */}
                <div className="bg-slate-950/60 border border-amber-500/20 px-3 py-1.5 rounded-lg flex items-center gap-2 shrink-0 shadow-[inset_0_2px_8px_rgba(0,0,0,0.4)]">
                  <span className="font-mono text-xs font-bold text-amber-400 tabular-nums tracking-wider">{formatTime(timelineCurrentTime)}</span>
                  <span className="text-slate-600 text-xs">/</span>
                  <span className="font-mono text-xs text-slate-500 tabular-nums">{formatTime(totalDuration)}</span>
                </div>

                <div className="w-px h-6 bg-slate-700/50 shrink-0 opacity-40" />

                {/* Zoom Controls - Grouped */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1 bg-slate-800/80 border border-slate-700/50 rounded-lg px-1.5 py-1 shrink-0">
                    <button
                      onClick={() => {
                        const container = timelineContainerRef.current;
                        if (!container) return;
                        const centerTime = (container.scrollLeft + container.offsetWidth / 2) / zoomLevel;
                        const newZoom = Math.max(2, zoomLevel / 1.25);
                        setZoomLevel(newZoom);
                        requestAnimationFrame(() => { if (container) container.scrollLeft = centerTime * newZoom - container.offsetWidth / 2; });
                      }}
                      className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-700/80 text-slate-400 hover:text-white transition-colors active:scale-95"
                      title="Zoom Out (Ctrl+-)"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </button>
                    <div className="px-2 py-0.5 text-[10px] font-mono text-slate-500 tabular-nums whitespace-nowrap">{Math.round(zoomLevel / 20 * 100)}%</div>
                    <button
                      onClick={() => {
                        const container = timelineContainerRef.current;
                        if (!container) return;
                        const centerTime = (container.scrollLeft + container.offsetWidth / 2) / zoomLevel;
                        const newZoom = Math.min(500, zoomLevel * 1.25);
                        setZoomLevel(newZoom);
                        requestAnimationFrame(() => { if (container) container.scrollLeft = centerTime * newZoom - container.offsetWidth / 2; });
                      }}
                      className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-700/80 text-slate-400 hover:text-white transition-colors active:scale-95"
                      title="Zoom In (Ctrl++)"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                    <div className="w-px h-4 bg-slate-700/40 mx-0.5" />
                    <button
                      onClick={() => {
                        const containerWidth = timelineContainerRef.current?.offsetWidth || 800;
                        setZoomLevel(Math.max(2, (containerWidth - 40) / totalDuration));
                      }}
                      className="px-2 h-7 flex items-center justify-center rounded hover:bg-slate-700/80 text-slate-400 hover:text-white transition-colors text-[10px] font-bold active:scale-95"
                      title="Fit to Screen"
                    >
                      FIT
                    </button>
                  </div>

                  {/* View Mode */}
                  <div className="flex items-center gap-0.5 bg-slate-800/80 border border-slate-700/50 rounded-lg p-1 shrink-0">
                    <button
                      onClick={() => setTimelineViewMode('content')}
                      className={`px-2.5 h-6 rounded text-[10px] font-bold transition-colors whitespace-nowrap ${timelineViewMode === 'content' ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
                      title="Show content duration"
                    >CONTENT</button>
                    <button
                      onClick={() => setTimelineViewMode('video')}
                      className={`px-2.5 h-6 rounded text-[10px] font-bold transition-colors whitespace-nowrap ${timelineViewMode === 'video' ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
                      title="Show video duration"
                    >VIDEO</button>
                  </div>
                </div>

                {/* Auto-scroll Toggle */}
                <button
                  onClick={() => setFollowPlayhead(!followPlayhead)}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-all active:scale-95 shrink-0 ${
                    followPlayhead 
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-400 shadow-lg shadow-amber-500/20' 
                      : 'border-slate-700 text-slate-500 hover:text-white hover:border-slate-600/50'
                  }`}
                  title={followPlayhead ? 'Auto-scroll ON' : 'Auto-scroll OFF'}
                >
                  {followPlayhead ? <Link2 className="w-4 h-4" /> : <Link2Off className="w-4 h-4" />}
                </button>

                <div className="w-px h-6 bg-slate-700/50 shrink-0 opacity-40 hidden md:block" />

                {/* Volume Mix - Cleaner */}
                <div className="hidden md:flex items-center gap-4 shrink-0 ml-auto">
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setVideoVolume(videoVolume === 0 ? 0.5 : 0)} 
                      className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all active:scale-95 ${videoVolume === 0 ? 'text-slate-600 bg-slate-800/30' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`} 
                      title="Toggle original audio"
                    >
                      {videoVolume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume1 className="w-4 h-4" />}
                    </button>
                    <span className="text-[9px] text-slate-600 hidden lg:inline-block w-10">Original</span>
                    <input 
                      type="range" 
                      min="0" 
                      max="1" 
                      step="0.01" 
                      value={videoVolume}
                      onChange={(e) => setVideoVolume(parseFloat(e.target.value))}
                      className="w-20 h-1.5 accent-blue-500 cursor-pointer rounded-full" 
                      title="Original volume" 
                    />
                  </div>
                  <div className="w-px h-5 bg-slate-700/40" />
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setDubVolume(dubVolume === 0 ? 1 : 0)} 
                      className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all active:scale-95 ${dubVolume === 0 ? 'text-slate-600 bg-slate-800/30' : 'text-amber-500 hover:text-amber-400 hover:bg-amber-500/10'}`} 
                      title="Toggle dub audio"
                    >
                      {dubVolume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                    <span className="text-[9px] text-slate-600 hidden lg:inline-block w-8">Dub</span>
                    <input 
                      type="range" 
                      min="0" 
                      max="1" 
                      step="0.01" 
                      value={dubVolume}
                      onChange={(e) => setDubVolume(parseFloat(e.target.value))}
                      className="w-20 h-1.5 accent-amber-500 cursor-pointer rounded-full" 
                      title="Dub volume" 
                    />
                  </div>
                </div>

                {/* Keyboard Help */}
                <button
                  onClick={() => setShowShortcuts(true)}
                  className="ml-auto md:ml-2 w-8 h-8 flex items-center justify-center rounded-lg border border-slate-700 text-slate-500 hover:text-white hover:border-slate-600 transition-colors shrink-0 active:scale-95"
                  title="Keyboard Shortcuts (?)"
                >
                  <HelpCircle className="w-4 h-4" />
                </button>
              </div>
              
              <div 
                ref={timelineContainerRef}
                className="flex-1 relative bg-slate-900 overflow-x-auto overflow-y-auto select-none custom-scrollbar"
                onScroll={(e) => {
                  const target = e.currentTarget;
                  setTimelineScrollLeft(target.scrollLeft);
                  setTimelineViewportWidth(target.offsetWidth);
                }}
                onWheel={(e) => {
                  if (e.altKey || e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    const zoomSensitivity = 0.05;
                    const direction = e.deltaY > 0 ? -1 : 1;
                    const zoomFactor = 1 + direction * zoomSensitivity;
                    
                    const container = timelineContainerRef.current;
                    if (!container) return;
                    
                    const rect = container.getBoundingClientRect();
                    const mouseXInContainer = e.clientX - rect.left + container.scrollLeft;
                    const timeAtMouse = (mouseXInContainer - TIMELINE_LEFT_OFFSET) / pixelsPerSecond;
                    
                    const newZoom = Math.max(5, Math.min(500, pixelsPerSecond * zoomFactor));
                    
                    if (newZoom !== pixelsPerSecond) {
                      setZoomLevel(newZoom);
                      const newScrollLeft = (timeAtMouse * newZoom + TIMELINE_LEFT_OFFSET) - (e.clientX - rect.left);
                      requestAnimationFrame(() => {
                        if (container) container.scrollLeft = newScrollLeft;
                      });
                    }
                  }
                }}
              >
                <div 
                   className="relative min-w-full cursor-pointer"
                   style={{ 
                     width: `${timelineContentWidth}px`,
                     height: '100%' 
                   }}
                   onPointerDown={(e) => {
                     // Only scrub if clicking empty space or playhead area
                     if ((e.target as HTMLElement).closest('.timeline-clip')) return;

                     setIsScrubbing(true);
                     isScrubbingRef.current = true;
                     e.currentTarget.setPointerCapture(e.pointerId);
                     
                     const hasVideo = !!(videoRef.current && videoUrl);
                     if (hasVideo && videoRef.current) {
                        if (!videoRef.current.paused) {
                           videoRef.current.pause();
                           e.currentTarget.dataset.wasPlaying = 'true';
                        }
                     } else if (isPlaying) {
                        setIsPlaying(false);
                        e.currentTarget.dataset.wasPlaying = 'true';
                     }

                     const rect = e.currentTarget.getBoundingClientRect();
                     const x = e.clientX - rect.left;
                     handleTimelineScrub((x - TIMELINE_LEFT_OFFSET) / pixelsPerSecond);
                   }}
                 onPointerMove={(e) => {
                   if (isScrubbingRef.current) {
                     const rect = e.currentTarget.getBoundingClientRect();
                     const x = e.clientX - rect.left;
                     handleTimelineScrub((x - TIMELINE_LEFT_OFFSET) / pixelsPerSecond);
                   }
                 }}
                 onPointerUp={(e) => {
                   setIsScrubbing(false);
                   isScrubbingRef.current = false;
                   e.currentTarget.releasePointerCapture(e.pointerId);
                   
                   if (e.currentTarget.dataset.wasPlaying === 'true') {
                      if (videoRef.current && videoUrl) {
                        safePlay(videoRef.current);
                      } else {
                       setIsPlaying(true);
                       playTimeline();
                     }
                     delete e.currentTarget.dataset.wasPlaying;
                   }
                 }}
              >
                {/* Background grid / ruler */}
                <div className="sticky top-0 left-0 right-0 h-8 border-b border-slate-800 bg-slate-900 z-50">
                  {timelineRuler}
                </div>

                <div className="flex flex-col">
                  {/* Video Track - Improved */}
                  <div className="h-12 border-b border-slate-700/40 relative group flex items-center hover:bg-slate-800/40 transition-colors">
                    <div className="sticky left-0 z-20 h-full bg-gradient-to-r from-slate-950 to-slate-950/70 border-r border-slate-700 px-3 flex items-center gap-2.5 w-32 shrink-0 select-none">
                      <div className="w-2 h-2 rounded-full bg-slate-500 shrink-0 shadow-lg shadow-slate-500/30" />
                      <Film className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider truncate">Video</span>
                    </div>
                    <div className="relative flex-1 h-10 mx-2">
                       <div
                         className="h-full rounded-md relative overflow-hidden flex items-center pl-3 pointer-events-none border border-slate-700/20 shadow-inner"
                         style={{
                           width: `${videoDuration * pixelsPerSecond}px`,
                           minWidth: '4px',
                           background: 'linear-gradient(135deg, rgba(71,85,105,0.4) 0%, rgba(51,65,85,0.3) 100%)',
                         }}
                       >
                         <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(255,255,255,0.5) 40px, rgba(255,255,255,0.5) 41px)' }}></div>
                         <Film className="w-3 h-3 text-slate-400 shrink-0 mr-2" />
                         <span className="text-[10px] font-medium text-slate-400 truncate z-10">{videoFile ? videoFile.name : 'No video loaded'}</span>
                       </div>
                    </div>
                  </div>

                  {/* Subtitles Track - Improved */}
                  <div className="h-12 border-b border-slate-700/40 relative group flex items-center hover:bg-slate-800/40 transition-colors">
                    <div className="sticky left-0 z-20 h-full bg-gradient-to-r from-slate-950 to-slate-950/70 border-r border-slate-700 px-3 flex items-center gap-2.5 w-32 shrink-0 select-none">
                      <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0 shadow-lg shadow-amber-500/40" />
                      <FileText className="w-4 h-4 text-amber-400/70 shrink-0" />
                      <div className="flex flex-col min-w-0">
                        <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider truncate">Text</span>
                        {subtitles.length > 0 && <span className="text-[8px] text-slate-500 font-medium">{subtitles.length} clips</span>}
                      </div>
                    </div>
                    <div className="relative flex-1 h-full">
                      {visibleSubtitles.map((sub) => {
                        const isDragging = !!(dragVisuals && dragVisuals.id === sub.id);
                        const sTime = isDragging ? dragVisuals!.startTime : sub.startTime;
                        const eTime = isDragging ? dragVisuals!.endTime : sub.endTime;

                        return (
                               <TimelineClip 
                                  key={`sub-${sub.id}`}
                                  id={sub.id}
                                  type="subtitle"
                                  startTime={sTime}
                                  endTime={eTime}
                                  text={sub.text}
                                  zoomLevel={pixelsPerSecond}
                                  isActive={timelineCurrentTime >= sTime && timelineCurrentTime <= eTime}
                                  isSelected={selectedClipId?.id === sub.id && selectedClipId?.type === 'subtitle'}
                                  isDragging={isDragging}
                                  onSelect={() => {
                                    setSelectedClipId({ id: sub.id, type: 'subtitle' });
                                  }}
                                  onDragStart={handleDragPointerDown}
                                  onDragMove={handleDragPointerMove}
                                  onDragEnd={handleDragPointerUp}
                                  onAutoTrim={handleAutoTrim}
                                  emotions={sub.emotions}
                                />
                        );
                      })}
                    </div>
                  </div>

                  {/* Dub Audio Track - Improved */}
                  <div className="border-b border-slate-700/40 relative group flex items-center hover:bg-slate-800/40 transition-colors" style={{ height: `${Math.max(64, audioLanes.laneCount * 52)}px` }}>
                    <div className="sticky left-0 z-20 h-full bg-gradient-to-r from-slate-950 to-slate-950/70 border-r border-slate-700 px-3 flex items-center gap-2.5 w-32 shrink-0 select-none">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 shadow-lg shadow-emerald-500/40" />
                      <Music className="w-4 h-4 text-emerald-400/70 shrink-0" />
                      <div className="flex flex-col min-w-0">
                        <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider truncate">Dub</span>
                        {audioClips.length > 0 && <span className="text-[8px] text-slate-500 font-medium">{audioClips.length} clips</span>}
                      </div>
                    </div>
                    <div className="relative flex-1 h-full">
                      {audioClips.filter(clip => {
                          const viewportStartTime = timelineScrollLeft / pixelsPerSecond;
                          const viewportEndTime = (timelineScrollLeft + timelineViewportWidth) / pixelsPerSecond;
                          const padding = 2;
                          return (clip.startTime <= viewportEndTime + padding) && (clip.endTime >= viewportStartTime - padding);
                      }).map((clip) => {
                        const isDragging = !!(dragVisuals && dragVisuals.id === clip.id);
                        const sTime = isDragging ? dragVisuals!.startTime : clip.startTime;
                        const eTime = isDragging ? dragVisuals!.endTime : clip.endTime;
                        const tStart = isDragging ? dragVisuals!.audioTrimStart : clip.audioTrimStart;
                        const tEnd = isDragging ? dragVisuals!.audioTrimEnd : clip.audioTrimEnd;
                        const lane = audioLanes.laneMap.get(clip.id) ?? 0;
                        const laneHeight = 100 / audioLanes.laneCount;
                        const laneTopPct = lane * laneHeight;

                        return (
                        <TimelineClip 
                          key={`audio-${clip.id}`}
                          id={clip.id}
                          type="audio"
                          startTime={sTime}
                          endTime={eTime}
                          zoomLevel={zoomLevel}
                          audioUrl={clip.audioUrl}
                          waveformPeaks={clip.waveformPeaks}
                          audioTrimStart={tStart}
                          audioTrimEnd={tEnd}
                          audioDuration={clip.audioDuration}
                          engine={clip.engine}
                          voice={clip.voice}
                          isActive={timelineCurrentTime >= sTime && timelineCurrentTime < eTime}
                          isSelected={selectedClipId?.id === clip.id && selectedClipId?.type === 'audio'}
                          isDragging={isDragging}
                          onSelect={() => setSelectedClipId({ id: clip.id, type: 'audio' })}
                          onDragStart={handleDragPointerDown}
                          onDragMove={handleDragPointerMove}
                          onDragEnd={handleDragPointerUp}
                          laneTopPct={laneTopPct}
                          laneHeightPct={laneHeight}
                          onAutoTrim={handleAutoTrim}
                          isOverlapping={audioOverlaps.has(clip.id)}
                          emotions={clip.emotions}
                        />
                      );
                    })}
                    </div>
                  </div>
                </div>

                {/* Playhead indicator - Enhanced */}
                <div
                  className="absolute top-0 bottom-0 z-[100] pointer-events-none"
                  style={{ left: `${TIMELINE_LEFT_OFFSET + timelineCurrentTime * pixelsPerSecond}px` }}
                >
                  {/* Wider needle line with enhanced glow */}
                  <div className="absolute top-0 bottom-0 w-1 -translate-x-1/2 bg-gradient-to-r from-amber-400 to-amber-300 shadow-[0_0_12px_3px_rgba(251,191,36,0.5),0_0_24px_6px_rgba(251,191,36,0.25)]" />
                  
                  {/* Larger triangle handle with glow */}
                  <div
                    className="absolute top-0 -translate-x-1/2 bg-gradient-to-b from-amber-300 to-amber-400 shadow-[0_0_12px_2px_rgba(251,191,36,0.6),0_2px_8px_rgba(0,0,0,0.4)] flex items-start justify-center rounded-b-sm"
                    style={{ width: '18px', height: '24px', clipPath: 'polygon(0 0, 100% 0, 100% 68%, 50% 100%, 0 68%)' }}
                  >
                    <div className="w-1 h-3.5 bg-amber-900/30 mt-1 rounded-full" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

          {/* Mobile upload controls */}
          <div className="md:hidden p-4 border-t border-slate-800 bg-slate-900/50 flex flex-col gap-2 shrink-0">
             <div className="flex gap-2">
               <label className="flex-1 text-center py-2 px-4 bg-slate-800 border border-slate-700 rounded text-xs font-medium text-slate-300 cursor-pointer">
                 {videoFile ? 'Change Video' : 'Upload Video'}
                 <input type="file" accept="video/mp4,video/webm,video/x-matroska,.mkv" onChange={handleVideoUpload} className="hidden" />
               </label>
               <label className="flex-1 text-center py-2 px-4 bg-slate-800 border border-slate-700 rounded text-xs font-medium text-slate-300 cursor-pointer">
                 {subtitles.length > 0 ? 'Change SRT' : 'Upload SRT'}
                 <input type="file" accept=".srt" onChange={handleSRTUpload} className="hidden" />
               </label>
             </div>
             <div className="flex gap-2">
               <label className="flex-1 text-center py-2 px-4 bg-slate-800 border border-slate-700 rounded text-xs font-medium text-slate-300 cursor-pointer">
                 {referenceAudioFile ? 'Change Ref Audio' : 'Upload Ref Audio'}
                 <input type="file" accept="audio/*" onChange={handleReferenceAudioUpload} className="hidden" />
               </label>
             </div>
             {subtitles.length > 0 && (
                <button
                  onClick={handleGenerateAll}
                  disabled={isGeneratingAll}
                  className="w-full py-2 bg-amber-500 text-slate-950 rounded text-xs font-bold disabled:opacity-50"
               >
                 {isGeneratingAll ? 'Generating...' : 'Generate All Audio'}
               </button>
             )}
             <div className="mt-4 flex flex-col gap-2">
               <label className="text-xs text-slate-500 uppercase font-bold">TTS Engine</label>
               <div className="flex flex-wrap bg-slate-800 rounded p-1 gap-1">
                 <button 
                  onClick={() => setTtsEngine('google-free')}
                  className={`flex-1 min-w-[70px] text-[10px] py-1.5 rounded transition bg-transparent ${ttsEngine === 'google-free' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                 >Google Free</button>
                 <button 
                  onClick={() => setTtsEngine('voxcpm')}
                  className={`flex-1 min-w-[70px] text-[10px] py-1.5 rounded transition ${ttsEngine === 'voxcpm' ? 'bg-purple-600 text-white font-medium' : 'text-slate-400 hover:text-white'}`}
                 >VoxCPM</button>
                 <button 
                  onClick={() => setTtsEngine('gemini')}
                  className={`flex-1 min-w-[70px] text-[10px] py-1.5 rounded transition ${ttsEngine === 'gemini' ? 'bg-amber-600 text-white font-medium' : 'text-slate-400 hover:text-white'}`}
                 >Gemini</button>
               </div>
               {ttsEngine === 'google-free' && (
                 <p className="text-[10px] text-slate-500">Free, basic text-to-speech. Unlimited attempts.</p>
               )}
               {ttsEngine === 'voxcpm' && (
                 <p className="text-[10px] text-purple-400/80">Uses local VoxCPM Gradio endpoint for generation.</p>
               )}
               {ttsEngine === 'gemini' && (
                 <p className="text-[10px] text-amber-500/70">High-quality dramatic voice. Limited by quota (15 RPM free).</p>
               )}
             </div>
          </div>
        {/* end timeline */}

        {false && <aside>{/* dead code removed */}
          {isBatchEditMode && (
            <div className="p-3 border-b border-slate-800 bg-slate-800/20 text-xs flex flex-col gap-3 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex gap-3 items-center">
                  <button 
                    onClick={handleSelectAll}
                    className="text-amber-500 hover:text-amber-400 capitalize underline"
                  >
                    Select All
                  </button>
                  <span className="text-slate-500">|</span>
                  <button 
                    onClick={handleDeselectAll}
                    className="text-slate-400 hover:text-slate-300 capitalize underline"
                  >
                    None
                  </button>
                </div>
                <span className="text-slate-400">{selectedSubtitles.size} selected</span>
              </div>
              <div className="flex flex-col gap-2">
                <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Find & Replace</div>
                <input 
                  type="text" 
                  placeholder="Find text..." 
                  value={batchFindText}
                  onChange={(e) => setBatchFindText(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 outline-none text-slate-200"
                />
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Replace with..." 
                    value={batchReplaceText}
                    onChange={(e) => setBatchReplaceText(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 outline-none text-slate-200"
                  />
                  <button 
                    onClick={handleBatchReplace}
                    className="bg-amber-500 hover:bg-amber-400 text-slate-900 px-3 rounded font-bold whitespace-nowrap transition-colors"
                  >
                    Replace
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                 <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Adjust Timing</div>
                 <div className="flex gap-2 items-center">
                   <input 
                     type="number"
                     step="0.1"
                     value={batchTimeShift}
                     onChange={(e) => setBatchTimeShift(e.target.value)}
                     className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 outline-none text-slate-200"
                     placeholder="Shift seconds (e.g. 1.5, -2)"
                   />
                   <button 
                     onClick={handleBatchTimeShift}
                     className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded font-bold whitespace-nowrap transition-colors"
                   >
                     Shift Time
                   </button>
                 </div>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 m-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-[11px] font-medium animate-in fade-in slide-in-from-top-2 duration-300 relative group pr-10 shadow-lg shadow-red-950/20">
              <div className="flex items-start gap-3.5">
                <div className="mt-0.5 shrink-0 p-1.5 bg-red-500/10 rounded-lg border border-red-500/20">
                  <X className="w-3 h-3 text-red-400/80" />
                </div>
                <div className="flex flex-col gap-1.5 flex-1 pr-2">
                  <span className="font-bold flex items-center gap-2 text-red-300">
                    <span className="w-1 h-1 rounded-full bg-red-500" />
                    TTS Generation Issue
                  </span>
                  <span className="opacity-80 leading-relaxed break-words">{errorMsg}</span>
                  <div className="mt-1 flex items-center gap-3">
                    <button 
                      onClick={() => setErrorMsg('')}
                      className="text-[10px] font-bold text-red-400/60 hover:text-red-400 underline underline-offset-2 transition-colors uppercase tracking-wider"
                    >
                      Dismiss
                    </button>
                    {(errorMsg.includes('API Key') || errorMsg.includes('Settings')) && (
                      <span className="text-[9px] text-slate-500 italic">Hint: Go to Settings tab above</span>
                    )}
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setErrorMsg('')}
                className="absolute top-3 right-3 p-1 rounded-md bg-transparent opacity-40 group-hover:opacity-100 transition-all hover:bg-red-500/20"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <VirtualSubtitleList
            subtitles={subtitles}
            scrollToActiveId={activeSub?.id}
            renderItem={(sub) => (
              <SubtitleListItem
                key={sub.id}
                sub={sub}
                isActive={activeSub?.id === sub.id}
                isBatchEditMode={isBatchEditMode}
                selectedSubtitles={selectedSubtitles}
                previewingId={previewingId}
                isGeneratingAll={isGeneratingAll}
                ttsEngine={ttsEngine}
                defaultVoxCPMVoice={defaultVoxCPMVoice}
                referenceAudioFile={referenceAudioFile}
                referenceAudioBase64={referenceAudioBase64}
                handleToggleLink={handleToggleLink}
                toggleSubtitleSelection={toggleSubtitleSelection}
                handlePreviewAudio={handlePreviewAudio}
                handleGenerateSingle={handleGenerateSingle}
                handleEngineChange={handleEngineChange}
                handleVoiceChange={handleVoiceChange}
                handleSubReferenceAudioUpload={handleSubReferenceAudioUpload}
                playAudioFile={playAudioFile}
                updateSubtitles={updateSubtitles}
                videoRef={videoRef}
              />
            )}
          />
        </aside>}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md p-6 shadow-2xl">
            <h2 className="text-xl font-semibold text-white mb-6">API Configuration</h2>
            
            <div className="space-y-4 mb-6 max-h-[65vh] overflow-y-auto pr-2 custom-scrollbar">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5 flex justify-between">
                  <span>VoxCPM Server URL & Voice</span>
                  <a href="https://support.google.com/chrome/answer/99020" target="_blank" rel="noreferrer" className="text-[10px] text-purple-400 hover:text-purple-300 underline">Mixed Content Fix</a>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={voxcpmUrl}
                    onChange={(e) => setVoxcpmUrl(e.target.value)}
                    placeholder="https://your-ngrok/v1/audio/speech"
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all font-mono"
                  />
                  <select
                    value={defaultVoxCPMVoice}
                    onChange={(e) => setDefaultVoxCPMVoice(e.target.value)}
                    className="w-32 bg-slate-950 border border-slate-800 rounded-md px-2 py-2 text-sm text-white focus:outline-none focus:border-purple-500 transition-all"
                  >
                    {VOXCPM_VOICES.map((v) => (
                      <option key={v.id} value={v.id}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                  Full VoxCPM Gradio endpoint URL. Needs to be accessible from this app.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5 flex justify-between">
                  <span>Gemini API Key & Default Voice</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    placeholder="AIza..."
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                  />
                  <select 
                    value={defaultGeminiVoice} 
                    onChange={(e) => setDefaultGeminiVoice(e.target.value as any)}
                    className="w-32 bg-slate-950 border border-slate-800 rounded-md px-2 py-2 text-sm text-white focus:outline-none focus:border-amber-500 transition-all"
                  >
                    {TTS_VOICES.map((v) => <option key={v.id} value={v.id}>{v.id}</option>)}
                  </select>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800">
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 bg-transparent hover:bg-slate-800 text-slate-300 rounded-md text-sm font-medium transition-colors"
               >
                Cancel
              </button>
              <button
                onClick={saveSettings}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-md text-sm font-bold shadow-lg shadow-amber-500/20 transition-all"
               >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #334155;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: #475569;
        }
      `}</style>
    </div>
    </ErrorBoundary>
  );
}

// Debug Overlay for timing
const DebugOverlay = ({ 
  selectedClipId, 
  audioClips, 
  activeSub,
  timelineCurrentTime, 
  zoomLevel, 
  videoRef,
  videoDuration,
  srtDuration,
  fitSrtToVideo,
  setSelectedClipId 
}: { 
  selectedClipId: { id: number; type: 'subtitle' | 'audio' } | null;
  audioClips: any[];
  activeSub: Subtitle | undefined;
  timelineCurrentTime: number;
  zoomLevel: number;
  videoRef: React.RefObject<HTMLVideoElement>;
  videoDuration: number;
  srtDuration: number;
  fitSrtToVideo: () => void;
  setSelectedClipId: (id: any) => void;
}) => {
  const clip = selectedClipId?.type === 'audio' ? audioClips.find(c => c.id === selectedClipId.id) : null;
  const videoTime = videoRef.current?.currentTime ?? 0;
  const showWarning = srtDuration > (videoDuration + 0.5) && videoDuration > 0;
  
  return (
    <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-[1000] items-end">
      {showWarning && (
        <div className="bg-amber-950/90 border border-amber-500 p-4 rounded-lg shadow-2xl backdrop-blur-md max-w-sm animate-in fade-in slide-in-from-right-4">
          <div className="flex items-start gap-3">
             <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
             <div>
                <p className="text-amber-200 font-bold text-xs uppercase tracking-wider mb-1">Duration Mismatch</p>
                <p className="text-amber-500/90 text-[10px] leading-relaxed mb-3">
                  The SRT duration ({srtDuration.toFixed(2)}s) is longer than the video ({videoDuration.toFixed(2)}s). 
                  This can cause sync issues.
                </p>
                <button 
                  onClick={fitSrtToVideo}
                  className="w-full py-1.5 bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold text-[10px] rounded uppercase tracking-widest transition-all"
                >
                  Fit SRT to Video
                </button>
             </div>
          </div>
        </div>
      )}

    </div>
  );
};