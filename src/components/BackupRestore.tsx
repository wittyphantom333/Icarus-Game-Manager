'use client';

import { useState, useEffect } from 'react';
import Modal from './Modal';
import { useModal } from '@/hooks/useModal';

interface Backup {
  id: string;
  name: string;
  date: string;
  size: string;
  type: 'manual' | 'auto';
}

interface BackupSettings {
  autoBackup: boolean;
  maxBackups: number;
}

const BackupRestore = () => {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [serverStatus, setServerStatus] = useState<'running' | 'stopped' | 'unknown'>('unknown');
  const [settings, setSettings] = useState<BackupSettings>({ autoBackup: true, maxBackups: 10 });
  const [settingsLoading, setSettingsLoading] = useState(false);
  
  const modal = useModal();

  useEffect(() => {
    loadBackups();
    checkServerStatus();
    loadSettings();
  }, []);

  const checkServerStatus = async () => {
    try {
      const response = await fetch('/api/server/status');
      const data = await response.json();
      setServerStatus(data.status || 'unknown');
    } catch (error) {
      setServerStatus('unknown');
    }
  };

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/backups/settings');
      const data = await response.json();
      if (data.success) {
        setSettings(data.settings);
      }
    } catch (error) {
      console.error('Error loading backup settings:', error);
    }
  };

  const updateSettings = async (newSettings: BackupSettings) => {
    setSettingsLoading(true);
    try {
      const response = await fetch('/api/backups/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newSettings),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSettings(newSettings);
        // Reload backups to see any cleanup changes
        await loadBackups();
        modal.showSuccess('Settings Updated', 'Backup settings have been updated successfully!');
      } else {
        modal.showError('Settings Update Failed', `Failed to update settings: ${data.error}`);
      }
    } catch (error) {
      modal.showError('Settings Update Failed', 'Failed to update settings: Network error');
      console.error('Error updating settings:', error);
    } finally {
      setSettingsLoading(false);
    }
  };

  const downloadBackup = async (backupId: string, backupName: string) => {
    try {
      const response = await fetch(`/api/backups/download?id=${encodeURIComponent(backupId)}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Download failed');
      }
      
      // Create a blob from the response
      const blob = await response.blob();
      
      // Create a temporary URL for the blob
      const url = window.URL.createObjectURL(blob);
      
      // Create a temporary anchor element and trigger download
      const a = document.createElement('a');
      a.href = url;
      a.download = `icarus-backup-${backupId}.zip`;
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
    } catch (error) {
      modal.showError('Download Failed', `Failed to download backup: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('Error downloading backup:', error);
    }
  };

  const loadBackups = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/backups');
      const data = await response.json();
      
      if (data.success) {
        setBackups(data.backups || []);
      } else {
        setError(data.error || 'Failed to load backups');
      }
    } catch (error) {
      setError('Failed to connect to server');
      console.error('Error loading backups:', error);
    } finally {
      setLoading(false);
    }
  };

  const createBackup = async () => {
    setIsCreatingBackup(true);
    setError(null);
    
    try {
      const response = await fetch('/api/backups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'manual',
          name: `Manual Backup - ${new Date().toLocaleDateString()}`
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Reload backups to get the updated list
        await loadBackups();
        modal.showSuccess('Backup Created', 'Backup has been created successfully!');
      } else {
        setError(data.error || 'Failed to create backup');
        modal.showError('Backup Creation Failed', `Failed to create backup: ${data.error}`);
      }
    } catch (error) {
      setError('Failed to create backup');
      modal.showError('Backup Creation Failed', 'Failed to create backup: Network error');
      console.error('Error creating backup:', error);
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const restoreBackup = async (backupId: string) => {
    const backup = backups.find(b => b.id === backupId);
    if (!backup) return;
    
    const serverWarning = serverStatus === 'running' 
      ? `⚠️ WARNING: The Icarus server is currently running. For best results, stop the server before restoring.\n\n`
      : '';
    
    const confirmMessage = 
      `${serverWarning}This will:\n` +
      `• Create a temporary backup of your current saves\n` +
      `• Replace all save data with the selected backup\n` +
      `• If restore fails, automatically restore your original saves\n\n` +
      `${serverWarning ? 'Consider stopping the server first for best results.' : 'This operation is safe and includes automatic recovery.'}`;
    
    modal.showConfirm(
      `Restore "${backup.name}"?`,
      confirmMessage,
      () => performRestore(backupId),
      undefined,
      'Restore Backup',
      'Cancel'
    );
  };

  const performRestore = async (backupId: string) => {
    const backup = backups.find(b => b.id === backupId);
    if (!backup) return;
    
    try {
      setError(null);
      
      // Show progress feedback
      const originalText = document.querySelector(`[data-backup-id="${backupId}"] .restore-btn`)?.textContent;
      const restoreBtn = document.querySelector(`[data-backup-id="${backupId}"] .restore-btn`) as HTMLButtonElement;
      if (restoreBtn) {
        restoreBtn.disabled = true;
        restoreBtn.textContent = 'Restoring...';
      }
      
      const response = await fetch('/api/backups/restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ backupId }),
      });
      
      const data = await response.json();
      
      if (restoreBtn) {
        restoreBtn.disabled = false;
        restoreBtn.textContent = originalText || 'Restore';
      }
      
      if (data.success) {
        modal.showSuccess(
          'Backup Restored Successfully!',
          `${data.message}\n\nDetails:\n• Restored at: ${new Date(data.details?.restoreTime || Date.now()).toLocaleString()}\n• From: ${backup.name}`
        );
      } else {
        if (data.recovered) {
          modal.showWarning(
            'Restore Failed - Original Saves Recovered',
            `The restore operation failed, but your original saves have been automatically restored.\n\nError: ${data.error}\n\n${data.details?.recoveryTime ? `Recovery completed at: ${new Date(data.details.recoveryTime).toLocaleString()}` : ''}`
          );
        } else {
          const errorMsg = data.details?.manualRecoveryInstructions 
            ? `${data.error}\n\n${data.details.manualRecoveryInstructions}`
            : data.error;
          modal.showError('Restore Failed', errorMsg);
        }
        setError(data.error);
      }
    } catch (error) {
      // Reset button state
      const restoreBtn = document.querySelector(`[data-backup-id="${backupId}"] .restore-btn`) as HTMLButtonElement;
      if (restoreBtn) {
        restoreBtn.disabled = false;
        restoreBtn.textContent = 'Restore';
      }
      
      setError('Failed to restore backup');
      modal.showError('Restore Failed', 'Failed to restore backup: Network error\n\nPlease check your connection and try again.');
      console.error('Error restoring backup:', error);
    }
  };

  const deleteBackup = async (backupId: string) => {
    const backup = backups.find(b => b.id === backupId);
    if (!backup) return;
    
    modal.showConfirm(
      'Delete Backup',
      `Are you sure you want to delete "${backup.name}"? This action cannot be undone.`,
      () => performDelete(backupId),
      undefined,
      'Delete',
      'Cancel'
    );
  };

  const performDelete = async (backupId: string) => {
    try {
      setError(null);
      const response = await fetch('/api/backups/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ backupId }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Remove the backup from the local state
        setBackups(prev => prev.filter(b => b.id !== backupId));
        modal.showSuccess('Backup Deleted', 'Backup has been deleted successfully.');
      } else {
        setError(data.error || 'Failed to delete backup');
        modal.showError('Delete Failed', `Failed to delete backup: ${data.error}`);
      }
    } catch (error) {
      setError('Failed to delete backup');
      modal.showError('Delete Failed', 'Failed to delete backup: Network error');
      console.error('Error deleting backup:', error);
    }
  };

  return (
    <div className="space-y-6">
      <Modal isOpen={modal.isOpen} options={modal.options} onClose={modal.hideModal} />
      
      {/* Header with Create Backup Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Backup & Restore
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage your Icarus game save backups
          </p>
        </div>
        <button
          onClick={createBackup}
          disabled={isCreatingBackup}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          {isCreatingBackup ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              <span>Creating...</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Create Backup</span>
            </>
          )}
        </button>
      </div>

      {/* Backup Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Backup Settings
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Auto Backup
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Automatically create backups before server start
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={settings.autoBackup}
                onChange={(e) => updateSettings({ ...settings, autoBackup: e.target.checked })}
                disabled={settingsLoading}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600 peer-disabled:opacity-50"></div>
            </label>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Max Backups
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Maximum number of backups to keep (older backups will be automatically deleted)
              </p>
            </div>
            <select 
              className="bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 text-sm rounded-lg px-3 py-1 disabled:opacity-50"
              value={settings.maxBackups}
              onChange={(e) => updateSettings({ ...settings, maxBackups: parseInt(e.target.value) })}
              disabled={settingsLoading}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={20}>20</option>
              <option value={25}>25</option>
              <option value={30}>30</option>
            </select>
          </div>
        </div>
        {settingsLoading && (
          <div className="mt-4 flex items-center justify-center">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
            <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Updating settings...</span>
          </div>
        )}
      </div>

      {/* Backup List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Available Backups
          </h3>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {loading ? (
            <div className="px-6 py-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600 dark:text-gray-400">Loading backups...</p>
            </div>
          ) : error ? (
            <div className="px-6 py-8 text-center">
              <p className="text-red-600 dark:text-red-400 mb-2">⚠️ {error}</p>
              <button
                onClick={loadBackups}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Retry
              </button>
            </div>
          ) : backups.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
              No backups available. Create your first backup to get started.
            </div>
          ) : (
            backups.map((backup) => (
              <div key={backup.id} className="px-6 py-4 flex items-center justify-between" data-backup-id={backup.id}>
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${
                      backup.type === 'auto' ? 'bg-green-500' : 'bg-blue-500'
                    }`}></div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {backup.name}
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(backup.date).toLocaleString()} • {backup.size}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => downloadBackup(backup.id, backup.name)}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center space-x-1"
                    title="Download backup file"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span>Download</span>
                  </button>
                  <button
                    onClick={() => restoreBackup(backup.id)}
                    className="restore-btn px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Restore
                  </button>
                  <button
                    onClick={() => deleteBackup(backup.id)}
                    className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Server Status Warning */}
      {serverStatus === 'running' && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <h4 className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Server Running
              </h4>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                The Icarus server is currently running. For best restore results, consider stopping the server first.
                Restores can still be performed safely with automatic recovery if issues occur.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div>
            <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200">
              Backup Information
            </h4>
            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
              Backups include all Icarus save data, world saves, character data, and game configurations. 
              The system automatically creates temporary backups before restoring and includes automatic recovery if restoration fails.
              <strong> Enhanced Safety:</strong> Failed restores automatically restore your original saves.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BackupRestore;