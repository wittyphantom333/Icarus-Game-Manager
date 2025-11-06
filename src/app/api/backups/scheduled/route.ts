import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface BackupInfo {
  id: string;
  name: string;
  date: string;
  size: string;
  type: 'manual' | 'auto' | 'scheduled';
  path: string;
}

// Common paths for Icarus save data
const SAVE_PATHS = [
  'C:\\icarusserver\\Icarus\\Saved',
  path.join(process.env.LOCALAPPDATA || '', 'Icarus', 'Saved'),
  path.join(process.env.APPDATA || '', 'Icarus', 'Saved'),
  path.join(process.env.USERPROFILE || '', 'AppData', 'Local', 'Icarus', 'Saved'),
  path.join(process.env.USERPROFILE || '', 'Documents', 'My Games', 'Icarus', 'Saved')
];

const BACKUP_DIR = 'C:\\IcarusBackups';

async function findIcarusSaveDirectory(): Promise<string | null> {
  for (const savePath of SAVE_PATHS) {
    try {
      const stats = await fs.stat(savePath);
      if (stats.isDirectory()) {
        console.log(`Found directory: ${savePath}`);
        // Check if it contains typical Icarus save folders or files
        const contents = await fs.readdir(savePath);
        console.log(`Contents: ${contents.join(', ')}`);
        
        // Look for SaveGames, Config, or other Icarus-related folders/files
        const hasIcarusContent = contents.some(item => 
          item.includes('SaveGames') || 
          item.includes('Config') || 
          item.includes('Logs') ||
          item.toLowerCase().includes('icarus') ||
          item.endsWith('.sav') ||
          item.endsWith('.ini')
        );
        
        if (hasIcarusContent || contents.length > 0) {
          console.log(`Using save directory: ${savePath}`);
          return savePath;
        }
      }
    } catch (error) {
      console.log(`Directory ${savePath} not accessible:`, error);
      // Directory doesn't exist, continue to next path
    }
  }
  console.log('No Icarus save directory found');
  return null;
}

async function ensureBackupDirectory(): Promise<void> {
  try {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to create backup directory:', error);
    throw new Error('Could not create backup directory');
  }
}

async function getDirectorySize(dirPath: string): Promise<number> {
  try {
    const { stdout } = await execAsync(`powershell -Command "(Get-ChildItem -Path '${dirPath}' -Recurse | Measure-Object -Property Length -Sum).Sum"`);
    return parseInt(stdout.trim()) || 0;
  } catch (error) {
    console.error('Error getting directory size:', error);
    return 0;
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

async function createZipBackup(sourceDir: string, backupPath: string): Promise<void> {
  try {
    console.log(`Creating backup from ${sourceDir} to ${backupPath}`);
    
    // Use a simpler approach - backup only the most important directories
    // PlayerData contains the actual save data, Config contains server settings
    const importantDirs = ['PlayerData', 'Config'];
    const tempDir = path.join('C:\\temp', 'icarus-backup-' + Date.now());
    await fs.mkdir(tempDir, { recursive: true });
    
    for (const dir of importantDirs) {
      const sourcePath = path.join(sourceDir, dir);
      const destPath = path.join(tempDir, dir);
      
      try {
        // Check if directory exists
        await fs.access(sourcePath);
        console.log(`Backing up ${dir}...`);
        
        // Copy directory recursively (excluding logs which might be locked)
        await execAsync(`robocopy "${sourcePath}" "${destPath}" /E /R:0 /W:0`);
      } catch (error) {
        console.log(`Directory ${dir} not found or error copying, skipping...`);
      }
    }
    
    // Create the zip file
    console.log('Creating zip archive...');
    await execAsync(`powershell -Command "Compress-Archive -Path '${tempDir}\\*' -DestinationPath '${backupPath}' -Force"`);
    
    // Clean up
    await execAsync(`powershell -Command "Remove-Item -Path '${tempDir}' -Recurse -Force"`);
    
    console.log('Backup completed successfully');
    
  } catch (error) {
    console.error('Error creating zip backup:', error);
    throw new Error(`Failed to create backup archive: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function loadBackupSettings() {
  try {
    const settingsPath = path.join(BACKUP_DIR, 'settings.json');
    const data = await fs.readFile(settingsPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return { maxBackups: 10 };
  }
}

async function cleanupOldBackups(maxBackups: number): Promise<void> {
  try {
    const files = await fs.readdir(BACKUP_DIR);
    const backupFiles = files
      .filter(file => file.startsWith('icarus-backup-') && file.endsWith('.zip'))
      .map(file => ({
        name: file,
        path: path.join(BACKUP_DIR, file),
        timestamp: file.replace('icarus-backup-', '').replace('.zip', '')
      }))
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp)); // Newest first

    if (backupFiles.length > maxBackups) {
      const filesToDelete = backupFiles.slice(maxBackups);
      console.log(`Cleaning up ${filesToDelete.length} old backups (keeping ${maxBackups})`);
      
      for (const file of filesToDelete) {
        try {
          await fs.unlink(file.path);
          console.log(`Deleted old backup: ${file.name}`);
        } catch (error) {
          console.error(`Failed to delete backup ${file.name}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Error during backup cleanup:', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { type = 'scheduled', name } = await request.json();
    
    // Find Icarus save directory
    const saveDir = await findIcarusSaveDirectory();
    if (!saveDir) {
      return NextResponse.json({
        success: false,
        error: 'Could not find Icarus save directory. Make sure the game has been run at least once.'
      }, { status: 404 });
    }

    // Ensure backup directory exists
    await ensureBackupDirectory();
    
    // Load backup settings
    const settings = await loadBackupSettings();
    
    // Generate backup name and path
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const backupName = name || `${type === 'scheduled' ? 'Scheduled' : 'Auto'} Backup - ${timestamp}`;
    const backupFileName = `icarus-backup-${timestamp}.zip`;
    const backupPath = path.join(BACKUP_DIR, backupFileName);
    
    console.log(`Creating scheduled backup: ${backupName}`);
    console.log(`Source: ${saveDir}`);
    console.log(`Destination: ${backupPath}`);
    
    // Get directory size before backup
    const dirSize = await getDirectorySize(saveDir);
    
    // Create the backup
    await createZipBackup(saveDir, backupPath);
    
    // Verify backup was created
    const backupStats = await fs.stat(backupPath);
    
    const backup: BackupInfo = {
      id: timestamp,
      name: backupName,
      date: new Date().toISOString(),
      size: formatBytes(backupStats.size),
      type: 'scheduled',
      path: backupPath
    };
    
    // Clean up old backups based on settings
    await cleanupOldBackups(settings.maxBackups || 10);
    
    return NextResponse.json({
      success: true,
      message: 'Scheduled backup created successfully',
      backup
    });
    
  } catch (error) {
    console.error('Scheduled backup creation failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create scheduled backup'
    }, { status: 500 });
  }
}