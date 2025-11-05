import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

interface ServerStats {
  uptime: string;
  memoryUsage: string;
  playerCount: number;
  maxPlayers: number;
  serverVersion: string;
  processInfo?: {
    pid?: number;
    startTime?: string;
    workingSet?: string;
  };
}

// Function to get process information for IcarusServer.exe
async function getIcarusServerProcess() {
  try {
    // Use a single efficient command to check for the main process
    const { stdout } = await execAsync(`tasklist /FI "IMAGENAME eq IcarusServer-Win64-Shipping.exe" /FO CSV | findstr "IcarusServer-Win64-Shipping.exe"`);
    
    if (stdout.trim()) {
      // If process is found, get detailed info with PowerShell (single call)
      const detailResult = await execAsync(`powershell -Command "Get-Process -Name 'IcarusServer-Win64-Shipping' -ErrorAction SilentlyContinue | Select-Object Id, StartTime, WorkingSet64, ProcessName | ConvertTo-Json"`);
      
      if (detailResult.stdout.trim()) {
        const processData = JSON.parse(detailResult.stdout);
        return Array.isArray(processData) ? processData[0] : processData;
      }
    }
  } catch (error) {
    console.log('Error getting IcarusServer process:', error);
  }
  return null;
}



// Function to calculate uptime from start time
function calculateUptime(startTime: string): string {
  try {
    let start: Date;
    
    // Handle PowerShell JSON date format: /Date(timestamp)/
    if (startTime.startsWith('/Date(') && startTime.endsWith(')/')) {
      const timestamp = parseInt(startTime.substring(6, startTime.length - 2));
      start = new Date(timestamp);
    } else {
      start = new Date(startTime);
    }
    
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  } catch (error) {
    console.log('Error calculating uptime:', error);
    return '0s';
  }
}

// Function to format bytes to readable format
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 MB';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Function to get server configuration for max players
async function getMaxPlayers(): Promise<number> {
  try {
    // Try to read the server configuration
    const configPath = path.join(process.cwd(), 'server-config.json');
    const configData = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(configData);
    return config.MaxPlayers || 8;
  } catch (error) {
    return 8; // Default value
  }
}

// Function to get server version (placeholder - would need to read from game files)
function getServerVersion(): string {
  // This would typically read from the game installation directory
  // For now, return a placeholder version
  return '1.3.4.118364';
}



export async function GET() {
  try {
    // Set a timeout for the entire operation
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Stats request timeout')), 5000);
    });

    const statsPromise = async () => {
      const processInfo = await getIcarusServerProcess();
      const maxPlayers = await getMaxPlayers();
      
      let stats: ServerStats;
      
      if (processInfo) {
        // Server is running - get basic stats (skip CPU calculation as it's expensive)
        const uptime = calculateUptime(processInfo.StartTime);
        const memoryUsage = formatBytes(processInfo.WorkingSet64);
        
        stats = {
          uptime,
          memoryUsage,
          playerCount: 0, // Would need to parse server logs or connect to server to get real player count
          maxPlayers,
          serverVersion: getServerVersion(),
          processInfo: {
            pid: processInfo.Id,
            startTime: processInfo.StartTime,
            workingSet: memoryUsage,
          }
        };
      } else {
        // Server is not running - return default/offline stats
        stats = {
          uptime: '0s',
          memoryUsage: '0 MB',
          playerCount: 0,
          maxPlayers,
          serverVersion: getServerVersion(),
        };
      }
      
      return { 
        success: true, 
        stats,
        serverRunning: !!processInfo
      };
    };

    // Race between the stats promise and timeout
    const result = await Promise.race([statsPromise(), timeoutPromise]);
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Error getting server stats:', error);
    
    // Return fallback stats on error - don't try to get maxPlayers if we're erroring
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to get server statistics',
      stats: {
        uptime: 'Unknown',
        memoryUsage: 'Unknown',
        playerCount: 0,
        maxPlayers: 8, // Use default instead of querying
        serverVersion: getServerVersion(),
      },
      serverRunning: false
    }, { status: 500 });
  }
}