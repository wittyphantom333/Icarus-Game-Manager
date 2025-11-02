import { useState, useEffect } from 'react';

interface Mod {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  description: string;
}

export default function ModManager() {
  const [mods, setMods] = useState<Mod[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMods();
  }, []);

  const loadMods = async () => {
    try {
      const response = await fetch('/api/mods');
      const data = await response.json();
      setMods(data.mods || []);
    } catch (error) {
      console.error('Failed to load mods:', error);
    } finally {
      setLoading(false);
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
        setMods(mods.map(mod => 
          mod.id === modId ? { ...mod, enabled } : mod
        ));
      }
    } catch (error) {
      console.error('Failed to toggle mod:', error);
    }
  };

  const installMod = async (file: File) => {
    const formData = new FormData();
    formData.append('mod', file);

    try {
      const response = await fetch('/api/mods/install', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        loadMods(); // Reload mods list
      }
    } catch (error) {
      console.error('Failed to install mod:', error);
    }
  };

  if (loading) {
    return <div className="text-center py-4">Loading mods...</div>;
  }

  return (
    <div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Install New Mod
        </label>
        <input
          type="file"
          accept=".pak,.zip"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) installMod(file);
          }}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
      </div>

      <div className="space-y-2">
        {mods.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No mods installed</p>
        ) : (
          mods.map((mod) => (
            <div key={mod.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
              <div>
                <h3 className="font-medium">{mod.name}</h3>
                <p className="text-sm text-gray-600">v{mod.version}</p>
                <p className="text-xs text-gray-500">{mod.description}</p>
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
  );
}