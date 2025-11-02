'use client';

import { useState, useEffect, useCallback } from 'react';

interface ServerStatsData {
  uptime: string;
  memoryUsage: string;
  cpuUsage: string;
  playerCount: number;
  maxPlayers: number;
  serverVersion: string;
  lastRestart: string;
}

const ServerStats = () => {
  const [stats, setStats] = useState<ServerStatsData>({
    uptime: '00:00:00',
    memoryUsage: '0 MB',
    cpuUsage: '0%',
    playerCount: 0,
    maxPlayers: 8,
    serverVersion: '1.0.0',
    lastRestart: 'Never'
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/server/stats');
      const data = await response.json();
      
      if (data.success && data.stats) {
        setStats(data.stats);
        setLastUpdated(new Date());
      } else {
        setError(data.error || 'Failed to fetch server stats');
        console.error('Failed to fetch server stats:', data.error);
      }
    } catch (error) {
      setError('Network error - could not connect to server');
      console.error('Failed to fetch server stats:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchStats();
    
    // Refresh stats every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    
    return () => clearInterval(interval);
  }, [fetchStats]);

  if (loading) {
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
      label: 'CPU Usage',
      value: stats.cpuUsage,
      icon: '⚡'
    },
    {
      label: 'Players',
      value: `${stats.playerCount}/${stats.maxPlayers}`,
      icon: '👥'
    },
    {
      label: 'Server Version',
      value: stats.serverVersion,
      icon: '📦'
    },
    {
      label: 'Last Restart',
      value: stats.lastRestart,
      icon: '🔄'
    }
  ];

  const refreshStats = () => {
    fetchStats();
  };

  return (
    <div className="space-y-4">
      {/* Header with refresh button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </span>
          {error && (
            <span className="text-sm text-red-600 dark:text-red-400">
              ⚠️ {error}
            </span>
          )}
        </div>
        <button
          onClick={refreshStats}
          disabled={loading}
          className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-50"
          title="Refresh stats"
        >
          <svg 
            className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
      
      {/* Player Usage Bar */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Server Load
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {Math.round((stats.playerCount / stats.maxPlayers) * 100)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(stats.playerCount / stats.maxPlayers) * 100}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
};

export default ServerStats;