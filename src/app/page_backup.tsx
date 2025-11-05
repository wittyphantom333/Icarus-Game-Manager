import HomeContent from '@/components/HomeContent';

export default function Home() {
  return <HomeContent />;
}

  useEffect(() => {
    // Check initial server status
    checkServerStatus();
    
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout;
    let isConnecting = false;

    const connectWebSocket = () => {
      if (isConnecting) return;
      isConnecting = true;

      try {
        ws = new WebSocket('ws://localhost:3000/ws');
        
        ws.onopen = () => {
          console.log('WebSocket connected');
          setWsConnected(true);
          setWsConnection(ws);
          isConnecting = false;
        };
        
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'log') {
              setLogs(prev => [...prev.slice(-999), data.message]);
            } else if (data.type === 'status') {
              setServerStatus(data.status);
            } else if (data.type === 'server-ready') {
              console.log('Server ready detected:', data.message);
              setServerStatus('running');
            } else if (data.type === 'logs-cleared') {
              setLogs([]);
              console.log('Logs cleared via WebSocket');
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          isConnecting = false;
        };

        ws.onclose = (event) => {
          console.log('WebSocket disconnected, code:', event.code);
          setWsConnected(false);
          setWsConnection(null);
          isConnecting = false;
          
          // Reconnect after 3 seconds if not manually closed
          if (event.code !== 1000) {
            reconnectTimeout = setTimeout(() => {
              console.log('Attempting to reconnect WebSocket...');
              connectWebSocket();
            }, 3000);
          }
        };
      } catch (error) {
        console.error('Failed to create WebSocket:', error);
        isConnecting = false;
        // Retry connection after 5 seconds
        reconnectTimeout = setTimeout(connectWebSocket, 5000);
      }
    };

    // Start initial connection
    connectWebSocket();

    // Cleanup function
    return () => {
      clearTimeout(reconnectTimeout);
      if (ws) {
        ws.close(1000); // Normal closure
      }
    };
  }, []);

  const checkServerStatus = async () => {
    try {
      const response = await fetch('/api/server/status');
      const data = await response.json();
      setServerStatus(data.status);
    } catch (error) {
      console.error('Failed to check server status:', error);
    }
  };

  const clearLogs = async () => {
    try {
      // Clear logs via API (clears the physical log file)
      const response = await fetch('/api/logs/clear', { method: 'POST' });
      const data = await response.json();
      
      if (response.ok && data.success) {
        console.log('Log file cleared:', data.message);
        
        // Clear UI logs immediately
        setLogs([]);
        
        // Notify WebSocket server to reset tracking
        if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
          wsConnection.send(JSON.stringify({ type: 'clear-logs' }));
        }
        
        modal.showSuccess('Logs Cleared', 'Server logs have been cleared successfully.');
      } else {
        console.error('Failed to clear logs:', data.error);
        modal.showError('Clear Logs Failed', `Failed to clear logs: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error clearing logs:', error);
      modal.showError('Clear Logs Failed', 'Failed to clear logs: Network error');
    }
  };

  return (
    <main className="min-h-screen bg-gray-100 dark:bg-gray-900 p-8 transition-colors">
      <Modal isOpen={modal.isOpen} options={modal.options} onClose={modal.hideModal} />
      
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">
            Icarus Game Manager
          </h1>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {wsConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <ThemeToggle />
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-8">
          <nav className="flex space-x-8 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`py-2 px-4 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'dashboard'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('config')}
              className={`py-2 px-4 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'config'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              Server Configuration
            </button>
            <button
              onClick={() => setActiveTab('mods')}
              className={`py-2 px-4 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'mods'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              Mod Manager
            </button>
            <button
              onClick={() => setActiveTab('backup')}
              className={`py-2 px-4 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'backup'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              Backup & Restore
            </button>
            <button
              onClick={() => setActiveTab('docs')}
              className={`py-2 px-4 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'docs'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              API Documentation
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'dashboard' && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Server Status</h2>
                <ServerStatus status={serverStatus} />
                <ServerControls 
                  status={serverStatus} 
                  onStatusChange={setServerStatus}
                  onStatusRefresh={checkServerStatus}
                />
              </div>
              
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Server Statistics</h2>
                <ServerStats />
              </div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Server Logs</h2>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={clearLogs}
                    className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                  >
                    Clear Logs
                  </button>
                  <button
                    onClick={() => window.location.reload()}
                    className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                  >
                    Refresh Page
                  </button>
                </div>
              </div>
              <LogViewer logs={logs} />
            </div>
          </>
        )}

        {activeTab === 'config' && (
          <ServerConfiguration />
        )}

        {activeTab === 'mods' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <ModManager />
          </div>
        )}

        {activeTab === 'backup' && (
          <BackupRestore />
        )}

        {activeTab === 'docs' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">API Documentation</h2>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Interactive documentation for all available API endpoints. Test requests directly from the browser.
              </p>
            </div>
            <div className="h-[800px] overflow-hidden">
              <iframe
                src="/docs"
                className="w-full h-full border-0"
                title="API Documentation"
              />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}