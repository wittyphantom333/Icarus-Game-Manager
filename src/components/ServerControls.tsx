interface ServerControlsProps {
  status: 'stopped' | 'running' | 'starting' | 'stopping';
  onStatusChange: (status: 'stopped' | 'running' | 'starting' | 'stopping') => void;
  onStatusRefresh?: () => void;
}

// Helper function to notify WebSocket of server actions
const notifyServerAction = (action: 'start' | 'stop' | 'restart') => {
  try {
    // Try to find any existing WebSocket connection and notify it
    const ws = new WebSocket('ws://localhost:3000/ws');
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'server-action', action }));
      ws.close();
    };
  } catch (error) {
    console.log('Could not notify WebSocket of server action:', error);
  }
};

export default function ServerControls({ status, onStatusChange, onStatusRefresh }: ServerControlsProps) {
  
  const handleStart = async () => {
    onStatusChange('starting');
    notifyServerAction('start'); // Notify WebSocket to reset startup detection
    
    try {
      const response = await fetch('/api/server/start', { method: 'POST' });
      const data = await response.json();
      
      if (response.ok && data.success) {
        console.log('Server start success:', data.message);
        
        // Wait a moment then refresh the actual status
        setTimeout(() => {
          if (onStatusRefresh) {
            onStatusRefresh();
          } else {
            onStatusChange('running');
          }
        }, 1000);
      } else {
        console.error('Server start failed:', data.error || 'Unknown error');
        onStatusChange('stopped');
        alert(`Failed to start server: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to start server:', error);
      onStatusChange('stopped');
      alert('Failed to start server: Network error');
    }
  };

  const handleStop = async () => {
    onStatusChange('stopping');
    notifyServerAction('stop'); // Notify WebSocket to reset startup detection
    
    try {
      const response = await fetch('/api/server/stop', { method: 'POST' });
      const data = await response.json();
      
      if (response.ok && data.success) {
        console.log('Server stop success:', data.message);
        
        // Wait a moment then refresh the actual status
        setTimeout(() => {
          if (onStatusRefresh) {
            onStatusRefresh();
          } else {
            onStatusChange('stopped');
          }
        }, 1000);
      } else {
        console.error('Server stop failed:', data.error || 'Unknown error');
        onStatusChange('running');
        alert(`Failed to stop server: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to stop server:', error);
      onStatusChange('running');
      alert('Failed to stop server: Network error');
    }
  };

  const handleRestart = async () => {
    onStatusChange('stopping');
    notifyServerAction('restart'); // Notify WebSocket to reset startup detection
    
    try {
      const response = await fetch('/api/server/restart', { method: 'POST' });
      const data = await response.json();
      
      if (response.ok && data.success) {
        console.log('Server restart success:', data.message);
        
        // Wait a moment then refresh the actual status
        setTimeout(() => {
          if (onStatusRefresh) {
            onStatusRefresh();
          } else {
            onStatusChange('running');
          }
        }, 2000); // Longer delay for restart
      } else {
        console.error('Server restart failed:', data.error || 'Unknown error');
        onStatusChange('stopped');
        alert(`Failed to restart server: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to restart server:', error);
      onStatusChange('stopped');
      alert('Failed to restart server: Network error');
    }
  };

  const handleForceKill = async () => {
    const confirmed = window.confirm(
      'This will forcefully terminate ALL IcarusServer processes. This should only be used if the server is stuck or not responding. Continue?'
    );
    
    if (!confirmed) return;
    
    onStatusChange('stopping');
    try {
      const response = await fetch('/api/server/force-kill', { method: 'POST' });
      const data = await response.json();
      
      if (response.ok && data.success) {
        console.log('Force kill success:', data.message);
        
        // Show detailed results
        const details = data.details ? '\n\nDetails:\n' + data.details.join('\n') : '';
        alert(`${data.message}${details}`);
        
        // Wait a moment then refresh the actual status
        setTimeout(() => {
          if (onStatusRefresh) {
            onStatusRefresh();
          } else {
            onStatusChange('stopped');
          }
        }, 1000);
      } else {
        console.error('Force kill failed:', data.error || 'Unknown error');
        alert(`Failed to force kill processes: ${data.error || 'Unknown error'}`);
        
        // Still refresh status to see current state
        if (onStatusRefresh) {
          onStatusRefresh();
        }
      }
    } catch (error) {
      console.error('Failed to force kill processes:', error);
      alert('Failed to force kill processes: Network error');
      
      // Still refresh status to see current state
      if (onStatusRefresh) {
        onStatusRefresh();
      }
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex space-x-3">
        <button
          onClick={handleStart}
          disabled={status !== 'stopped'}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          Start Server
        </button>
        
        <button
          onClick={handleStop}
          disabled={status !== 'running'}
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          Stop Server
        </button>
        
        <button
          onClick={handleRestart}
          disabled={status === 'starting' || status === 'stopping'}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          Restart Server
        </button>
      </div>
      
      <div className="flex space-x-3">
        <button
          onClick={handleForceKill}
          className="px-4 py-2 bg-red-800 text-white rounded-md hover:bg-red-900 text-sm border border-red-600"
          title="Emergency: Force kill all IcarusServer processes"
        >
          🚨 Force Kill All Processes
        </button>
        <span className="text-xs text-gray-500 self-center">
          Use only if server is stuck or not responding
        </span>
      </div>
    </div>
  );
}