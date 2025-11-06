import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import BackupScheduler from '@/lib/services/backup-scheduler';

const SETTINGS_FILE = 'C:\\IcarusBackups\\settings.json';

interface BackupSchedule {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  time: string; // HH:MM format
  dayOfWeek?: number; // 0-6 (0 = Sunday) for weekly
  dayOfMonth?: number; // 1-31 for monthly
  lastRun?: string; // ISO string
  nextRun?: string; // ISO string
}

interface BackupSettings {
  autoBackup: boolean; // Legacy - will be replaced by schedule
  maxBackups: number;
  schedule: BackupSchedule;
}

const DEFAULT_SETTINGS: BackupSettings = {
  autoBackup: false, // Disabled by default now
  maxBackups: 10,
  schedule: {
    enabled: false,
    frequency: 'daily',
    time: '02:00', // 2 AM by default
    lastRun: undefined,
    nextRun: undefined
  }
};

async function loadSettings(): Promise<BackupSettings> {
  try {
    const data = await fs.readFile(SETTINGS_FILE, 'utf-8');
    const loadedSettings = JSON.parse(data);
    
    // Merge with defaults to handle new fields
    return {
      ...DEFAULT_SETTINGS,
      ...loadedSettings,
      schedule: {
        ...DEFAULT_SETTINGS.schedule,
        ...loadedSettings.schedule
      }
    };
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
    const { autoBackup, maxBackups, schedule } = body;
    
    // Load current settings first
    const currentSettings = await loadSettings();
    
    // Validate basic settings
    if (autoBackup !== undefined && typeof autoBackup !== 'boolean') {
      return NextResponse.json({
        success: false,
        error: 'Invalid autoBackup format'
      }, { status: 400 });
    }
    
    if (maxBackups !== undefined && (typeof maxBackups !== 'number' || maxBackups < 1 || maxBackups > 100)) {
      return NextResponse.json({
        success: false,
        error: 'Max backups must be a number between 1 and 100'
      }, { status: 400 });
    }
    
    // Validate schedule settings if provided
    if (schedule) {
      if (schedule.enabled !== undefined && typeof schedule.enabled !== 'boolean') {
        return NextResponse.json({
          success: false,
          error: 'Schedule enabled must be boolean'
        }, { status: 400 });
      }
      
      if (schedule.frequency && !['daily', 'weekly', 'monthly'].includes(schedule.frequency)) {
        return NextResponse.json({
          success: false,
          error: 'Schedule frequency must be daily, weekly, or monthly'
        }, { status: 400 });
      }
      
      if (schedule.time && !/^\d{2}:\d{2}$/.test(schedule.time)) {
        return NextResponse.json({
          success: false,
          error: 'Schedule time must be in HH:MM format'
        }, { status: 400 });
      }
    }
    
    const settings: BackupSettings = {
      autoBackup: autoBackup !== undefined ? autoBackup : currentSettings.autoBackup,
      maxBackups: maxBackups !== undefined ? maxBackups : currentSettings.maxBackups,
      schedule: {
        ...currentSettings.schedule,
        ...schedule
      }
    };
    
    await saveSettings(settings);
    
    // Update the scheduler with new settings
    try {
      const scheduler = BackupScheduler.getInstance();
      await scheduler.saveSettings(settings);
    } catch (error) {
      console.error('Failed to update scheduler settings:', error);
      // Don't fail the whole request if scheduler update fails
    }
    
    // Clean up old backups if necessary
    await cleanupOldBackups(settings.maxBackups);
    
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