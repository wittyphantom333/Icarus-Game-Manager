interface ServerStatusProps {
  status: 'stopped' | 'running' | 'starting' | 'stopping';
}

export default function ServerStatus({ status }: ServerStatusProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'running': return 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30';
      case 'stopped': return 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30';
      case 'starting': return 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30';
      case 'stopping': return 'text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/30';
      default: return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-800';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'running': return 'Server Running';
      case 'stopped': return 'Server Stopped';
      case 'starting': return 'Server Starting...';
      case 'stopping': return 'Server Stopping...';
      default: return 'Unknown Status';
    }
  };

  return (
    <div className="mb-4">
      <div className={`inline-flex items-center px-3 py-2 rounded-full text-sm font-medium ${getStatusColor()}`}>
        <div className={`w-2 h-2 rounded-full mr-2 ${status === 'running' ? 'bg-green-600 dark:bg-green-400' : status === 'stopped' ? 'bg-red-600 dark:bg-red-400' : 'bg-yellow-600 dark:bg-yellow-400'}`}></div>
        {getStatusText()}
      </div>
    </div>
  );
}