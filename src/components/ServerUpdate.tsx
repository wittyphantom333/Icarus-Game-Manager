import React, { useState, useEffect } from 'react';

interface ServerUpdateProps {
  serverStatus: 'stopped' | 'running' | 'starting' | 'stopping';
  onUpdateComplete?: () => void;
}

interface UpdateStatus {
  canUpdate: boolean;
  steamcmdExists: boolean;
  serverExists: boolean;
  steamcmdPath: string;
  serverPath: string;
  currentVersion: string;
  requirements: {
    steamcmd: string;
    serverDirectory: string;
  };
}

interface UpdateProgress {
  type: 'status' | 'progress' | 'error' | 'complete';
  message: string;
  progress?: number;
  output?: string;
  success?: boolean;
  exitCode?: number;
  suggestions?: string;
}

export default function ServerUpdate({ serverStatus, onUpdateComplete }: ServerUpdateProps) {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateProgress, setUpdateProgress] = useState<UpdateProgress[]>([]);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUpdateStatus();
  }, []);

  const checkUpdateStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/server/update');
      if (response.ok) {
        const data = await response.json();
        setUpdateStatus(data);
      } else {
        console.error('Failed to check update status');
      }
    } catch (error) {
      console.error('Error checking update status:', error);
    } finally {
      setLoading(false);
    }
  };

  const startUpdate = async () => {
    if (serverStatus !== 'stopped') {
      alert('Please stop the server before updating.');
      return;
    }

    if (!updateStatus?.canUpdate) {
      alert('Server update requirements not met. Please check the requirements below.');
      return;
    }

    setIsUpdating(true);
    setUpdateProgress([]);
    setCurrentProgress(0);

    try {
      const response = await fetch('/api/server/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'update' }),
      });

      if (!response.ok) {
        throw new Error('Failed to start update');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response stream available');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data: UpdateProgress = JSON.parse(line.slice(6));
                setUpdateProgress(prev => [...prev, data]);
                
                if (data.progress !== undefined) {
                  setCurrentProgress(data.progress);
                }

                if (data.type === 'complete') {
                  setIsUpdating(false);
                  if (data.success && onUpdateComplete) {
                    onUpdateComplete();
                  }
                  // Show suggestions for failed updates
                  if (!data.success && data.suggestions) {
                    setUpdateProgress(prev => [...prev, {
                      type: 'error',
                      message: `Suggestion: ${data.suggestions}`
                    }]);
                  }
                }
              } catch (error) {
                console.error('Error parsing update progress:', error);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      console.error('Update error:', error);
      setUpdateProgress(prev => [...prev, {
        type: 'error',
        message: `Update failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }]);
      setIsUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Server Update
        </h3>
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span className="text-gray-600 dark:text-gray-400">Checking update status...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Server Update
        </h3>
        <button
          onClick={checkUpdateStatus}
          className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          Refresh Status
        </button>
      </div>

      {updateStatus && (
        <div className="space-y-4">
          {/* Current Version */}
          <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Current Version:</span>
            <span className="text-sm text-gray-900 dark:text-gray-100">{updateStatus.currentVersion}</span>
          </div>

          {/* Requirements Status */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Requirements:</h4>
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${updateStatus.steamcmdExists ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm text-gray-600 dark:text-gray-400">SteamCMD: {updateStatus.requirements.steamcmd}</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${updateStatus.serverExists ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm text-gray-600 dark:text-gray-400">Server Directory: {updateStatus.requirements.serverDirectory}</span>
              </div>
            </div>
          </div>

          {/* Update Button */}
          <div className="pt-4 space-y-2">
            <button
              onClick={startUpdate}
              disabled={isUpdating || !updateStatus.canUpdate || serverStatus !== 'stopped'}
              className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                isUpdating || !updateStatus.canUpdate || serverStatus !== 'stopped'
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-600 dark:text-gray-400'
                  : 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600'
              }`}
            >
              {isUpdating ? 'Updating Server...' : 'Update Server'}
            </button>

            {/* Retry button for failed updates */}
            {updateProgress.length > 0 && 
             updateProgress.some(p => p.type === 'complete' && !p.success) && 
             !isUpdating && (
              <div className="space-y-2">
                <button
                  onClick={() => {
                    setUpdateProgress([]);
                    setCurrentProgress(0);
                    startUpdate();
                  }}
                  className="w-full py-2 px-4 rounded-lg font-medium transition-colors bg-yellow-600 text-white hover:bg-yellow-700 dark:bg-yellow-500 dark:hover:bg-yellow-600"
                >
                  Try Again
                </button>
                
                {/* Smart retry with delay for Steam server issues */}
                {updateProgress.some(p => p.message.toLowerCase().includes('steam server temporarily unavailable')) && (
                  <button
                    onClick={() => {
                      setUpdateProgress(prev => [...prev, {
                        type: 'status',
                        message: 'Waiting 30 seconds before retry (recommended for Steam server issues)...'
                      }]);
                      
                      setTimeout(() => {
                        setUpdateProgress([]);
                        setCurrentProgress(0);
                        startUpdate();
                      }, 30000);
                    }}
                    className="w-full py-2 px-4 rounded-lg font-medium transition-colors bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                  >
                    Wait & Retry (30s)
                  </button>
                )}
              </div>
            )}
            
            {serverStatus !== 'stopped' && (
              <p className="text-sm text-orange-600 dark:text-orange-400 mt-2 text-center">
                Stop the server before updating
              </p>
            )}
          </div>

          {/* Progress Bar */}
          {isUpdating && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Progress</span>
                <span className="text-gray-900 dark:text-gray-100">{currentProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${currentProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Steam Server Status Info */}
          {updateProgress.some(p => p.message.toLowerCase().includes('steam server temporarily unavailable')) && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200">Steam Server Issue Detected</h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    Steam servers are temporarily unavailable. This is a common, temporary issue that usually resolves within a few minutes.
                  </p>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    <strong>Recommendation:</strong> Wait 30-60 seconds and try again. Steam servers typically recover quickly.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Update Log */}
          {updateProgress.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Update Log:</h4>
              <div className="bg-gray-900 text-green-400 p-3 rounded text-xs font-mono max-h-64 overflow-y-auto">
                {updateProgress.map((progress, index) => (
                  <div
                    key={index}
                    className={`${
                      progress.type === 'error' ? 'text-red-400' :
                      progress.type === 'complete' && progress.success ? 'text-green-400' :
                      progress.type === 'complete' && !progress.success ? 'text-red-400' :
                      'text-gray-300'
                    }`}
                  >
                    [{new Date().toLocaleTimeString()}] {progress.message}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Installation Instructions */}
          {!updateStatus.canUpdate && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">Setup Required:</h4>
              <div className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                {!updateStatus.steamcmdExists && (
                  <div>
                    <p>1. Download SteamCMD from: <a href="https://steamcdn-a.akamaihd.net/client/installer/steamcmd.zip" target="_blank" className="underline">steamcmd.zip</a></p>
                    <p>2. Extract to: <code className="bg-yellow-100 dark:bg-yellow-800 px-1 rounded">{updateStatus.steamcmdPath}</code></p>
                  </div>
                )}
                {!updateStatus.serverExists && (
                  <p>3. Ensure server is installed at: <code className="bg-yellow-100 dark:bg-yellow-800 px-1 rounded">{updateStatus.serverPath}</code></p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}