import { useState, useEffect } from 'react';
import Modal from './Modal';
import { useModal } from '@/hooks/useModal';

interface InstalledMod {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  description: string;
  author?: string;
}

interface AvailableMod {
  name: string;
  author: string;
  version: string;
  compatibility: string;
  description: string;
  imageURL: string;
  readmeURL: string;
  files: {
    exmodz?: string;
    download_url?: string;
    png?: string;
  };
  source: 'github';
  installed?: boolean;
}

export default function ModManager() {
  const [installedMods, setInstalledMods] = useState<InstalledMod[]>([]);
  const [availableMods, setAvailableMods] = useState<AvailableMod[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [activeTab, setActiveTab] = useState<'installed' | 'browse'>('installed');
  const [searchTerm, setSearchTerm] = useState('');
  const [downloading, setDownloading] = useState<string[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadUrl, setUploadUrl] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  
  const modal = useModal();

  useEffect(() => {
    loadInstalledMods();
  }, []);

  useEffect(() => {
    if (activeTab === 'browse') {
      loadAvailableMods();
    }
  }, [activeTab]);

  const loadInstalledMods = async () => {
    try {
      const response = await fetch('/api/mods');
      if (response.ok) {
        const data = await response.json();
        setInstalledMods(data.mods || []);
      }
    } catch (error) {
      console.error('Failed to load installed mods:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableMods = async () => {
    setLoadingAvailable(true);
    try {
      const response = await fetch('/api/mods/browse');
      if (response.ok) {
        const data = await response.json();
        setAvailableMods(data.mods || []);
      }
    } catch (error) {
      console.error('Failed to load available mods:', error);
    } finally {
      setLoadingAvailable(false);
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
        modal.showSuccess('Mod Updated', `Mod ${enable ? 'enabled' : 'disabled'} successfully!`);
      } else {
        modal.showError('Update Failed', 'Failed to update mod status');
      }
    } catch (error) {
      modal.showError('Update Failed', 'Network error occurred');
    }
  };

  const uninstallMod = async (modId: string, modName: string) => {
    modal.showConfirm(
      'Confirm Uninstall',
      `Are you sure you want to uninstall "${modName}"?`,
      async () => {
        try {
          const response = await fetch(`/api/mods/${modId}/uninstall`, {
            method: 'DELETE'
          });

          if (response.ok) {
            loadInstalledMods();
            setAvailableMods(availableMods.map(mod => 
              mod.name === modName ? { ...mod, installed: false } : mod
            ));
            modal.showSuccess('Mod Uninstalled', `Successfully uninstalled ${modName}!`);
          } else {
            modal.showError('Uninstall Failed', `Failed to uninstall ${modName}`);
          }
        } catch (error) {
          modal.showError('Uninstall Failed', 'Network error occurred');
        }
      }
    );
  };

  const downloadAndInstallMod = async (mod: AvailableMod) => {
    setDownloading([...downloading, mod.name]);
    
    try {
      const downloadUrl = mod.files.exmodz || mod.files.download_url;
      if (!downloadUrl) {
        throw new Error('No download URL available for this mod');
      }

      const response = await fetch('/api/mods/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: mod.name,
          downloadUrl: downloadUrl,
          author: mod.author,
          version: mod.version,
          description: mod.description,
          source: mod.source
        })
      });

      if (response.ok) {
        loadInstalledMods();
        setAvailableMods(availableMods.map(m => 
          m.name === mod.name ? { ...m, installed: true } : m
        ));
        modal.showSuccess('Mod Installed', `Successfully installed ${mod.name}!`);
      } else {
        const data = await response.json();
        modal.showError('Installation Failed', `Failed to install ${mod.name}: ${data.error}`);
      }
    } catch (error) {
      console.error('Failed to download mod:', error);
      modal.showError('Installation Failed', `Failed to install ${mod.name}: ${error instanceof Error ? error.message : 'Network error'}`);
    } finally {
      setDownloading(downloading.filter(name => name !== mod.name));
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
            version: '1.0',
            description: 'Manually uploaded mod',
            source: 'url'
          })
        });

        if (response.ok) {
          loadInstalledMods();
          modal.showSuccess('Mod Installed', 'Successfully installed mod from URL!');
          setUploadUrl('');
          setShowUploadModal(false);
        } else {
          const data = await response.json();
          modal.showError('Installation Failed', `Failed to install mod: ${data.error}`);
        }
      } else if (uploadFile) {
        // Handle file upload
        const formData = new FormData();
        formData.append('mod', uploadFile);

        const response = await fetch('/api/mods/install', {
          method: 'POST',
          body: formData
        });

        if (response.ok) {
          loadInstalledMods();
          modal.showSuccess('Mod Installed', `Successfully installed ${uploadFile.name}!`);
          setUploadFile(null);
          setShowUploadModal(false);
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

  const filteredAvailableMods = availableMods.filter(mod => {
    const matchesSearch = mod.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      mod.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
      mod.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  if (loading) {
    return <div className="text-center py-4 text-gray-600 dark:text-gray-400">Loading mods...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Mod Manager</h2>
        <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('installed')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'installed'
                ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Installed ({installedMods.length})
          </button>
          <button
            onClick={() => setActiveTab('browse')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'browse'
                ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Browse ({availableMods.length})
          </button>
        </div>
      </div>

      {activeTab === 'installed' ? (
        // Installed Tab
        <div>
          {installedMods.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p className="text-lg mb-2">No mods installed</p>
              <p>Install mods from the Browse tab or upload your own files</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {installedMods.map((mod) => (
                <div
                  key={mod.id}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {mod.name}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Version {mod.version} {mod.author && `by ${mod.author}`}
                      </p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={mod.enabled}
                          onChange={(e) => toggleMod(mod.id, e.target.checked)}
                          className="mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {mod.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </label>
                      <button
                        onClick={() => uninstallMod(mod.id, mod.name)}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm transition-colors"
                      >
                        Uninstall
                      </button>
                    </div>
                  </div>
                  {mod.description && (
                    <p className="text-gray-600 dark:text-gray-400 text-sm">{mod.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        // Browse Tab
        <div>
          {/* Upload Button and Search */}
          <div className="mb-6 space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex items-center justify-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Install Local Mod File or URL
              </button>
              
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search mods..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">How to Install Mods:</h4>
              <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                <div><span className="font-semibold">🟢 GitHub Mods:</span> Auto-install with one click</div>
                <div><span className="font-semibold">📁 Local Files:</span> Upload .pak, .zip, or .EXMODZ files</div>
                <div><span className="font-semibold">🔗 URLs:</span> Direct download from any URL</div>
              </div>
            </div>
          </div>

          {loadingAvailable ? (
            <div className="text-center py-8 text-gray-600 dark:text-gray-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              Loading available mods...
            </div>
          ) : filteredAvailableMods.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p className="text-lg mb-2">No mods found</p>
              <p>Try adjusting your search terms</p>
            </div>
          ) : (
            <div>
              <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                Showing {filteredAvailableMods.length} of {availableMods.length} mods from GitHub
              </div>
              
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredAvailableMods.map((mod, index) => (
                  <div
                    key={index}
                    className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border border-gray-200 dark:border-gray-700"
                  >
                    <div className="aspect-video bg-gray-200 dark:bg-gray-700">
                      <img
                        src={mod.imageURL}
                        alt={mod.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = 'https://via.placeholder.com/300x200/6B7280/FFFFFF?text=Mod+Image';
                        }}
                      />
                    </div>
                    
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                          {mod.name}
                        </h3>
                        <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                          GitHub
                        </span>
                      </div>
                      
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                        by {mod.author} • v{mod.version}
                      </p>
                      
                      <p className="text-sm text-gray-700 dark:text-gray-300 mb-4 line-clamp-3">
                        {mod.description}
                      </p>
                      
                      <div className="flex items-center justify-between">
                        <a
                          href={mod.readmeURL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm"
                        >
                          View Details
                        </a>
                        
                        {mod.installed ? (
                          <span className="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-md text-sm">
                            Installed
                          </span>
                        ) : downloading.includes(mod.name) ? (
                          <button 
                            disabled
                            className="px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-md cursor-not-allowed flex items-center gap-2"
                          >
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                            Installing...
                          </button>
                        ) : (
                          <button
                            onClick={() => downloadAndInstallMod(mod)}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
                          >
                            <div className="text-center">
                              Install Mod
                              <div className="text-xs text-blue-200 mt-1">
                                (Auto conversion)
                              </div>
                            </div>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Install Mod File or URL
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Download URL (optional)
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/mod.pak"
                  value={uploadUrl}
                  onChange={(e) => setUploadUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="text-center text-gray-500 dark:text-gray-400">
                — OR —
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Upload File
                </label>
                <input
                  type="file"
                  accept=".pak,.zip,.EXMODZ"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Supports .pak, .zip, and .EXMODZ files
                </p>
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
                disabled={uploading}
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