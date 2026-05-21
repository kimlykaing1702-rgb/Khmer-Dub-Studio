// Type definitions for workspace persistence system

export interface WorkspaceMetadata {
  id: string;
  name: string;
  createdAt: number;
  lastModified: number;
  videoFileName: string;
  videoFileSize: number;
  version: number;
}

export interface AudioClipData {
  blob: Blob;
  duration: number;
  waveformPeaks?: number[];
}

export interface UIState {
  timelineCurrentTime: number;
  timelineHeight: number;
  leftPanelWidth: number;
  videoPanelWidth: number;
  zoomLevel: number;
  selectedClipId: { id: number; type: 'subtitle' | 'audio' } | null;
  viewMode: 'content' | 'video';
  followPlayhead: boolean;
  leftPanelTab: 'files' | 'speakers';
}

export interface TTSSettings {
  ttsEngine: 'gemini' | 'google-free' | 'voxcpm';
  defaultGeminiVoice: string;
  defaultVoxCPMVoice: string;
  voxcpmUrl: string;
  geminiKey?: string;
}

export interface Subtitle {
  id: number;
  startTime: number;
  endTime: number;
  text: string;
  cleanText: string;
  speakerId: string;
  audioUrl?: string;
  audioBlob?: Blob;
  audioDuration?: number;
  audioTrimStart?: number;
  audioTrimEnd?: number;
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

export interface Speaker {
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

export interface WorkspaceData {
  metadata: WorkspaceMetadata;
  subtitles: Subtitle[];
  speakers: Speaker[];
  generatedAudio: Map<number, AudioClipData>;
  uiState: UIState;
  ttsSettings: TTSSettings;
  videoBlob?: Blob;
}

// Serializable version of WorkspaceData for JSON storage
export interface WorkspaceDataSerialized {
  metadata: WorkspaceMetadata;
  subtitles: Subtitle[];
  speakers: Speaker[];
  audioMetadata: Record<number, { duration: number; waveformPeaks?: number[] }>;
  uiState: UIState;
  ttsSettings: TTSSettings;
}

// For IndexedDB video blob storage
export interface VideoData {
  workspaceId: string;
  blob: Blob;
  fileName: string;
  fileSize: number;
  uploadedAt: number;
}

// For IndexedDB audio blob storage
export interface AudioData {
  workspaceId: string;
  subtitleId: number;
  blob: Blob;
  duration: number;
  storedAt: number;
}
