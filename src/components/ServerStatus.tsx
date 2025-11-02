interface ServerStatusProps {
  status: 'stopped' | 'running' | 'starting' | 'stopping';
}

export default function ServerStatus({ status }: ServerStatusProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'running': return 'text-green-600 bg-green-100';
      case 'stopped': return 'text-red-600 bg-red-100';
      case 'starting': return 'text-yellow-600 bg-yellow-100';
      case 'stopping': return 'text-orange-600 bg-orange-100';
      default: return 'text-gray-600 bg-gray-100';
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
        <div className={`w-2 h-2 rounded-full mr-2 ${status === 'running' ? 'bg-green-600' : status === 'stopped' ? 'bg-red-600' : 'bg-yellow-600'}`}></div>
        {getStatusText()}
      </div>
    </div>
  );
}