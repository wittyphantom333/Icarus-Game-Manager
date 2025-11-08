'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ServerStatus from '@/components/ServerStatus';
import ServerControls from '@/components/ServerControls';
import LogViewer from '@/components/LogViewer';
import ModManager from '@/components/ModManager';
import ServerConfiguration from '@/components/ServerConfiguration';
import ServerStats from '@/components/ServerStats';
import ServerUpdate from '@/components/ServerUpdate';
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
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasLoadedInitialLogsRef = useRef(false); // Use ref to persist across renders
  
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

    // Handle page visibility changes
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[WebSocket] Page became visible, checking connection...');
        // Add a small delay to prevent race conditions
        setTimeout(() => {
          // If we're not connected and not currently reconnecting, try to reconnect
          if (!wsConnected && !isReconnecting) {
            console.log('[WebSocket] Reconnecting due to page visibility change');
            setReconnectAttempts(0); // Reset attempts on manual reconnection
            // Focus reconnection - don't reload logs
            connectWebSocket();
          }
        }, 100);
      }
    };

    // Handle window focus (additional reliability)
    const handleFocus = () => {
      console.log('[WebSocket] Window focused, checking connection...');
      // Add a small delay to prevent race conditions
      setTimeout(() => {
        if (!wsConnected && !isReconnecting) {
          console.log('[WebSocket] Reconnecting due to window focus');
          setReconnectAttempts(0);
          // Focus reconnection - don't reload logs
          connectWebSocket();
        }
      }, 100);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    
    // Cleanup on unmount
    return () => {
      if (wsConnection) {
        wsConnection.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
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
    // Prevent multiple simultaneous connections
    if (isReconnecting || wsConnected) {
      console.log('[WebSocket] Connection attempt blocked - already connecting or connected');
      return;
    }

    // Clear any existing reconnection timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Close any existing connection
    if (wsConnection && wsConnection.readyState !== WebSocket.CLOSED) {
      console.log('[WebSocket] Closing existing connection before creating new one');
      wsConnection.close();
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    console.log(`[WebSocket] Attempting connection to ${wsUrl} (attempt ${reconnectAttempts + 1})`);
    setIsReconnecting(true);
    
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('[WebSocket] Connected successfully');
      setWsConnected(true);
      setWsConnection(ws);
      setReconnectAttempts(0);
      setIsReconnecting(false);
      
      // Clear logs only for first connection or manual reconnection
      if (!hasLoadedInitialLogsRef.current) {
        console.log('[WebSocket] First connection - will load initial logs');
        setLogs([]);
      } else {
        console.log('[WebSocket] Reconnection - preserving existing logs');
      }
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'log') {
          setLogs(prevLogs => [...prevLogs, data.message]);
        } else if (data.type === 'log-background') {
          // Background logs are added to the beginning for smooth loading
          if (data.position === 'prepend') {
            setLogs(prevLogs => [data.message, ...prevLogs]);
          } else {
            setLogs(prevLogs => [...prevLogs, data.message]);
          }
        } else if (data.type === 'status') {
          setServerStatus(data.status);
        } else if (data.type === 'clear-logs' || data.type === 'logs-cleared') {
          console.log('[WebSocket] Logs cleared:', data.message);
          setLogs([]);
        } else if (data.type === 'connection-ready') {
          console.log('[WebSocket] Connection ready:', data.message);
          // Only request logs on first load or manual reconnection
          if (!hasLoadedInitialLogsRef.current) {
            console.log('[WebSocket] Requesting all session logs with progressive loading');
            setIsLoadingLogs(true);
            ws.send(JSON.stringify({ type: 'request-logs' }));
            hasLoadedInitialLogsRef.current = true;
          } else {
            console.log('[WebSocket] Skipping log request for alt-tab reconnection');
          }
        } else if (data.type === 'initial-logs-complete') {
          console.log('[WebSocket] Progressive log loading complete:', data.message);
          setIsLoadingLogs(false);
        } else if (data.type === 'system') {
          console.log('[WebSocket] System message:', data.message);
        }
      } catch (error) {
        console.error('[WebSocket] Error parsing message:', error);
      }
    };
    
    ws.onclose = (event) => {
      console.log(`[WebSocket] Disconnected (code: ${event.code}, reason: ${event.reason})`);
      setWsConnected(false);
      setWsConnection(null);
      setIsReconnecting(false);
      
      // Implement exponential backoff with max delay
      const maxAttempts = 10;
      const baseDelay = 1000; // 1 second
      const maxDelay = 30000; // 30 seconds
      
      if (reconnectAttempts < maxAttempts) {
        const delay = Math.min(baseDelay * Math.pow(2, reconnectAttempts), maxDelay);
        console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${reconnectAttempts + 1}/${maxAttempts})`);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          setReconnectAttempts(prev => prev + 1);
          connectWebSocket();
        }, delay);
      } else {
        console.error('[WebSocket] Max reconnection attempts reached');
        setIsReconnecting(false);
      }
    };
    
    ws.onerror = (error) => {
      console.error('[WebSocket] Connection error:', error);
      setWsConnected(false);
      setIsReconnecting(false);
    };
    
    setWsConnection(ws);
  };

  const manualReconnect = () => {
    console.log('[WebSocket] Manual reconnection requested');
    setReconnectAttempts(0);
    hasLoadedInitialLogsRef.current = false; // Force reload on manual reconnection
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsConnection) {
      wsConnection.close();
    }
    connectWebSocket();
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              <ServerUpdate 
                serverStatus={serverStatus}
                onUpdateComplete={() => {
                  // Refresh server status after update
                  checkServerStatus();
                  modal.showSuccess('Update Complete', 'Server has been updated successfully!');
                }}
              />
              
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Quick Actions</h2>
                <div className="space-y-3">
                  <button
                    onClick={() => setActiveTab('config')}
                    className="w-full text-left px-4 py-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <div>
                        <div className="font-medium">Server Configuration</div>
                        <div className="text-sm opacity-75">Manage server settings</div>
                      </div>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => setActiveTab('mods')}
                    className="w-full text-left px-4 py-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      <div>
                        <div className="font-medium">Mod Manager</div>
                        <div className="text-sm opacity-75">Install and manage mods</div>
                      </div>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => setActiveTab('backup')}
                    className="w-full text-left px-4 py-3 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <div>
                        <div className="font-medium">Backup & Restore</div>
                        <div className="text-sm opacity-75">Manage server backups</div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Server Logs</h2>
                  <div className="flex items-center space-x-2 text-sm">
                    <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500' : isReconnecting ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
                    <span className="text-gray-600 dark:text-gray-400">
                      {wsConnected ? 'Live' : isReconnecting ? 'Reconnecting...' : `Disconnected ${reconnectAttempts > 0 ? `(${reconnectAttempts}/10)` : ''}`}
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {!wsConnected && !isReconnecting && (
                    <button
                      onClick={manualReconnect}
                      className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors flex items-center space-x-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span>Reconnect</span>
                    </button>
                  )}
                </div>
              </div>
              <LogViewer logs={logs} isLoading={isLoadingLogs} />
            </div>
          </>
        )}

        {activeTab === 'config' && (
          <ServerConfiguration />
        )}

        {activeTab === 'mods' && (
          <ModManager />
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