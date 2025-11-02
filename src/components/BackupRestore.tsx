'use client';

import { useState, useEffect } from 'react';

interface Backup {
  id: string;
  name: string;
  date: string;
  size: string;
  type: 'manual' | 'auto';
}

const BackupRestore = () => {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBackups();
  }, []);

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
        alert('Backup created successfully!');
      } else {
        setError(data.error || 'Failed to create backup');
        alert(`Failed to create backup: ${data.error}`);
      }
    } catch (error) {
      setError('Failed to create backup');
      alert('Failed to create backup: Network error');
      console.error('Error creating backup:', error);
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const restoreBackup = async (backupId: string) => {
    const backup = backups.find(b => b.id === backupId);
    if (!backup) return;
    
    const confirmed = confirm(
      `Are you sure you want to restore "${backup.name}"?\n\n` +
      `This will:\n` +
      `• Stop the Icarus server if running\n` +
      `• Backup your current saves\n` +
      `• Replace all save data with the backup\n\n` +
      `This action cannot be undone!`
    );
    
    if (!confirmed) return;
    
    try {
      setError(null);
      const response = await fetch('/api/backups/restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ backupId }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert('Backup restored successfully! You may need to restart the server.');
      } else {
        if (data.recovered) {
          alert(`Restore failed but your original saves have been recovered.\n\nError: ${data.error}`);
        } else {
          alert(`Failed to restore backup: ${data.error}`);
        }
        setError(data.error);
      }
    } catch (error) {
      setError('Failed to restore backup');
      alert('Failed to restore backup: Network error');
      console.error('Error restoring backup:', error);
    }
  };

  const deleteBackup = async (backupId: string) => {
    const backup = backups.find(b => b.id === backupId);
    if (!backup) return;
    
    if (!confirm(`Are you sure you want to delete "${backup.name}"? This action cannot be undone.`)) {
      return;
    }
    
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
        alert('Backup deleted successfully');
      } else {
        setError(data.error || 'Failed to delete backup');
        alert(`Failed to delete backup: ${data.error}`);
      }
    } catch (error) {
      setError('Failed to delete backup');
      alert('Failed to delete backup: Network error');
      console.error('Error deleting backup:', error);
    }
  };

  return (
    <div className="space-y-6">
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
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Max Backups
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Maximum number of backups to keep
              </p>
            </div>
            <select className="bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 text-sm rounded-lg px-3 py-1">
              <option>5</option>
              <option>10</option>
              <option>15</option>
              <option>20</option>
            </select>
          </div>
        </div>
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
              <div key={backup.id} className="px-6 py-4 flex items-center justify-between">
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
                    onClick={() => restoreBackup(backup.id)}
                    className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
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
              The system automatically creates temporary backups before restoring to prevent data loss. 
              <strong>Important:</strong> Stop the server before restoring backups for best results.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BackupRestore;