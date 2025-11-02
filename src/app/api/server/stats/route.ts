import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

interface ServerStats {
  uptime: string;
  memoryUsage: string;
  cpuUsage: string;
  playerCount: number;
  maxPlayers: number;
  serverVersion: string;
  lastRestart: string;
  processInfo?: {
    pid?: number;
    startTime?: string;
    workingSet?: string;
  };
}

// Function to get process information for IcarusServer.exe
async function getIcarusServerProcess() {
  try {
    // First try to get IcarusServer-Win64-Shipping (main game process)
    let { stdout } = await execAsync(`powershell -Command "Get-Process -Name 'IcarusServer-Win64-Shipping' -ErrorAction SilentlyContinue | Select-Object Id, StartTime, WorkingSet64, ProcessName, CPU | ConvertTo-Json"`);
    
    if (!stdout.trim()) {
      // If not found, try IcarusServer
      const result = await execAsync(`powershell -Command "Get-Process -Name 'IcarusServer' -ErrorAction SilentlyContinue | Select-Object Id, StartTime, WorkingSet64, ProcessName, CPU | ConvertTo-Json"`);
      stdout = result.stdout;
    }
    
    if (!stdout.trim()) {
      // Last resort - search for any process with Icarus in the name
      const result = await execAsync(`powershell -Command "Get-Process | Where-Object {$_.ProcessName -like '*Icarus*'} | Select-Object Id, StartTime, WorkingSet64, ProcessName, CPU | ConvertTo-Json"`);
      stdout = result.stdout;
    }
    
    console.log('PowerShell output:', stdout);
    
    if (stdout.trim()) {
      const processes = JSON.parse(stdout);
      const processArray = Array.isArray(processes) ? processes : [processes];
      
      // Prefer IcarusServer-Win64-Shipping, then IcarusServer, then the one with most memory
      let mainProcess = processArray.find(p => p.ProcessName === 'IcarusServer-Win64-Shipping');
      
      if (!mainProcess) {
        mainProcess = processArray.find(p => p.ProcessName === 'IcarusServer');
      }
      
      if (!mainProcess && processArray.length > 0) {
        mainProcess = processArray.reduce((prev, current) => 
          (current.WorkingSet64 > prev.WorkingSet64) ? current : prev
        );
      }
      
      console.log('Selected process:', mainProcess);
      return mainProcess;
    }
  } catch (error) {
    console.log('Error getting IcarusServer process:', error);
  }
  return null;
}

// Function to format start time for display
function formatStartTime(startTime: string): string {
  try {
    let start: Date;
    
    // Handle PowerShell JSON date format: /Date(timestamp)/
    if (startTime.startsWith('/Date(') && startTime.endsWith(')/')) {
      const timestamp = parseInt(startTime.substring(6, startTime.length - 2));
      start = new Date(timestamp);
    } else {
      start = new Date(startTime);
    }
    
    return start.toLocaleString();
  } catch (error) {
    console.log('Error formatting start time:', error);
    return 'Unknown';
  }
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

// Function to estimate CPU usage using process CPU time
async function getCpuUsage(processName?: string, processId?: number): Promise<string> {
  try {
    if (!processName && !processId) return '0%';
    
    // Try to get current CPU percentage using performance counters
    let stdout = '';
    
    if (processId) {
      try {
        const result = await execAsync(`powershell -Command "Get-Counter '\\Process(${processName})\\% Processor Time' -SampleInterval 1 -MaxSamples 2 | Select-Object -Last 1 | Select-Object -ExpandProperty CounterSamples | Select-Object -ExpandProperty CookedValue"`);
        stdout = result.stdout;
      } catch {
        // If performance counter fails, use CPU time approach
        const result = await execAsync(`powershell -Command "Get-Process -Id ${processId} | Select-Object -ExpandProperty CPU"`);
        const cpuTime = parseFloat(result.stdout.trim());
        if (cpuTime > 0) {
          // Rough estimate: CPU time in seconds divided by uptime
          return `${Math.min(Math.round(cpuTime / 100), 100)}%`;
        }
      }
    }
    
    if (stdout.trim()) {
      const cpuPercent = parseFloat(stdout.trim());
      return `${Math.round(cpuPercent)}%`;
    }
    
  } catch (error) {
    console.log('Could not get CPU usage:', error);
  }
  return '0%';
}

export async function GET() {
  try {
    const processInfo = await getIcarusServerProcess();
    const maxPlayers = await getMaxPlayers();
    
    console.log('Process info found:', processInfo ? {
      name: processInfo.ProcessName,
      pid: processInfo.Id,
      memory: processInfo.WorkingSet64
    } : 'No process found');
    
    let stats: ServerStats;
    
    if (processInfo) {
      // Server is running - get real stats
      const uptime = calculateUptime(processInfo.StartTime);
      const memoryUsage = formatBytes(processInfo.WorkingSet64);
      const cpuUsage = await getCpuUsage(processInfo.ProcessName, processInfo.Id);
      
      stats = {
        uptime,
        memoryUsage,
        cpuUsage,
        playerCount: 0, // Would need to parse server logs or connect to server to get real player count
        maxPlayers,
        serverVersion: getServerVersion(),
        lastRestart: formatStartTime(processInfo.StartTime),
        processInfo: {
          pid: processInfo.Id,
          startTime: processInfo.StartTime,
          workingSet: memoryUsage,
        }
      };
      
      console.log('Stats generated:', { uptime, memoryUsage, cpuUsage });
    } else {
      // Server is not running - return default/offline stats
      stats = {
        uptime: '0s',
        memoryUsage: '0 MB',
        cpuUsage: '0%',
        playerCount: 0,
        maxPlayers,
        serverVersion: getServerVersion(),
        lastRestart: 'Server not running',
      };
      
      console.log('No server process found, returning offline stats');
    }
    
    return NextResponse.json({ 
      success: true, 
      stats,
      serverRunning: !!processInfo,
      debug: {
        processFound: !!processInfo,
        processName: processInfo?.ProcessName,
        processCount: processInfo ? 1 : 0
      }
    });
    
  } catch (error) {
    console.error('Error getting server stats:', error);
    
    // Return fallback stats on error
    const maxPlayers = await getMaxPlayers();
    
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to get server statistics',
      stats: {
        uptime: 'Unknown',
        memoryUsage: 'Unknown',
        cpuUsage: 'Unknown',
        playerCount: 0,
        maxPlayers,
        serverVersion: getServerVersion(),
        lastRestart: 'Unknown',
      },
      serverRunning: false
    });
  }
}