import { useEffect, useRef, useState } from 'react';

interface LogViewerProps {
  logs: string[];
}

export default function LogViewer({ logs }: LogViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 50;
    
    setAutoScroll(isNearBottom);
    setShowScrollButton(!isNearBottom);
  };

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      setAutoScroll(true);
      setShowScrollButton(false);
    }
  };

  return (
    <div className="relative">
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className="bg-black text-green-400 p-4 rounded-md h-96 overflow-y-auto font-mono text-sm"
      >
        {logs.length === 0 ? (
          <p className="text-gray-500">No logs available. Start the server to see logs.</p>
        ) : (
          logs.map((log, index) => (
            <div key={index} className="mb-1 whitespace-pre-wrap">
              {log}
            </div>
          ))
        )}
      </div>
      
      {showScrollButton && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 right-4 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md text-sm font-medium shadow-lg transition-colors"
        >
          ↓ Follow Logs
        </button>
      )}
      
      <div className="mt-2 flex items-center justify-between text-sm text-gray-600">
        <span>{logs.length} log entries</span>
        <div className="flex items-center space-x-2">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="mr-1"
            />
            Auto-scroll
          </label>
        </div>
      </div>
    </div>
  );
}