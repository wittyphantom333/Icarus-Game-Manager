'use client';

import { useState, useEffect } from 'react';

interface ServerConfig {
  SessionName: string;
  JoinPassword: string;
  MaxPlayers: number;
  ShutdownIfNotJoinedFor: number;
  ShutdownIfEmptyFor: number;
  AdminPassword: string;
  LoadProspect: string;
  CreateProspect: string;
  ResumeProspect: boolean;
  LastProspectName: string;
  AllowNonAdminsToLaunchProspects: boolean;
  AllowNonAdminsToDeleteProspects: boolean;
  FiberFoliageRespawn: boolean;
  LargeStonesRespawn: boolean;
  GameSaveFrequency: number;
  SaveGameOnExit: boolean;
}

export default function ServerConfiguration() {
  const [config, setConfig] = useState<ServerConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const response = await fetch('/api/server/config');
      if (response.ok) {
        const data = await response.json();
        setConfig(data.config);
      } else {
        setMessage({ type: 'error', text: 'Failed to load server configuration' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error loading server configuration' });
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!config) return;

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/server/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ config }),
      });

      if (response.ok) {
        const data = await response.json();
        setMessage({ type: 'success', text: data.message });
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error || 'Failed to save configuration' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error saving server configuration' });
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = (key: keyof ServerConfig, value: any) => {
    if (!config) return;
    setConfig({ ...config, [key]: value });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-800 dark:text-red-300">Failed to load server configuration</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Server Configuration</h1>
          <button
            onClick={saveConfig}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 dark:disabled:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Saving...
              </>
            ) : (
              'Save Configuration'
            )}
          </button>
        </div>

        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success' 
              ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800' 
              : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800'
          }`}>
            {message.text}
          </div>
        )}

        <div className="grid gap-6">
          {/* Basic Server Settings */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200">Basic Server Settings</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Server Name
                </label>
                <input
                  type="text"
                  value={config.SessionName}
                  onChange={(e) => updateConfig('SessionName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  placeholder="My Icarus Server"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Max Players
                </label>
                <input
                  type="number"
                  min="1"
                  max="64"
                  value={config.MaxPlayers}
                  onChange={(e) => updateConfig('MaxPlayers', parseInt(e.target.value) || 8)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                />
              </div>
            </div>
          </div>

          {/* Security Settings */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200">Security Settings</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Join Password
                </label>
                <input
                  type="password"
                  value={config.JoinPassword}
                  onChange={(e) => updateConfig('JoinPassword', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  placeholder="Leave empty for no password"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Admin Password
                </label>
                <input
                  type="password"
                  value={config.AdminPassword}
                  onChange={(e) => updateConfig('AdminPassword', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  placeholder="Admin password"
                />
              </div>
            </div>
          </div>

          {/* Timeout Settings */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200">Timeout Settings</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Shutdown if Not Joined For (seconds)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={config.ShutdownIfNotJoinedFor}
                  onChange={(e) => updateConfig('ShutdownIfNotJoinedFor', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">0 = Never shutdown</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Shutdown if Empty For (seconds)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={config.ShutdownIfEmptyFor}
                  onChange={(e) => updateConfig('ShutdownIfEmptyFor', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">0 = Never shutdown</p>
              </div>
            </div>
          </div>

          {/* Prospect Settings */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200">Prospect Settings</h2>
            <div className="grid gap-4">
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Load Prospect
                  </label>
                  <input
                    type="text"
                    value={config.LoadProspect}
                    onChange={(e) => updateConfig('LoadProspect', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                    placeholder="Prospect file name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Create Prospect
                  </label>
                  <input
                    type="text"
                    value={config.CreateProspect}
                    onChange={(e) => updateConfig('CreateProspect', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                    placeholder="New prospect name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Last Prospect Name
                  </label>
                  <input
                    type="text"
                    value={config.LastProspectName}
                    onChange={(e) => updateConfig('LastProspectName', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                    placeholder="Last prospect"
                  />
                </div>
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="resumeProspect"
                    checked={config.ResumeProspect}
                    onChange={(e) => updateConfig('ResumeProspect', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="resumeProspect" className="ml-2 text-sm font-medium text-gray-700">
                    Resume Prospect
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="allowNonAdminsToLaunch"
                    checked={config.AllowNonAdminsToLaunchProspects}
                    onChange={(e) => updateConfig('AllowNonAdminsToLaunchProspects', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="allowNonAdminsToLaunch" className="ml-2 text-sm font-medium text-gray-700">
                    Allow Non-Admins to Launch Prospects
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="allowNonAdminsToDelete"
                    checked={config.AllowNonAdminsToDeleteProspects}
                    onChange={(e) => updateConfig('AllowNonAdminsToDeleteProspects', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="allowNonAdminsToDelete" className="ml-2 text-sm font-medium text-gray-700">
                    Allow Non-Admins to Delete Prospects
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Game Settings */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200">Game Settings</h2>
            <div className="grid gap-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="fiberFoliageRespawn"
                    checked={config.FiberFoliageRespawn}
                    onChange={(e) => updateConfig('FiberFoliageRespawn', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="fiberFoliageRespawn" className="ml-2 text-sm font-medium text-gray-700">
                    Fiber Foliage Respawn
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="largeStonesRespawn"
                    checked={config.LargeStonesRespawn}
                    onChange={(e) => updateConfig('LargeStonesRespawn', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="largeStonesRespawn" className="ml-2 text-sm font-medium text-gray-700">
                    Large Stones Respawn
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="saveGameOnExit"
                    checked={config.SaveGameOnExit}
                    onChange={(e) => updateConfig('SaveGameOnExit', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="saveGameOnExit" className="ml-2 text-sm font-medium text-gray-700">
                    Save Game on Exit
                  </label>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Game Save Frequency (minutes)
                </label>
                <input
                  type="number"
                  min="1"
                  step="0.1"
                  value={config.GameSaveFrequency}
                  onChange={(e) => updateConfig('GameSaveFrequency', parseFloat(e.target.value) || 10)}
                  className="w-full md:w-48 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">How often to auto-save the game</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>Note:</strong> Changes will be saved to ServerSettings.ini. The server may need to be restarted for some changes to take effect.
          </p>
        </div>
      </div>
    </div>
  );
}
