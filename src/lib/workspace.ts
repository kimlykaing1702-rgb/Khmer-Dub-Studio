// Core workspace persistence logic
import * as db from './indexeddb';
import {
  WorkspaceData,
  WorkspaceDataSerialized,
  WorkspaceMetadata,
  AudioClipData,
  UIState,
  TTSSettings,
  Subtitle,
  Speaker,
} from './workspace-types';

// Helper: Generate unique ID
function generateId(): string {
  // Fallback UUID generation if crypto.randomUUID not available
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buffer = new Uint8Array(16);
    crypto.getRandomValues(buffer);
    buffer[6] = (buffer[6] & 0x0f) | 0x40;
    buffer[8] = (buffer[8] & 0x3f) | 0x80;
    return Array.from(buffer)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
  }
  // Fallback to simple timestamp-based ID
  return `ws-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Serialize AudioClipData for JSON storage (Blobs can't be stringified)
function serializeAudioMetadata(audioMap: Map<number, AudioClipData>): Record<number, any> {
  const result: Record<number, any> = {};
  for (const [key, value] of audioMap.entries()) {
    result[key] = {
      duration: value.duration,
      waveformPeaks: value.waveformPeaks || [],
    };
  }
  return result;
}

// Check if localStorage has old data to migrate
function hasLegacyData(): boolean {
  return !!(
    typeof localStorage !== 'undefined' &&
    localStorage.getItem('autosave_subtitles')
  );
}

// Parse legacy JSON with potential Blob references
function parseLegacySubtitles(jsonString: string): Subtitle[] {
  try {
    const data = JSON.parse(jsonString);
    return Array.isArray(data)
      ? data.map((sub: any) => ({
          ...sub,
          audioBlob: undefined, // Blobs can't be stored in localStorage
          audioUrl: undefined, // URLs are browser-specific
        }))
      : [];
  } catch (error) {
    console.error('Failed to parse legacy subtitles:', error);
    return [];
  }
}

function parseLegacySpeakers(jsonString: string): Speaker[] {
  try {
    const data = JSON.parse(jsonString);
    return Array.isArray(data)
      ? data.map((speaker: any) => ({
          ...speaker,
          refAudioFile: null, // Files can't be stored in localStorage
        }))
      : [];
  } catch (error) {
    console.error('Failed to parse legacy speakers:', error);
    return [];
  }
}

// Get legacy TTS settings
function getLegacyTTSSettings(): Partial<TTSSettings> {
  if (typeof localStorage === 'undefined') return {};

  return {
    ttsEngine: (localStorage.getItem('tts_engine') as any) || 'voxcpm',
    defaultGeminiVoice: localStorage.getItem('default_gemini_voice') || 'Puck',
    defaultVoxCPMVoice:
      localStorage.getItem('default_voxcpm_voice') || 'khmer-male-1',
    voxcpmUrl: localStorage.getItem('voxcpm_url') || 'http://127.0.0.1:8808',
    geminiKey: localStorage.getItem('gemini_api_key') || undefined,
  };
}

// Get legacy UI state
function getLegacyUIState(): Partial<UIState> {
  if (typeof localStorage === 'undefined') return {};

  return {
    timelineHeight: parseInt(localStorage.getItem('timeline_height') || '150'),
    leftPanelWidth: parseInt(localStorage.getItem('left_panel_width') || '320'),
    videoPanelWidth: parseInt(
      localStorage.getItem('video_panel_width') || '288'
    ),
    timelineCurrentTime: 0,
    zoomLevel: 60,
    selectedClipId: null,
    viewMode: 'content',
    followPlayhead: true,
    leftPanelTab: 'files',
  };
}

// Migrate legacy localStorage data to first workspace
export async function migrateFromLocalStorage(): Promise<string | null> {
  if (!hasLegacyData()) {
    return null;
  }

  try {
    const migrationMarked = localStorage.getItem('workspace_migration_done');
    if (migrationMarked) {
      return null; // Already migrated
    }

    console.log('Starting legacy data migration...');

    const subtitles = parseLegacySubtitles(
      localStorage.getItem('autosave_subtitles') || '[]'
    );
    const speakers = parseLegacySpeakers(
      localStorage.getItem('autosave_speakers') || '[]'
    );

    // Create default workspace
    const workspaceId = generateId();
    const metadata: WorkspaceMetadata = {
      id: workspaceId,
      name: 'Default Project',
      createdAt: Date.now(),
      lastModified: Date.now(),
      videoFileName: '',
      videoFileSize: 0,
      version: 1,
    };

    const defaultUIState: UIState = {
      timelineCurrentTime: 0,
      timelineHeight: 150,
      leftPanelWidth: 320,
      videoPanelWidth: 288,
      zoomLevel: 60,
      selectedClipId: null,
      viewMode: 'content',
      followPlayhead: true,
      leftPanelTab: 'files',
      ...getLegacyUIState(),
    };

    const defaultTTSSettings: TTSSettings = {
      ttsEngine: 'voxcpm',
      defaultGeminiVoice: 'Puck',
      defaultVoxCPMVoice: 'khmer-male-1',
      voxcpmUrl: 'http://127.0.0.1:8808',
      ...getLegacyTTSSettings(),
    };

    // Save workspace metadata
    await db.putJSON(db.STORES.WORKSPACES, workspaceId, {
      metadata,
      subtitles,
      speakers,
      audioMetadata: {},
      uiState: defaultUIState,
      ttsSettings: defaultTTSSettings,
    } as WorkspaceDataSerialized);

    // Mark migration as complete
    localStorage.setItem('workspace_migration_done', 'true');
    localStorage.setItem('active_workspace_id', workspaceId);

    console.log('Legacy data migrated successfully to workspace:', workspaceId);
    return workspaceId;
  } catch (error) {
    console.error('Failed to migrate legacy data:', error);
    return null;
  }
}

// Create new workspace
export async function createWorkspace(name: string): Promise<string> {
  const workspaceId = generateId();
  const metadata: WorkspaceMetadata = {
    id: workspaceId,
    name,
    createdAt: Date.now(),
    lastModified: Date.now(),
    videoFileName: '',
    videoFileSize: 0,
    version: 1,
  };

  const workspaceData: WorkspaceDataSerialized = {
    metadata,
    subtitles: [],
    speakers: [],
    audioMetadata: {},
    uiState: {
      timelineCurrentTime: 0,
      timelineHeight: 150,
      leftPanelWidth: 320,
      videoPanelWidth: 288,
      zoomLevel: 60,
      selectedClipId: null,
      viewMode: 'content',
      followPlayhead: true,
      leftPanelTab: 'files',
    },
    ttsSettings: {
      ttsEngine: 'voxcpm',
      defaultGeminiVoice: 'Puck',
      defaultVoxCPMVoice: 'khmer-male-1',
      voxcpmUrl: 'http://127.0.0.1:8808',
    },
  };

  await db.putJSON(db.STORES.WORKSPACES, workspaceId, workspaceData);
  return workspaceId;
}

// Save workspace
export async function saveWorkspace(workspace: WorkspaceData): Promise<void> {
  const metadata: WorkspaceMetadata = {
    ...workspace.metadata,
    lastModified: Date.now(),
  };

  // Serialize audio metadata (blobs stored separately)
  const audioMetadata = serializeAudioMetadata(workspace.generatedAudio);

  // Save metadata and serializable data
  const workspaceData: WorkspaceDataSerialized = {
    metadata,
    subtitles: workspace.subtitles.map((sub) => ({
      ...sub,
      audioBlob: undefined, // Remove blob, store separately
      audioUrl: undefined, // Remove object URLs
    })),
    speakers: workspace.speakers.map((speaker) => ({
      ...speaker,
      refAudioFile: null, // Remove file objects
    })),
    audioMetadata,
    uiState: workspace.uiState,
    ttsSettings: workspace.ttsSettings,
  };

  await db.putJSON(db.STORES.WORKSPACES, workspace.metadata.id, workspaceData);

  // Save video blob if present
  if (workspace.videoBlob) {
    await db.putBlob(
      db.STORES.VIDEOS,
      workspace.metadata.id,
      workspace.videoBlob,
      {
        workspaceId: workspace.metadata.id,
        fileName: metadata.videoFileName,
        fileSize: metadata.videoFileSize,
      }
    );
  }

  // Save audio clips as blobs
  for (const [subtitleId, audioData] of workspace.generatedAudio.entries()) {
    const audioRecordId = `${workspace.metadata.id}-${subtitleId}`;
    await db.putBlob(
      db.STORES.AUDIO_CLIPS,
      audioRecordId,
      audioData.blob,
      {
        workspaceId: workspace.metadata.id,
        subtitleId,
      }
    );
  }

  // Update active workspace in sessionStorage
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem('active_workspace_id', workspace.metadata.id);
  }
}

// Load workspace
export async function loadWorkspace(id: string): Promise<WorkspaceData | null> {
  try {
    const record = await db.getJSON(db.STORES.WORKSPACES, id);
    if (!record) return null;

    const serialized: WorkspaceDataSerialized = record;

    // Load video blob
    let videoBlob: Blob | undefined;
    try {
      videoBlob = await db.getBlob(db.STORES.VIDEOS, id);
    } catch {
      // Video may not exist
    }

    // Load audio clips
    const generatedAudio = new Map<number, AudioClipData>();
    try {
      const allAudioRecords = await db.getAllRecords(db.STORES.AUDIO_CLIPS);
      for (const record of allAudioRecords) {
        if (record.workspaceId === id && record.blob) {
          const subtitleId = record.subtitleId;
          const audioMetadata: any = serialized.audioMetadata[subtitleId] || {};
          generatedAudio.set(subtitleId, {
            blob: record.blob,
            duration: audioMetadata.duration || 0,
            waveformPeaks: audioMetadata.waveformPeaks || [],
          });
        }
      }
    } catch {
      // Audio clips may not exist
    }

    const workspace: WorkspaceData = {
      metadata: serialized.metadata,
      subtitles: serialized.subtitles,
      speakers: serialized.speakers,
      generatedAudio,
      uiState: serialized.uiState,
      ttsSettings: serialized.ttsSettings,
      videoBlob,
    };

    return workspace;
  } catch (error) {
    console.error('Failed to load workspace:', error);
    return null;
  }
}

// List all workspaces
export async function listWorkspaces(): Promise<WorkspaceMetadata[]> {
  try {
    const records = await db.getAllRecords(db.STORES.WORKSPACES);
    return records
      .map((r) => r.data?.metadata)
      .filter((m): m is WorkspaceMetadata => !!m)
      .sort((a, b) => b.lastModified - a.lastModified);
  } catch (error) {
    console.error('Failed to list workspaces:', error);
    return [];
  }
}

// Delete workspace
export async function deleteWorkspace(id: string): Promise<void> {
  try {
    // Delete metadata
    await db.deleteRecord(db.STORES.WORKSPACES, id);

    // Delete video blob
    await db.deleteRecord(db.STORES.VIDEOS, id);

    // Delete audio clips
    const allAudioRecords = await db.getAllRecords(db.STORES.AUDIO_CLIPS);
    for (const record of allAudioRecords) {
      if (record.workspaceId === id) {
        await db.deleteRecord(
          db.STORES.AUDIO_CLIPS,
          `${record.workspaceId}-${record.subtitleId}`
        );
      }
    }

    // Remove from session storage if active
    if (typeof sessionStorage !== 'undefined') {
      const activeId = sessionStorage.getItem('active_workspace_id');
      if (activeId === id) {
        sessionStorage.removeItem('active_workspace_id');
      }
    }
  } catch (error) {
    console.error('Failed to delete workspace:', error);
    throw error;
  }
}

// Get or create active workspace
export async function getOrCreateActiveWorkspace(): Promise<string> {
  try {
    // Check if there's an active workspace in session
    if (typeof sessionStorage !== 'undefined') {
      const activeId = sessionStorage.getItem('active_workspace_id');
      if (activeId) {
        const workspace = await loadWorkspace(activeId);
        if (workspace) return activeId;
      }
    }

    // Try to migrate from localStorage
    const migratedId = await migrateFromLocalStorage();
    if (migratedId) return migratedId;

    // Check if there are existing workspaces
    const workspaces = await listWorkspaces();
    if (workspaces.length > 0) {
      const id = workspaces[0].id;
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('active_workspace_id', id);
      }
      return id;
    }

    // Create default workspace
    const newId = await createWorkspace('My Project');
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('active_workspace_id', newId);
    }
    return newId;
  } catch (error) {
    console.error('Failed to get or create active workspace:', error);
    // Fallback: create a workspace
    return createWorkspace('My Project');
  }
}
