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
    
    // Simple PowerShell command to clear directory
    await execAsync(`powershell -Command "Remove-Item -Path '${dirPath}\\*' -Recurse -Force -ErrorAction SilentlyContinue"`);
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
      // Ensure backup directory exists
      await fs.mkdir(BACKUP_DIR, { recursive: true });
      await execAsync(`powershell -Command "Compress-Archive -Path '${saveDir}' -DestinationPath '${tempBackupPath}' -Force -ErrorAction SilentlyContinue"`);
      console.log(`Created temporary backup: ${tempBackupPath}`);
    } catch (error) {
      console.warn('Could not create temporary backup:', error);
    }
    
    try {
      // Check if Icarus server is running before restore
      try {
        const { stdout } = await execAsync('tasklist /FI "IMAGENAME eq IcarusServer-Win64-Shipping.exe" /FO CSV');
        if (stdout.includes('IcarusServer-Win64-Shipping.exe')) {
          console.log('Warning: Icarus server is running during restore');
        }
      } catch (error) {
        // Ignore server check errors
      }

      // Clear the destination directory before restore to ensure clean state
      console.log('Clearing destination directory...');
      await clearDirectory(saveDir);
      
      // Recreate the base directory
      await fs.mkdir(saveDir, { recursive: true });
      
      // Extract backup directly to save directory
      console.log(`Extracting backup directly to save directory: ${saveDir}`);
      await extractZipBackup(backupPath, saveDir);
      
      // Verify restore was successful by checking if any files exist
      const dirContents = await fs.readdir(saveDir);
      if (dirContents.length === 0) {
        throw new Error('Restore verification failed - no files found after restore');
      }
      
      console.log(`Restore successful - ${dirContents.length} items restored`)
      
      // Clean up temporary backup after successful restore
      try {
        await fs.unlink(tempBackupPath);
        console.log('Cleaned up temporary backup');
      } catch (error) {
        console.warn('Could not clean up temporary backup:', error);
      }
      
      return NextResponse.json({
        success: true,
        message: 'Backup restored successfully. You may need to restart the Icarus server.',
        details: {
          restoredFrom: backupPath,
          restoreTime: new Date().toISOString()
        }
      });
      
    } catch (error) {
      console.error('Restore operation failed:', error);
      
      // If restore failed, try to restore from temporary backup
      if (tempBackupPath) {
        try {
          console.log('Restore failed, attempting to restore original saves...');
          
          // Clear directory first
          await clearDirectory(saveDir);
          
          // Recreate base directory
          await fs.mkdir(saveDir, { recursive: true });
          
          // Extract the temporary backup to restore original state
          await extractZipBackup(tempBackupPath, saveDir);
          
          console.log('Original saves restored successfully');
          
          // Clean up temporary backup
          try {
            await fs.unlink(tempBackupPath);
          } catch (cleanupError) {
            console.warn('Could not clean up temporary backup after recovery:', cleanupError);
          }
          
          return NextResponse.json({
            success: false,
            error: `Restore failed: ${error instanceof Error ? error.message : 'Unknown error'}. Your original saves have been restored.`,
            recovered: true,
            details: {
              originalError: error instanceof Error ? error.message : 'Unknown error',
              recoveryTime: new Date().toISOString()
            }
          }, { status: 500 });
          
        } catch (recoveryError) {
          console.error('Failed to recover original saves:', recoveryError);
          return NextResponse.json({
            success: false,
            error: 'Restore failed and could not recover original saves automatically.',
            recovered: false,
            tempBackupPath,
            details: {
              originalError: error instanceof Error ? error.message : 'Unknown error',
              recoveryError: recoveryError instanceof Error ? recoveryError.message : 'Unknown recovery error',
              manualRecoveryInstructions: `A temporary backup of your original saves was created at: ${tempBackupPath}. You can manually extract this to restore your saves.`
            }
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