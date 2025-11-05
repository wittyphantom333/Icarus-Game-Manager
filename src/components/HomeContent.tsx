'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ServerStatus from '@/components/ServerStatus';
import ServerControls from '@/components/ServerControls';
import LogViewer from '@/components/LogViewer';
import ModManager from '@/components/ModManager';
import ServerConfiguration from '@/components/ServerConfiguration';
import ServerStats from '@/components/ServerStats';
import BackupRestore from '@/components/BackupRestore';
import ThemeToggle from '@/components/ThemeToggle';
import Modal from '@/components/Modal';
import { useModal } from '@/hooks/useModal';

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [serverStatus, setServerStatus] = useState<'stopped' | 'running' | 'starting' | 'stopping'>('stopped');
  const [logs, setLogs] = useState<string[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [wsConnection, setWsConnection] = useState<WebSocket | null>(null);
  
  // Get active tab from URL params, default to 'dashboard'
  const getActiveTab = (): 'dashboard' | 'config' | 'mods' | 'backup' => {
    const tab = searchParams.get('tab');
    if (tab && ['dashboard', 'config', 'mods', 'backup'].includes(tab)) {
      return tab as 'dashboard' | 'config' | 'mods' | 'backup';
    }
    return 'dashboard';
  };
  
  const [activeTab, setActiveTabState] = useState<'dashboard' | 'config' | 'mods' | 'backup'>(getActiveTab());
  
  const modal = useModal();
  
  // Update activeTab when URL changes
  useEffect(() => {
    setActiveTabState(getActiveTab());
  }, [searchParams]);
  
  // Function to change tab and update URL
  const setActiveTab = (tab: 'dashboard' | 'config' | 'mods' | 'backup') => {
    setActiveTabState(tab);
    const params = new URLSearchParams(window.location.search);
    if (tab === 'dashboard') {
      params.delete('tab'); // Remove tab param for dashboard (default)
    } else {
      params.set('tab', tab);
    }
    const newUrl = params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname;
    router.push(newUrl, { scroll: false });
  };

  useEffect(() => {
    // Check initial server status
    fetchServerStatus();
    
    // Set up WebSocket connection
    connectWebSocket();
    
    // Cleanup on unmount
    return () => {
      if (wsConnection) {
        wsConnection.close();
      }
    };
  }, []);

  const fetchServerStatus = async () => {
    try {
      const response = await fetch('/api/server/status');
      const data = await response.json();
      setServerStatus(data.status || 'stopped');
    } catch (error) {
      console.error('Failed to fetch server status:', error);
    }
  };

  const checkServerStatus = async () => {
    try {
      const response = await fetch('/api/server/status');
      const data = await response.json();
      setServerStatus(data.status);
    } catch (error) {
      console.error('Failed to check server status:', error);
    }
  };

  const connectWebSocket = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('WebSocket connected');
      setWsConnected(true);
      setWsConnection(ws);
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'log') {
          setLogs(prevLogs => [...prevLogs, data.message]);
        } else if (data.type === 'status') {
          setServerStatus(data.status);
        } else if (data.type === 'clear-logs') {
          setLogs([]);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setWsConnected(false);
      setWsConnection(null);
      
      // Attempt to reconnect after 3 seconds
      setTimeout(() => {
        connectWebSocket();
      }, 3000);
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setWsConnected(false);
    };
    
    setWsConnection(ws);
  };

  const clearLogs = async () => {
    try {
      const response = await fetch('/api/logs/clear', { method: 'POST' });
      const data = await response.json();
      
      if (data.success) {
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
            <a
              href="/api/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              title="Open API Documentation"
            >
              <span>API</span>
              <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {wsConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <ThemeToggle />
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-8">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'dashboard'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('config')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'config'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Configuration
            </button>
            <button
              onClick={() => setActiveTab('mods')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'mods'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Mods
            </button>
            <button
              onClick={() => setActiveTab('backup')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'backup'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Backup & Restore
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
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-6">
              Mod Manager
            </h2>
            <ModManager />
          </div>
        )}

        {activeTab === 'backup' && (
          <BackupRestore />
        )}


      </div>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}