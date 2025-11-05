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
    exmodz: string;
    png?: string;
  };
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
  
  const modal = useModal();

  useEffect(() => {
    loadInstalledMods();
  }, []);

  useEffect(() => {
    if (activeTab === 'browse' && availableMods.length === 0) {
      loadAvailableMods();
    }
  }, [activeTab, availableMods.length]);

  const loadInstalledMods = async () => {
    try {
      const response = await fetch('/api/mods');
      const data = await response.json();
      setInstalledMods(data.mods || []);
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
        const mods = await response.json();
        setAvailableMods(mods);
      }
    } catch (error) {
      console.error('Failed to load available mods:', error);
    } finally {
      setLoadingAvailable(false);
    }
  };

  const toggleMod = async (modId: string, enabled: boolean) => {
    try {
      const response = await fetch(`/api/mods/${modId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
      
      if (response.ok) {
        setInstalledMods(installedMods.map(mod => 
          mod.id === modId ? { ...mod, enabled } : mod
        ));
      }
    } catch (error) {
      console.error('Failed to toggle mod:', error);
    }
  };

  const installModFromFile = async (file: File) => {
    const formData = new FormData();
    formData.append('mod', file);

    try {
      const response = await fetch('/api/mods/install', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        loadInstalledMods();
      }
    } catch (error) {
      console.error('Failed to install mod:', error);
    }
  };

  const downloadAndInstallMod = async (mod: AvailableMod) => {
    setDownloading([...downloading, mod.name]);
    
    try {
      const response = await fetch('/api/mods/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: mod.name,
          downloadUrl: mod.files.exmodz,
          author: mod.author,
          version: mod.version,
          description: mod.description
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
      modal.showError('Installation Failed', `Failed to install ${mod.name}: Network error`);
    } finally {
      setDownloading(downloading.filter(name => name !== mod.name));
    }
  };

  const filteredAvailableMods = availableMods.filter(mod =>
    mod.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    mod.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
    mod.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="text-center py-4 text-gray-600 dark:text-gray-400">Loading mods...</div>;
  }

  return (
    <div className="space-y-4">
      <Modal isOpen={modal.isOpen} options={modal.options} onClose={modal.hideModal} />
      
      {/* Tab Navigation */}
      <div className="flex space-x-1 border-b border-gray-200 dark:border-gray-600">
        <button
          onClick={() => setActiveTab('installed')}
          className={`px-4 py-2 font-medium text-sm transition-colors ${
            activeTab === 'installed'
              ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          Installed Mods
        </button>
        <button
          onClick={() => setActiveTab('browse')}
          className={`px-4 py-2 font-medium text-sm transition-colors ${
            activeTab === 'browse'
              ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          Browse Mods
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'installed' ? (
        <div>
          <div className="space-y-2">
            {installedMods.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                No mods installed yet. Go to the Browse Mods tab to install some!
              </p>
            ) : (
              installedMods.map((mod: InstalledMod) => (
                <div key={mod.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900 dark:text-gray-100">{mod.name}</h3>
                      <span className="text-xs text-gray-500 dark:text-gray-400">v{mod.version}</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">by {mod.author || 'Unknown'}</span>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={mod.enabled}
                      onChange={(e) => toggleMod(mod.id, e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        // Browse Tab
        <div>
          <div className="mb-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Install Local Mod File
              </label>
              <input
                type="file"
                accept=".pak,.zip,.EXMODZ"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) installModFromFile(file);
                }}
                className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 dark:file:bg-blue-900 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 dark:hover:file:bg-blue-800"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Upload .pak, .zip, or .EXMODZ files directly
              </p>
            </div>
            
            <div className="border-t pt-4">
              <input
                type="text"
                placeholder="Search community mods..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              />
            </div>
          </div>

          {loadingAvailable ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600 dark:text-gray-400">Loading available mods...</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredAvailableMods.map((mod) => (
                <div key={mod.name} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-white dark:bg-gray-800">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">{mod.name}</h3>
                        {mod.installed && (
                          <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-xs rounded-full">
                            Installed
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        <strong>Author:</strong> {mod.author} | <strong>Version:</strong> {mod.version}
                      </p>
                      <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">{mod.description}</p>
                      {mod.imageURL && (
                        <img 
                          src={mod.imageURL} 
                          alt={mod.name}
                          className="w-full max-w-md h-32 object-cover rounded-md mb-3"
                        />
                      )}
                    </div>
                    <div className="ml-4">
                      {mod.installed ? (
                        <button 
                          disabled
                          className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-md cursor-not-allowed"
                        >
                          Already Installed
                        </button>
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
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                        >
                          <div className="text-center">
                            Install Mod
                            {mod.files.exmodz?.endsWith('.EXMODZ') && (
                              <div className="text-xs text-blue-200 mt-1">
                                (Placeholder conversion)
                              </div>
                            )}
                          </div>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {filteredAvailableMods.length === 0 && (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                  No mods found matching your search.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}