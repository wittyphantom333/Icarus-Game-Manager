import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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
        console.log(`Found save directory: ${savePath}`);
        return savePath;
      }
    } catch (error) {
      console.log(`Directory ${savePath} not accessible:`, error);
      // Directory doesn't exist, continue to next path
    }
  }
  console.log('No Icarus save directory found');
  return null;
}

async function clearDirectory(dirPath: string): Promise<void> {
  try {
    console.log(`Clearing directory: ${dirPath}`);
    
    // Use PowerShell to clear the directory, excluding locked files
    await execAsync(`powershell -Command "Get-ChildItem -Path '${dirPath}' -Recurse | Where-Object { -not $_.PSIsContainer } | ForEach-Object { try { Remove-Item $_.FullName -Force } catch { Write-Warning \"Could not delete $($_.FullName): $_\" } }"`);
    
    // Remove empty directories
    await execAsync(`powershell -Command "Get-ChildItem -Path '${dirPath}' -Recurse -Directory | Sort-Object FullName -Descending | ForEach-Object { try { Remove-Item $_.FullName -Force } catch { Write-Warning \"Could not delete directory $($_.FullName): $_\" } }"`);
    
    console.log('Directory cleared successfully');
  } catch (error) {
    console.error('Error clearing directory:', error);
    throw new Error('Failed to clear save directory');
  }
}

async function extractZipBackup(backupPath: string, destDir: string): Promise<void> {
  try {
    // Use PowerShell to extract the zip file
    await execAsync(`powershell -Command "Expand-Archive -Path '${backupPath}' -DestinationPath '${destDir}' -Force"`);
  } catch (error) {
    console.error('Error extracting backup:', error);
    throw new Error('Failed to extract backup archive');
  }
}

export async function POST(request: NextRequest) {
  try {
    const { backupId } = await request.json();
    
    if (!backupId) {
      return NextResponse.json({
        success: false,
        error: 'Backup ID is required'
      }, { status: 400 });
    }
    
    // Find Icarus save directory
    const saveDir = await findIcarusSaveDirectory();
    if (!saveDir) {
      return NextResponse.json({
        success: false,
        error: 'Could not find Icarus save directory'
      }, { status: 404 });
    }
    
    // Find the backup file
    const backupFileName = `icarus-backup-${backupId}.zip`;
    const backupPath = path.join(BACKUP_DIR, backupFileName);
    
    try {
      await fs.stat(backupPath);
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: 'Backup file not found'
      }, { status: 404 });
    }
    
    console.log(`Restoring backup: ${backupPath}`);
    console.log(`Destination: ${saveDir}`);
    
    // Create a temporary backup of current saves before restore
    const tempBackupPath = path.join(BACKUP_DIR, `temp-pre-restore-${Date.now()}.zip`);
    try {
      await execAsync(`powershell -Command "Compress-Archive -Path '${saveDir}\\*' -DestinationPath '${tempBackupPath}' -Force"`);
      console.log(`Created temporary backup: ${tempBackupPath}`);
    } catch (error) {
      console.warn('Could not create temporary backup:', error);
    }
    
    try {
      // Extract to a temporary directory first
      const tempRestoreDir = path.join('C:\\temp', 'icarus-restore-' + Date.now());
      await fs.mkdir(tempRestoreDir, { recursive: true });
      
      console.log(`Extracting backup to temp directory: ${tempRestoreDir}`);
      await extractZipBackup(backupPath, tempRestoreDir);
      
      // Now copy the restored files to the save directory, overwriting but not deleting existing
      console.log('Copying restored files to save directory...');
      await execAsync(`robocopy "${tempRestoreDir}" "${saveDir}" /E /R:0 /W:0 /MT:8`);
      
      // Clean up temporary directory
      await execAsync(`powershell -Command "Remove-Item -Path '${tempRestoreDir}' -Recurse -Force"`);
      
      // Clean up temporary backup after successful restore
      try {
        await fs.unlink(tempBackupPath);
      } catch (error) {
        console.warn('Could not clean up temporary backup:', error);
      }
      
      return NextResponse.json({
        success: true,
        message: 'Backup restored successfully'
      });
      
    } catch (error) {
      // If restore failed, try to restore from temporary backup
      if (tempBackupPath) {
        try {
          console.log('Restore failed, attempting to restore original saves...');
          await clearDirectory(saveDir);
          await extractZipBackup(tempBackupPath, saveDir);
          await fs.unlink(tempBackupPath);
          
          return NextResponse.json({
            success: false,
            error: 'Restore failed, original saves have been restored',
            recovered: true
          }, { status: 500 });
        } catch (recoveryError) {
          console.error('Failed to recover original saves:', recoveryError);
          return NextResponse.json({
            success: false,
            error: 'Restore failed and could not recover original saves. Check the temp backup manually.',
            tempBackupPath
          }, { status: 500 });
        }
      }
      
      throw error;
    }
    
  } catch (error) {
    console.error('Restore failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to restore backup'
    }, { status: 500 });
  }
}