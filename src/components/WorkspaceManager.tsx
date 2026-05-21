import React, { useEffect, useState } from 'react';
import {
  Plus,
  FolderOpen,
  Download,
  Upload,
  Trash2,
  ChevronDown,
  AlertTriangle,
  Save,
} from 'lucide-react';
import * as workspaceLib from '../lib/workspace';
import * as workspaceExport from '../lib/workspace-export';
import { WorkspaceMetadata, WorkspaceData } from '../lib/workspace-types';
import { motion } from 'motion/react';

interface WorkspaceManagerProps {
  currentWorkspaceId: string;
  onWorkspaceChange: (workspaceId: string) => void;
  currentWorkspace: WorkspaceData | null;
  isDirty: boolean;
}

export const WorkspaceManager: React.FC<WorkspaceManagerProps> = ({
  currentWorkspaceId,
  onWorkspaceChange,
  currentWorkspace,
  isDirty,
}) => {
  const [workspaces, setWorkspaces] = useState<WorkspaceMetadata[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [currentName, setCurrentName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load workspaces on mount
  useEffect(() => {
    loadWorkspaces();
  }, []);

  // Update current name when workspace changes
  useEffect(() => {
    const workspace = workspaces.find((w) => w.id === currentWorkspaceId);
    if (workspace) {
      setCurrentName(workspace.name);
    }
  }, [currentWorkspaceId, workspaces]);

  const loadWorkspaces = async () => {
    try {
      const list = await workspaceLib.listWorkspaces();
      setWorkspaces(list);
      setError(null);
    } catch (err) {
      console.error('Failed to load workspaces:', err);
      setError('Failed to load workspaces');
    }
  };

  const handleNewWorkspace = async () => {
    if (!newWorkspaceName.trim()) return;

    try {
      setIsLoading(true);
      const newId = await workspaceLib.createWorkspace(newWorkspaceName);
      await loadWorkspaces();
      onWorkspaceChange(newId);
      setNewWorkspaceName('');
      setShowNewDialog(false);
      setError(null);
    } catch (err) {
      console.error('Failed to create workspace:', err);
      setError('Failed to create workspace');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectWorkspace = async (id: string) => {
    if (isDirty && currentWorkspace) {
      // Save current workspace before switching
      try {
        await workspaceLib.saveWorkspace(currentWorkspace);
      } catch (err) {
        console.error('Failed to save workspace:', err);
      }
    }
    onWorkspaceChange(id);
    setIsOpen(false);
  };

  const handleDeleteWorkspace = async (id: string) => {
    try {
      setIsLoading(true);
      await workspaceLib.deleteWorkspace(id);
      await loadWorkspaces();

      // If deleted workspace is active, load first remaining or create default
      if (id === currentWorkspaceId) {
        const remaining = workspaces.filter((w) => w.id !== id);
        if (remaining.length > 0) {
          onWorkspaceChange(remaining[0].id);
        } else {
          const newId = await workspaceLib.createWorkspace('My Project');
          onWorkspaceChange(newId);
          await loadWorkspaces();
        }
      }

      setShowDeleteDialog(null);
      setError(null);
    } catch (err) {
      console.error('Failed to delete workspace:', err);
      setError('Failed to delete workspace');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportWorkspace = async () => {
    if (!currentWorkspace) return;

    try {
      setIsLoading(true);
      await workspaceExport.downloadWorkspaceAsZip(currentWorkspace);
      setError(null);
    } catch (err) {
      console.error('Failed to export workspace:', err);
      setError('Failed to export workspace');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportWorkspace = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsLoading(true);
      const { workspaceId } = await workspaceExport.uploadWorkspaceFromZip(file);
      await loadWorkspaces();
      onWorkspaceChange(workspaceId);
      setError(null);
    } catch (err) {
      console.error('Failed to import workspace:', err);
      setError('Failed to import workspace');
    } finally {
      setIsLoading(false);
    }

    // Reset input
    event.target.value = '';
  };

  const handleSaveAsNewWorkspace = async () => {
    if (!newWorkspaceName.trim() || !currentWorkspace) return;

    try {
      setIsLoading(true);

      // Create new workspace with same data
      const newId = await workspaceLib.createWorkspace(newWorkspaceName);
      const newWorkspace = {
        ...currentWorkspace,
        metadata: {
          ...currentWorkspace.metadata,
          id: newId,
          name: newWorkspaceName,
          createdAt: Date.now(),
          lastModified: Date.now(),
        },
      };
      await workspaceLib.saveWorkspace(newWorkspace);
      await loadWorkspaces();
      onWorkspaceChange(newId);
      setNewWorkspaceName('');
      setShowNewDialog(false);
      setError(null);
    } catch (err) {
      console.error('Failed to save workspace as new:', err);
      setError('Failed to save workspace');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="relative">
      {/* Main button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors border border-slate-600 hover:border-slate-500"
        title={currentName}
      >
        <span className="max-w-xs truncate text-sm font-medium">{currentName}</span>
        {isDirty && (
          <span className="w-2 h-2 bg-amber-400 rounded-full" title="Unsaved changes" />
        )}
        <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="absolute top-full left-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50"
        >
          <div className="p-3 border-b border-slate-700 space-y-2">
            {/* New Workspace Button */}
            <button
              onClick={() => {
                setShowNewDialog(true);
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
              disabled={isLoading}
            >
              <Plus size={16} />
              New Workspace
            </button>

            {/* Import/Export Buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleExportWorkspace}
                disabled={isLoading || !currentWorkspace}
                className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                title="Export current workspace as .dub file"
              >
                <Download size={14} />
                Export
              </button>

              <label className="flex-1">
                <input
                  type="file"
                  accept=".dub,.zip"
                  onChange={handleImportWorkspace}
                  disabled={isLoading}
                  className="hidden"
                />
                <span className="flex items-center justify-center gap-1 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed w-full">
                  <Upload size={14} />
                  Import
                </span>
              </label>
            </div>
          </div>

          {/* Workspaces List */}
          <div className="max-h-64 overflow-y-auto">
            {workspaces.length === 0 ? (
              <div className="p-4 text-center text-slate-400 text-sm">
                No workspaces yet
              </div>
            ) : (
              workspaces.map((ws) => (
                <div
                  key={ws.id}
                  className={`flex items-center justify-between px-4 py-3 border-b border-slate-800 hover:bg-slate-800 transition-colors ${
                    ws.id === currentWorkspaceId ? 'bg-slate-800' : ''
                  }`}
                >
                  <button
                    onClick={() => handleSelectWorkspace(ws.id)}
                    disabled={isLoading}
                    className="flex-1 text-left disabled:opacity-50"
                  >
                    <div className="text-sm font-medium text-white truncate">{ws.name}</div>
                    <div className="text-xs text-slate-400">
                      {formatDate(ws.lastModified)}
                    </div>
                  </button>

                  <button
                    onClick={() => setShowDeleteDialog(ws.id)}
                    disabled={isLoading}
                    className="p-2 hover:bg-red-900/20 text-red-400 rounded transition-colors disabled:opacity-50"
                    title="Delete workspace"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Error message */}
          {error && (
            <div className="px-4 py-2 bg-red-900/20 border-t border-slate-700 text-red-300 text-xs flex items-start gap-2">
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </motion.div>
      )}

      {/* New Workspace Dialog */}
      {showNewDialog && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowNewDialog(false)}
        >
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl p-6 w-96"
          >
            <h3 className="text-lg font-bold text-white mb-4">Create New Workspace</h3>
            <input
              type="text"
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleNewWorkspace()}
              placeholder="Workspace name..."
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 mb-4"
              autoFocus
              disabled={isLoading}
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowNewDialog(false);
                  setNewWorkspaceName('');
                }}
                disabled={isLoading}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleNewWorkspace}
                disabled={isLoading || !newWorkspaceName.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowDeleteDialog(null)}
        >
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-red-700/50 rounded-lg shadow-xl p-6 w-96"
          >
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="text-red-400 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <h3 className="text-lg font-bold text-white">Delete Workspace?</h3>
                <p className="text-sm text-slate-300 mt-1">
                  This will permanently delete the workspace and all its data. This cannot be
                  undone.
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteDialog(null)}
                disabled={isLoading}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => showDeleteDialog && handleDeleteWorkspace(showDeleteDialog)}
                disabled={isLoading}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};
