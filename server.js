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

// Function to reset server startup detection (call when server stops/starts)
function resetServerStartupDetection() {
  serverStartupDetected = false;
  currentServerStartTime = new Date();
  console.log('[Server] Reset startup detection, new session started at:', currentServerStartTime.toISOString());
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
    
    // Send connection confirmation
    ws.send(JSON.stringify({ 
      type: 'system', 
      message: 'WebSocket connected successfully' 
    }));
    
    if (!logFilePath) {
      ws.send(JSON.stringify({ 
        type: 'log', 
        message: '[SYSTEM] No log file found. Server may not be running or logs not enabled.' 
      }));
    } else {
      console.log(`[WebSocket] Monitoring log file: ${logFilePath}`);

      // Send existing logs (last 50 lines)
      try {
        const logContent = fs.readFileSync(logFilePath, 'utf8');
        const logs = logContent.split('\n').slice(-50).filter(line => line.trim());
        lastLogSize = logContent.length;
        
        // Send logs with a small delay to prevent overwhelming
        logs.forEach((log, index) => {
          setTimeout(() => {
            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({ type: 'log', message: log }));
            }
          }, index * 10); // 10ms delay between each log line
        });
        
        // Set flag to false after initial logs are sent
        setTimeout(() => {
          isReadingInitialLogs = false;
          console.log('[WebSocket] Finished sending initial logs, now monitoring for new entries');
        }, logs.length * 10 + 100); // Wait for all initial logs plus a buffer
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
            if (stats.size > lastLogSize) {
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
        
        if (message.type === 'clear-logs') {
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