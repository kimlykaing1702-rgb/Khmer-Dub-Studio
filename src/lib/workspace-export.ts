// Export/import workspace as ZIP file
import JSZip from 'jszip';
import * as db from './indexeddb';
import { WorkspaceData } from './workspace-types';

const ZIP_VERSION = 1;
const MANIFEST_FILE = 'manifest.json';

interface ZipManifest {
  version: number;
  exportedAt: number;
  name: string;
  id: string;
}

// Export workspace as ZIP file
export async function exportWorkspace(workspace: WorkspaceData): Promise<Blob> {
  const zip = new JSZip();

  // Create manifest
  const manifest: ZipManifest = {
    version: ZIP_VERSION,
    exportedAt: Date.now(),
    name: workspace.metadata.name,
    id: workspace.metadata.id,
  };

  zip.file(MANIFEST_FILE, JSON.stringify(manifest, null, 2));

  // Add metadata and serializable data
  zip.file(
    'workspace.json',
    JSON.stringify(
      {
        metadata: workspace.metadata,
        subtitles: workspace.subtitles.map((sub) => ({
          ...sub,
          audioBlob: undefined,
          audioUrl: undefined,
        })),
        speakers: workspace.speakers.map((speaker) => ({
          ...speaker,
          refAudioFile: null,
        })),
        uiState: workspace.uiState,
        ttsSettings: workspace.ttsSettings,
      },
      null,
      2
    )
  );

  // Add video blob if present
  if (workspace.videoBlob) {
    zip.file('video/video', workspace.videoBlob);
  }

  // Add audio clips
  if (workspace.generatedAudio.size > 0) {
    const audioFolder = zip.folder('audio');
    if (audioFolder) {
      for (const [subtitleId, audioData] of workspace.generatedAudio.entries()) {
        audioFolder.file(`${subtitleId}.wav`, audioData.blob);
      }
    }
  }

  // Generate ZIP
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

// Import workspace from ZIP file
export async function importWorkspace(
  zipFile: File
): Promise<{ workspaceId: string; workspace: WorkspaceData }> {
  try {
    const zip = new JSZip();
    const loadedZip = await zip.loadAsync(zipFile);

    // Check manifest
    const manifestFile = loadedZip.file(MANIFEST_FILE);
    if (!manifestFile) {
      throw new Error('Invalid workspace file: missing manifest');
    }

    const manifestText = await manifestFile.async('text');
    const manifest: ZipManifest = JSON.parse(manifestText);

    if (manifest.version !== ZIP_VERSION) {
      throw new Error(
        `Incompatible workspace version: ${manifest.version}, expected ${ZIP_VERSION}`
      );
    }

    // Load workspace data
    const wsFile = loadedZip.file('workspace.json');
    if (!wsFile) {
      throw new Error('Invalid workspace file: missing workspace.json');
    }

    const wsText = await wsFile.async('text');
    const wsData = JSON.parse(wsText);

    // Load video if present
    let videoBlob: Blob | undefined;
    const videoFile = loadedZip.file('video/video');
    if (videoFile) {
      videoBlob = await videoFile.async('blob');
    }

    // Load audio clips
    const generatedAudio = new Map();
    const audioFolder = loadedZip.folder('audio');
    if (audioFolder) {
      for (const [relativePath, file] of Object.entries(audioFolder.files)) {
        const fileTyped = file as any;
        if (!fileTyped.dir) {
          const fileName = fileTyped.name.split('/').pop();
          if (fileName && fileName.endsWith('.wav')) {
            const subtitleId = parseInt(fileName.replace('.wav', ''));
            if (!isNaN(subtitleId)) {
              const blob = await fileTyped.async('blob');
              generatedAudio.set(subtitleId, {
                blob,
                duration: 0, // Will be recalculated when loaded
                waveformPeaks: [],
              });
            }
          }
        }
      }
    }

    // Generate new ID for imported workspace
    const newId = generateWorkspaceId();

    const workspace: WorkspaceData = {
      metadata: {
        ...wsData.metadata,
        id: newId,
        createdAt: Date.now(),
        lastModified: Date.now(),
      },
      subtitles: wsData.subtitles || [],
      speakers: wsData.speakers || [],
      generatedAudio,
      uiState: wsData.uiState || getDefaultUIState(),
      ttsSettings: wsData.ttsSettings || getDefaultTTSSettings(),
      videoBlob,
    };

    // Save to IndexedDB
    await db.putJSON(db.STORES.WORKSPACES, newId, {
      metadata: workspace.metadata,
      subtitles: workspace.subtitles,
      speakers: workspace.speakers,
      audioMetadata: serializeAudioMetadata(workspace.generatedAudio),
      uiState: workspace.uiState,
      ttsSettings: workspace.ttsSettings,
    });

    // Save video blob
    if (workspace.videoBlob) {
      await db.putBlob(db.STORES.VIDEOS, newId, workspace.videoBlob, {
        workspaceId: newId,
        fileName: workspace.metadata.videoFileName,
        fileSize: workspace.metadata.videoFileSize,
      });
    }

    // Save audio clips
    for (const [subtitleId, audioData] of workspace.generatedAudio.entries()) {
      const audioRecordId = `${newId}-${subtitleId}`;
      await db.putBlob(db.STORES.AUDIO_CLIPS, audioRecordId, audioData.blob, {
        workspaceId: newId,
        subtitleId,
      });
    }

    return { workspaceId: newId, workspace };
  } catch (error) {
    console.error('Failed to import workspace:', error);
    throw error;
  }
}

// Helper functions
function generateWorkspaceId(): string {
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
  return `ws-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function serializeAudioMetadata(audioMap: Map<number, any>): Record<number, any> {
  const result: Record<number, any> = {};
  for (const [key, value] of audioMap.entries()) {
    result[key] = {
      duration: value.duration,
      waveformPeaks: value.waveformPeaks || [],
    };
  }
  return result;
}

function getDefaultUIState() {
  return {
    timelineCurrentTime: 0,
    timelineHeight: 150,
    leftPanelWidth: 320,
    videoPanelWidth: 288,
    zoomLevel: 60,
    selectedClipId: null,
    viewMode: 'content' as const,
    followPlayhead: true,
    leftPanelTab: 'files' as const,
  };
}

function getDefaultTTSSettings() {
  return {
    ttsEngine: 'voxcpm' as const,
    defaultGeminiVoice: 'Puck',
    defaultVoxCPMVoice: 'khmer-male-1',
    voxcpmUrl: 'http://127.0.0.1:8808',
  };
}

// Download helper
export async function downloadWorkspaceAsZip(
  workspace: WorkspaceData
): Promise<void> {
  try {
    const blob = await exportWorkspace(workspace);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${workspace.metadata.name.replace(/[^a-z0-9]/gi, '-')}.dub`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Failed to download workspace:', error);
    throw error;
  }
}

// Upload helper
export async function uploadWorkspaceFromZip(
  file: File
): Promise<{ workspaceId: string; workspace: WorkspaceData }> {
  return importWorkspace(file);
}
