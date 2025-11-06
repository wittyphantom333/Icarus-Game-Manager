import { useEffect, useRef, useState, useMemo } from 'react';

interface LogViewerProps {
  logs: string[];
  isLoading?: boolean;
}

export default function LogViewer({ logs, isLoading = false }: LogViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Filter logs based on search term
  const filteredLogs = useMemo(() => {
    if (!searchTerm.trim()) {
      return logs;
    }
    return logs.filter(log => 
      log.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [logs, searchTerm]);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredLogs, autoScroll]);

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
      {/* Search Box */}
      <div className="mb-3">
        <div className="relative">
          <input
            type="text"
            placeholder="Search logs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 pl-10 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className="bg-black dark:bg-gray-900 text-green-400 dark:text-green-300 p-4 rounded-md h-96 overflow-y-auto font-mono text-sm border border-gray-300 dark:border-gray-600"
      >
        {logs.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">No logs available. Start the server to see logs.</p>
        ) : filteredLogs.length === 0 ? (
          <p className="text-yellow-500 dark:text-yellow-400">No logs match your search criteria.</p>
        ) : (
          filteredLogs.map((log, index) => {
            // Highlight search terms in the log
            const highlightedLog = searchTerm.trim() 
              ? log.replace(
                  new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
                  '<mark class="bg-yellow-300 dark:bg-yellow-600 text-black dark:text-white">$1</mark>'
                )
              : log;
            
            return (
              <div 
                key={index} 
                className="mb-1 whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ __html: highlightedLog }}
              />
            );
          })
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
      
      <div className="mt-2 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
        <span className="flex items-center space-x-2">
          <span>
            {searchTerm 
              ? `${filteredLogs.length} of ${logs.length} log entries` 
              : `${logs.length} log entries`
            }
            {searchTerm && (
              <span className="ml-2 text-blue-600 dark:text-blue-400">
                (filtered by "{searchTerm}")
              </span>
            )}
          </span>
          {isLoading && (
            <span className="flex items-center text-blue-500 dark:text-blue-400">
              <svg className="animate-spin -ml-1 mr-1 h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Loading...
            </span>
          )}
        </span>
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