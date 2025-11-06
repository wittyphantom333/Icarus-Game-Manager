'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
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
        // If we're not connected and not currently reconnecting, try to reconnect
        if (!wsConnected && !isReconnecting) {
          console.log('[WebSocket] Reconnecting due to page visibility change');
          setReconnectAttempts(0); // Reset attempts on manual reconnection
          // Focus reconnection - don't reload logs
          connectWebSocket();
        }
      }
    };

    // Handle window focus (additional reliability)
    const handleFocus = () => {
      console.log('[WebSocket] Window focused, checking connection...');
      if (!wsConnected && !isReconnecting) {
        console.log('[WebSocket] Reconnecting due to window focus');
        setReconnectAttempts(0);
        // Focus reconnection - don't reload logs
        connectWebSocket();
      }
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
    // Clear any existing reconnection timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
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
          // Always request logs on page refresh/first load, skip on alt-tab reconnections
          if (!hasLoadedInitialLogsRef.current || logs.length === 0) {
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