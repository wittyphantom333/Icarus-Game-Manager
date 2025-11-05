import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const SETTINGS_FILE = 'C:\\IcarusBackups\\settings.json';

interface BackupSettings {
  autoBackup: boolean;
  maxBackups: number;
}

const DEFAULT_SETTINGS: BackupSettings = {
  autoBackup: true,
  maxBackups: 10
};

async function loadSettings(): Promise<BackupSettings> {
  try {
    const data = await fs.readFile(SETTINGS_FILE, 'utf-8');
    return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
  } catch (error) {
    // File doesn't exist or is invalid, return defaults
    return DEFAULT_SETTINGS;
  }
}

async function saveSettings(settings: BackupSettings): Promise<void> {
  try {
    // Ensure backup directory exists
    await fs.mkdir(path.dirname(SETTINGS_FILE), { recursive: true });
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  } catch (error) {
    throw new Error('Failed to save backup settings');
  }
}

async function cleanupOldBackups(maxBackups: number): Promise<void> {
  try {
    const BACKUP_DIR = 'C:\\IcarusBackups';
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

export async function GET() {
  try {
    const settings = await loadSettings();
    return NextResponse.json({
      success: true,
      settings
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to load backup settings'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { autoBackup, maxBackups } = body;
    
    // Validate settings
    if (typeof autoBackup !== 'boolean' || typeof maxBackups !== 'number') {
      return NextResponse.json({
        success: false,
        error: 'Invalid settings format'
      }, { status: 400 });
    }
    
    if (maxBackups < 1 || maxBackups > 100) {
      return NextResponse.json({
        success: false,
        error: 'Max backups must be between 1 and 100'
      }, { status: 400 });
    }
    
    const settings: BackupSettings = {
      autoBackup,
      maxBackups
    };
    
    await saveSettings(settings);
    
    // Clean up old backups if necessary
    await cleanupOldBackups(maxBackups);
    
    return NextResponse.json({
      success: true,
      message: 'Backup settings updated successfully',
      settings
    });
    
  } catch (error) {
    console.error('Failed to update backup settings:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update backup settings'
    }, { status: 500 });
  }
}