const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { WebSocketServer } = require('ws');
const fs = require('fs');
const path = require('path');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const ICARUS_SERVER_PATH = 'C:\\icarusserver';

// Possible log file locations for Icarus
const POSSIBLE_LOG_PATHS = [
  path.join(ICARUS_SERVER_PATH, 'Icarus', 'Saved', 'Logs', 'Icarus.log'),
  path.join(ICARUS_SERVER_PATH, 'Icarus', 'Saved', 'Logs', 'IcarusServer.log'),
  path.join(ICARUS_SERVER_PATH, 'Logs', 'server.log'),
  path.join(ICARUS_SERVER_PATH, 'Logs', 'Icarus.log')
];

// Log rotation function - keeps only the last 14 log files
function rotateLogFiles() {
  console.log('[Log Rotation] Starting log rotation to keep last 14 files...');
  
  const logDir = path.join(ICARUS_SERVER_PATH, 'Icarus', 'Saved', 'Logs');
  if (!fs.existsSync(logDir)) {
    console.log('[Log Rotation] Log directory does not exist, skipping rotation');
    return;
  }

  try {
    // Find all log files (including rotated ones)
    const files = fs.readdirSync(logDir)
      .filter(file => file.includes('.log') || file.includes('Icarus-backup-'))
      .map(file => ({
        name: file,
        path: path.join(logDir, file),
        stat: fs.statSync(path.join(logDir, file))
      }))
      .sort((a, b) => b.stat.mtime - a.stat.mtime); // Sort by modification time, newest first

    console.log(`[Log Rotation] Found ${files.length} log files`);

    // Keep current log and last 13 backups (14 total)
    const filesToDelete = files.slice(14);
    
    filesToDelete.forEach(file => {
      try {
        fs.unlinkSync(file.path);
        console.log(`[Log Rotation] Deleted old log file: ${file.name}`);
      } catch (error) {
        console.error(`[Log Rotation] Failed to delete ${file.name}:`, error.message);
      }
    });

    // Rotate current log file if it exists and has content
    const currentLogPath = path.join(logDir, 'Icarus.log');
    if (fs.existsSync(currentLogPath)) {
      const stats = fs.statSync(currentLogPath);
      if (stats.size > 0) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const backupPath = path.join(logDir, `Icarus-backup-${timestamp}.log`);
        
        try {
          fs.copyFileSync(currentLogPath, backupPath);
          fs.writeFileSync(currentLogPath, ''); // Clear current log
          console.log(`[Log Rotation] Created backup: Icarus-backup-${timestamp}.log`);
        } catch (error) {
          console.error('[Log Rotation] Failed to create backup:', error.message);
        }
      }
    }

    console.log('[Log Rotation] Log rotation completed successfully');
  } catch (error) {
    console.error('[Log Rotation] Error during log rotation:', error.message);
  }
}

// Find the actual log file that exists
function findLogFile() {
  for (const logPath of POSSIBLE_LOG_PATHS) {
    if (fs.existsSync(logPath)) {
      return logPath;
    }
  }
  return null;
}

let lastLogSize = 0;
let serverStartupDetected = false; // Global flag to track if we've already detected this server startup
let currentServerStartTime = null; // Track when current server session started
let currentSessionStartLineIndex = 0; // Track where current session logs start

// Function to reset server startup detection (call when server stops/starts)
function resetServerStartupDetection() {
  serverStartupDetected = false;
  currentServerStartTime = new Date();
  currentSessionStartLineIndex = 0; // Reset session start position
  console.log('[Server] Reset startup detection, new session started at:', currentServerStartTime.toISOString());
}

// Function to find current session logs by looking for session start markers
function getCurrentSessionLogs(allLogLines) {
  if (currentSessionStartLineIndex === 0) {
    // Look for recent session start indicators (server startup patterns)
    const sessionMarkers = [
      'LogLoad: LoadMap:',
      'LogWorld: Bringing World',
      'LogGameMode: InitGame:',
      'LogEngine: Initializing Engine',
      'LogInit: Engine is initialized'
    ];
    
    // Find the most recent session start (work backwards from end)
    for (let i = allLogLines.length - 1; i >= 0; i--) {
      const line = allLogLines[i];
      if (sessionMarkers.some(marker => line.includes(marker))) {
        currentSessionStartLineIndex = i;
        console.log(`[Session Detection] Found session start at line ${i}: ${line.substring(0, 100)}...`);
        break;
      }
    }
    
    // Fallback: if no session marker found, look for timestamp gaps (restart indication)
    if (currentSessionStartLineIndex === 0 && allLogLines.length > 100) {
      // Look for significant time gaps that might indicate a restart
      const recentLogs = allLogLines.slice(-500); // Check last 500 lines for patterns
      let potentialStart = Math.max(0, allLogLines.length - 500);
      
      for (let i = 1; i < recentLogs.length; i++) {
        const prevLine = recentLogs[i - 1];
        const currentLine = recentLogs[i];
        
        // Extract timestamps if they exist
        const prevTimestamp = extractTimestamp(prevLine);
        const currentTimestamp = extractTimestamp(currentLine);
        
        if (prevTimestamp && currentTimestamp) {
          const timeDiff = Math.abs(currentTimestamp - prevTimestamp);
          // If there's a gap of more than 10 minutes, likely a restart
          if (timeDiff > 10 * 60 * 1000) {
            currentSessionStartLineIndex = potentialStart + i;
            console.log(`[Session Detection] Found restart gap at line ${currentSessionStartLineIndex}`);
            break;
          }
        }
      }
    }
  }
  
  // Return logs from current session start to end
  const sessionLogs = allLogLines.slice(currentSessionStartLineIndex);
  console.log(`[Session Detection] Current session: ${sessionLogs.length} logs (starting from line ${currentSessionStartLineIndex})`);
  return sessionLogs;
}

// Helper function to extract timestamp from log line
function extractTimestamp(logLine) {
  // Try to match Icarus log timestamp pattern: [2025.11.06-05.55.58:407]
  const match = logLine.match(/\[(\d{4}\.\d{2}\.\d{2}-\d{2}\.\d{2}\.\d{2}:\d{3})\]/);
  if (match) {
    const timestamp = match[1];
    // Convert to Date object
    const parts = timestamp.split(/[.-:]/);
    if (parts.length >= 6) {
      return new Date(
        parseInt(parts[0]), // year
        parseInt(parts[1]) - 1, // month (0-based)
        parseInt(parts[2]), // day
        parseInt(parts[3]), // hour
        parseInt(parts[4]), // minute
        parseInt(parts[5]), // second
        parseInt(parts[6] || 0) // millisecond
      ).getTime();
    }
  }
  return null;
}

app.prepare().then(async () => {
  // Rotate logs on startup to keep only last 14 files
  rotateLogFiles();
  
  // Initialize backup scheduler
  console.log('Initializing backup scheduler...');
  try {
    // We'll initialize the scheduler through an API call to avoid import issues
    // The scheduler will be initialized when the Next.js app starts
    console.log('Backup scheduler will be initialized on first API call');
  } catch (error) {
    console.error('Failed to initialize backup scheduler:', error.message);
  }

  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      
      // Handle WebSocket upgrade requests
      if (req.headers.upgrade === 'websocket') {
        if (parsedUrl.pathname === '/ws') {
          // Let our WebSocket server handle this
          return;
        }
      }
      
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // WebSocket Server
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    
    const logFilePath = findLogFile();
    let logInterval;
    let lastServerReadyCheck = '';
    let isReadingInitialLogs = true;
    
    // Send connection confirmation and wait for client to request logs
    ws.send(JSON.stringify({ 
      type: 'connection-ready', 
      message: 'WebSocket connected successfully' 
    }));
    
    if (!logFilePath) {
      ws.send(JSON.stringify({ 
        type: 'log', 
        message: '[SYSTEM] No log file found. Server may not be running or logs not enabled.' 
      }));
    } else {
      console.log(`[WebSocket] Monitoring log file: ${logFilePath}`);

      // Initialize log size tracking but don't send logs yet - wait for client request
      try {
        const logContent = fs.readFileSync(logFilePath, 'utf8');
        lastLogSize = logContent.length;
        isReadingInitialLogs = false; // Ready to monitor for new entries immediately
        
        const allLogLines = logContent.split('\n').filter(line => line.trim());
        const sessionLogs = getCurrentSessionLogs(allLogLines);
        console.log(`[WebSocket] Ready to send ${sessionLogs.length} current session logs (of ${allLogLines.length} total) on client request`);
      } catch (error) {
        console.error('Error reading log file:', error);
        ws.send(JSON.stringify({ 
          type: 'log', 
          message: `[ERROR] Error reading log file: ${error.message}` 
        }));
      }

      // Watch for new log entries using polling (more reliable than fs.watchFile)
      logInterval = setInterval(() => {
        if (ws.readyState !== ws.OPEN) {
          clearInterval(logInterval);
          return;
        }

        try {
          if (fs.existsSync(logFilePath)) {
            const stats = fs.statSync(logFilePath);
            
            // Check if file was truncated/rotated (size decreased)
            if (stats.size < lastLogSize) {
              console.log('[WebSocket] Log file was truncated/rotated, resending all content');
              lastLogSize = 0;
              
              // Send clear signal to client
              ws.send(JSON.stringify({ type: 'logs-cleared', message: 'Log file was rotated' }));
              
              // Send all current content
              if (stats.size > 0) {
                const logContent = fs.readFileSync(logFilePath, 'utf8');
                const lines = logContent.split('\n').filter(line => line.trim());
                
                lines.forEach((line, index) => {
                  setTimeout(() => {
                    if (ws.readyState === ws.OPEN) {
                      ws.send(JSON.stringify({ type: 'log', message: line }));
                    }
                  }, index * 5); // 5ms delay between each line
                });
                
                lastLogSize = stats.size;
              }
            } else if (stats.size > lastLogSize) {
              // Normal case: file grew, send new content
              const logContent = fs.readFileSync(logFilePath, 'utf8');
              const newContent = logContent.slice(lastLogSize);
              lastLogSize = stats.size;
              
              const newLines = newContent.split('\n').filter(line => line.trim());
              newLines.forEach(line => {
                if (ws.readyState === ws.OPEN) {
                  ws.send(JSON.stringify({ type: 'log', message: line }));
                  
                  // Check for server readiness indicator (only from NEW logs, not initial history)
                  if (!isReadingInitialLogs && 
                      line.includes('OnServerStartedEmpty()') && 
                      line !== lastServerReadyCheck && 
                      !serverStartupDetected) {
                    
                    lastServerReadyCheck = line;
                    serverStartupDetected = true; // Mark as detected globally
                    
                    console.log('[WebSocket] Server readiness detected from new log entry:', line);
                    ws.send(JSON.stringify({ 
                      type: 'server-ready', 
                      message: 'Server is ready and running' 
                    }));
                  }
                }
              });
            }
          }
        } catch (error) {
          console.error('Error checking log file:', error);
        }
      }, 1000); // Check every second
    }

    // Handle incoming messages
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'request-logs') {
          // Client is requesting current session logs only with smooth loading
          console.log('[WebSocket] Client requesting current session logs with progressive loading');
          try {
            const logContent = fs.readFileSync(logFilePath, 'utf8');
            const allLogLines = logContent.split('\n').filter(line => line.trim());
            const sessionLogs = getCurrentSessionLogs(allLogLines);
            lastLogSize = logContent.length;
            
            console.log(`[WebSocket] Sending ${sessionLogs.length} current session logs (of ${allLogLines.length} total) with smooth loading`);
            
            if (sessionLogs.length === 0) {
              ws.send(JSON.stringify({ 
                type: 'initial-logs-complete', 
                message: 'No current session logs available' 
              }));
              return;
            }
            
            // Send most recent 50 lines immediately for instant display
            const recentLogs = sessionLogs.slice(-50);
            const olderLogs = sessionLogs.slice(0, -50);
            
            // Send recent logs first (instant)
            recentLogs.forEach((log, index) => {
              setTimeout(() => {
                if (ws.readyState === ws.OPEN) {
                  ws.send(JSON.stringify({ type: 'log', message: log }));
                }
              }, index * 2); // 2ms delay for immediate display
            });
            
            // Send older logs progressively in the background
            if (olderLogs.length > 0) {
              const startDelay = recentLogs.length * 2 + 50; // Start after recent logs
              olderLogs.forEach((log, index) => {
                setTimeout(() => {
                  if (ws.readyState === ws.OPEN) {
                    ws.send(JSON.stringify({ 
                      type: 'log-background', 
                      message: log,
                      position: 'prepend' // Add to beginning of log list
                    }));
                  }
                }, startDelay + (index * 1)); // 1ms delay for background loading
              });
            }
            
            // Send completion message
            const totalDelay = (recentLogs.length * 2) + (olderLogs.length * 1) + 200;
            setTimeout(() => {
              if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({ 
                  type: 'initial-logs-complete', 
                  message: `All ${sessionLogs.length} current session logs loaded`
                }));
              }
            }, totalDelay);
          } catch (error) {
            console.error('Error sending requested logs:', error);
            ws.send(JSON.stringify({ 
              type: 'log', 
              message: `[ERROR] Error reading log file: ${error.message}` 
            }));
          }
        } else if (message.type === 'clear-logs') {
          // Reset log tracking
          lastLogSize = 0;
          lastServerReadyCheck = '';
          isReadingInitialLogs = false; // Treat as fresh start after clearing
          resetServerStartupDetection(); // Reset server startup detection
          
          // Send confirmation
          ws.send(JSON.stringify({ 
            type: 'logs-cleared', 
            message: 'Log tracking reset' 
          }));
        } else if (message.type === 'server-action') {
          // Reset server startup detection when server starts/stops
          if (message.action === 'start' || message.action === 'stop' || message.action === 'restart') {
            resetServerStartupDetection();
          }
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
      }
    });

    // Handle WebSocket events
    ws.on('close', (code, reason) => {
      if (logInterval) {
        clearInterval(logInterval);
      }
      console.log(`WebSocket client disconnected (code: ${code}, reason: ${reason})`);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      if (logInterval) {
        clearInterval(logInterval);
      }
    });

    // Send periodic ping to keep connection alive
    const pingInterval = setInterval(() => {
      if (ws.readyState === ws.OPEN) {
        ws.ping();
      } else {
        clearInterval(pingInterval);
      }
    }, 30000); // Ping every 30 seconds

    ws.on('close', () => {
      clearInterval(pingInterval);
    });
  });

  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> WebSocket server ready on ws://${hostname}:${port}/ws`);
  });

  // Handle process termination gracefully
  process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully');
    server.close(() => {
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down gracefully');
    server.close(() => {
      process.exit(0);
    });
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // Don't exit on uncaught exceptions in development
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit on unhandled rejections in development
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  });
});