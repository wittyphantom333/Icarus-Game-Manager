'use client';

import { useState, useEffect } from 'react';
import ServerStatus from '@/components/ServerStatus';
import ServerControls from '@/components/ServerControls';
import LogViewer from '@/components/LogViewer';
import ModManager from '@/components/ModManager';

export default function Home() {
  const [serverStatus, setServerStatus] = useState<'stopped' | 'running' | 'starting' | 'stopping'>('stopped');
  const [logs, setLogs] = useState<string[]>([]);
  const [wsConnected, setWsConnected] = useState(false);

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
          isConnecting = false;
        };
        
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'log') {
              setLogs(prev => [...prev.slice(-999), data.message]);
            } else if (data.type === 'status') {
              setServerStatus(data.status);
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

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold text-gray-900">
            Icarus Game Manager
          </h1>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm text-gray-600">
              {wsConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-semibold mb-4">Server Status</h2>
            <ServerStatus status={serverStatus} />
            <ServerControls 
              status={serverStatus} 
              onStatusChange={setServerStatus}
              onStatusRefresh={checkServerStatus}
            />
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-semibold mb-4">Mod Manager</h2>
            <ModManager />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold">Server Logs</h2>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  setLogs([]);
                  console.log('Logs cleared');
                }}
                className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Clear Logs
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Refresh Page
              </button>
            </div>
          </div>
          <LogViewer logs={logs} />
        </div>
      </div>
    </main>
  );
}