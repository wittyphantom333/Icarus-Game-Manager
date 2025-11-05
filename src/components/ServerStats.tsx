'use client';

import { useState, useEffect, useCallback } from 'react';

interface ServerStatsData {
  uptime: string;
  memoryUsage: string;
  playerCount: number;
  maxPlayers: number;
  serverVersion: string;
}

const ServerStats = () => {
  const [stats, setStats] = useState<ServerStatsData>({
    uptime: 'Loading...',
    memoryUsage: 'Loading...',
    playerCount: 0,
    maxPlayers: 8,
    serverVersion: 'Loading...'
  });
  const [loading, setLoading] = useState(false); // Don't start with loading true to prevent flash
  const [refreshing, setRefreshing] = useState(false); // Separate state for manual refresh
  const [initialLoad, setInitialLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchStats = useCallback(async (isManualRefresh = false) => {
    try {
      setError(null);
      if (isManualRefresh) {
        setRefreshing(true);
      }
      
      // Create a timeout for the fetch request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
      
      const response = await fetch('/api/server/stats', {
        signal: controller.signal,
        cache: 'no-cache'
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.stats) {
        setStats(data.stats);
        setLastUpdated(new Date());
        setInitialLoad(false);
      } else {
        setError(data.error || 'Failed to fetch server stats');
        console.warn('Failed to fetch server stats:', data.error);
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          setError('Request timeout - server may be busy');
        } else if (error.message.includes('fetch')) {
          setError('Network error - could not connect to server');
        } else {
          setError(`Error: ${error.message}`);
        }
      } else {
        setError('Unknown error occurred');
      }
      console.warn('Failed to fetch server stats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setInitialLoad(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch with a small delay to prevent flash
    const initialTimeout = setTimeout(() => {
      fetchStats();
    }, 100);
    
    // Refresh stats every 45 seconds (longer interval to reduce load)
    const interval = setInterval(fetchStats, 45000);
    
    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [fetchStats]);

  // Only show loading skeleton after initial load and when manually refreshing
  if (loading && !initialLoad) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
        </div>
      </div>
    );
  }

  const statItems = [
    {
      label: 'Server Uptime',
      value: stats.uptime,
      icon: '🕒'
    },
    {
      label: 'Memory Usage',
      value: stats.memoryUsage,
      icon: '💾'
    },
    {
      label: 'Server Status',
      value: stats.uptime !== '0s' && stats.uptime !== 'Loading...' ? 'Online' : 'Offline',
      icon: stats.uptime !== '0s' && stats.uptime !== 'Loading...' ? '🟢' : '�'
    },
    {
      label: 'Server Version',
      value: stats.serverVersion,
      icon: '📦'
    }
  ];

  const refreshStats = () => {
    fetchStats(true); // Pass true to indicate manual refresh
  };

  return (
    <div className="space-y-4">
      {/* Header with refresh button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Last updated: {lastUpdated.toLocaleTimeString()}
            {refreshing && <span className="ml-2 text-blue-500">Refreshing...</span>}
          </span>
          {error && (
            <span className="text-sm text-red-600 dark:text-red-400">
              ⚠️ {error}
            </span>
          )}
        </div>
        <button
          onClick={refreshStats}
          disabled={refreshing}
          className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-50 transition-colors"
          title="Refresh stats"
        >
          <svg 
            className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statItems.map((item, index) => (
          <div
            key={index}
            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
          >
            <div className="flex items-center space-x-3">
              <span className="text-lg">{item.icon}</span>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {item.label}
              </span>
            </div>
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {item.value}
            </span>
          </div>
        ))}
      </div>
      
      {/* Server Status Indicator */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Server Activity
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {stats.uptime !== '0s' && stats.uptime !== 'Loading...' ? 'Running' : 'Stopped'}
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${
              stats.uptime !== 'Loading...' && stats.uptime !== '0s' 
                ? 'bg-green-500' 
                : 'bg-red-500'
            }`}
            style={{ 
              width: stats.uptime !== 'Loading...' && stats.uptime !== '0s' ? '100%' : '0%' 
            }}
          ></div>
        </div>
      </div>
    </div>
  );
};

export default ServerStats;