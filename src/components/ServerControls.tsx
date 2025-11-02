interface ServerControlsProps {
  status: 'stopped' | 'running' | 'starting' | 'stopping';
  onStatusChange: (status: 'stopped' | 'running' | 'starting' | 'stopping') => void;
  onStatusRefresh?: () => void;
}

export default function ServerControls({ status, onStatusChange, onStatusRefresh }: ServerControlsProps) {
  
  const handleStart = async () => {
    onStatusChange('starting');
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

  return (
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
  );
}