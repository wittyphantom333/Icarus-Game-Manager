'use client';
import { useState, useEffect } from 'react';
import { useModal } from '@/hooks/useModal';
import Modal from './Modal';

interface InstalledMod {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  enabled: boolean;
  filePath: string;
  fileSize: number;
  dateInstalled: string;
}

export default function ModManager() {
  const [installedMods, setInstalledMods] = useState<InstalledMod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadUrl, setUploadUrl] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const modal = useModal();

  useEffect(() => {
    loadInstalledMods();
  }, []);

  const loadInstalledMods = async () => {
    try {
      const response = await fetch('/api/mods');
      if (response.ok) {
        const data = await response.json();
        setInstalledMods(data.mods || []);
      }
    } catch (error) {
      console.error('Failed to load mods:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleMod = async (modId: string, enable: boolean) => {
    try {
      const response = await fetch(`/api/mods/${modId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: enable })
      });

      if (response.ok) {
        loadInstalledMods();
      } else {
        const data = await response.json();
        modal.showError('Toggle Failed', `Failed to ${enable ? 'enable' : 'disable'} mod: ${data.error}`);
      }
    } catch (error) {
      console.error('Failed to toggle mod:', error);
      modal.showError('Toggle Failed', `Failed to ${enable ? 'enable' : 'disable'} mod: Network error`);
    }
  };

  const uninstallMod = (modId: string, modName: string) => {
    modal.showConfirm(
      'Uninstall Mod',
      `Are you sure you want to uninstall "${modName}"? This action cannot be undone.`,
      async () => {
        try {
          const response = await fetch(`/api/mods/${modId}/uninstall`, {
            method: 'DELETE'
          });

          if (response.ok) {
            loadInstalledMods();
            modal.showSuccess('Mod Uninstalled', `${modName} has been successfully uninstalled.`);
          } else {
            const data = await response.json();
            modal.showError('Uninstall Failed', `Failed to uninstall ${modName}: ${data.error}`);
          }
        } catch (error) {
          console.error('Failed to uninstall mod:', error);
          modal.showError('Uninstall Failed', `Failed to uninstall ${modName}: Network error`);
        }
      }
    );
  };

  const downloadPakFile = async (modId: string, modName: string) => {
    try {
      const response = await fetch(`/api/mods/${modId}/download`, {
        method: 'GET'
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `${modName}.pak`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        const data = await response.json();
        modal.showError('Download Failed', `Failed to download ${modName}: ${data.error}`);
      }
    } catch (error) {
      console.error('Failed to download mod:', error);
      modal.showError('Download Failed', 'Network error occurred');
    }
  };

  const handleUploadMod = async () => {
    if (!uploadUrl && !uploadFile) {
      modal.showError('Upload Error', 'Please provide either a URL or select a file to upload.');
      return;
    }

    setUploading(true);
    try {
      if (uploadUrl) {
        // Handle URL upload
        const response = await fetch('/api/mods/download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Custom Mod',
            downloadUrl: uploadUrl,
            author: 'Unknown',
            version: '1.0.0',
            description: 'Mod installed from URL',
            source: 'manual'
          })
        });

        if (response.ok) {
          loadInstalledMods();
          setShowUploadModal(false);
          setUploadUrl('');
          modal.showSuccess('Mod Installed', 'Mod has been successfully installed from URL.');
        } else {
          const data = await response.json();
          modal.showError('Installation Failed', `Failed to install mod: ${data.error}`);
        }
      } else if (uploadFile) {
        // Handle file upload
        const formData = new FormData();
        formData.append('file', uploadFile);

        const response = await fetch('/api/mods/install', {
          method: 'POST',
          body: formData
        });

        if (response.ok) {
          loadInstalledMods();
          setShowUploadModal(false);
          setUploadFile(null);
          modal.showSuccess('Mod Installed', 'Mod has been successfully installed from file.');
        } else {
          const data = await response.json();
          modal.showError('Installation Failed', `Failed to install mod: ${data.error}`);
        }
      }
    } catch (error) {
      console.error('Failed to upload mod:', error);
      modal.showError('Upload Failed', `Failed to upload mod: ${error instanceof Error ? error.message : 'Network error'}`);
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-4 text-gray-600 dark:text-gray-400">Loading mods...</div>;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Mod Manager</h2>
        <button
          onClick={() => setShowUploadModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          Install Mod
        </button>
      </div>

      {/* Manual Installation Info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">Manual Mod Installation</h3>
        <div className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
          <p>To install mods manually:</p>
          <ol className="list-decimal list-inside space-y-1 ml-4">
            <li>Download a .pak or .exmodz file from a trusted source</li>
            <li>Click the &quot;Install Mod&quot; button above</li>
            <li>Either provide a direct download URL or select a local file</li>
            <li>The mod will be installed to your Icarus game directory</li>
          </ol>
          <p className="mt-3 font-medium">Supported file types: .pak, .exmodz</p>
        </div>
      </div>

      {/* Installed Mods */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Installed Mods ({installedMods.length})
        </h3>
        {installedMods.length === 0 ? (
          <div className="bg-gray-50 dark:bg-gray-700 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2M4 13h2m13-8l-4 4m0 0l-4-4m4 4v12" />
            </svg>
            <p className="text-gray-600 dark:text-gray-400">No mods installed yet</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">Use the Install Mod button above to get started</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {installedMods.map((mod) => (
              <div
                key={mod.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 flex-1">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center transition-colors">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate">
                        {mod.name}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                        v{mod.version} {mod.author && `• ${mod.author}`}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={mod.enabled}
                        onChange={(e) => toggleMod(mod.id, e.target.checked)}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                        {mod.enabled ? 'On' : 'Off'}
                      </span>
                    </label>
                    
                    <button
                      onClick={() => downloadPakFile(mod.id, mod.name)}
                      className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-md transition-colors"
                      title="Download .pak file"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </button>
                    
                    <button
                      onClick={() => uninstallMod(mod.id, mod.name)}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                      title="Uninstall mod"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Install Mod</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Download URL (optional)
                </label>
                <input
                  type="url"
                  value={uploadUrl}
                  onChange={(e) => setUploadUrl(e.target.value)}
                  placeholder="https://example.com/mod.pak"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div className="text-center text-gray-500 dark:text-gray-400">OR</div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Upload File
                </label>
                <input
                  type="file"
                  accept=".pak,.exmodz,.zip"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadUrl('');
                  setUploadFile(null);
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUploadMod}
                disabled={uploading || (!uploadUrl && !uploadFile)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-md transition-colors flex items-center gap-2"
              >
                {uploading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
                {uploading ? 'Installing...' : 'Install'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Modal 
        isOpen={modal.isOpen} 
        options={modal.options} 
        onClose={modal.hideModal} 
      />
    </div>
  );
}