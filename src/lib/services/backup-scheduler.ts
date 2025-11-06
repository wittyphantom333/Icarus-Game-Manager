import * as cron from 'node-cron';
import fs from 'fs/promises';
import path from 'path';

export interface BackupSchedule {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  time: string; // HH:MM format
  dayOfWeek?: number; // 0-6 (0 = Sunday) for weekly
  dayOfMonth?: number; // 1-31 for monthly
  lastRun?: string; // ISO string
  nextRun?: string; // ISO string
}

export interface BackupSettings {
  autoBackup: boolean; // Legacy - will be replaced by schedule
  maxBackups: number;
  schedule: BackupSchedule;
}

const SETTINGS_FILE = 'C:\\IcarusBackups\\settings.json';
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

class BackupScheduler {
  private static instance: BackupScheduler;
  private scheduledTask: cron.ScheduledTask | null = null;
  private settings: BackupSettings = DEFAULT_SETTINGS;

  private constructor() {}

  public static getInstance(): BackupScheduler {
    if (!BackupScheduler.instance) {
      BackupScheduler.instance = new BackupScheduler();
    }
    return BackupScheduler.instance;
  }

  public async initialize(): Promise<void> {
    await this.loadSettings();
    await this.scheduleBackup();
  }

  public async loadSettings(): Promise<BackupSettings> {
    try {
      // Ensure backup directory exists
      await fs.mkdir(path.dirname(SETTINGS_FILE), { recursive: true });
      
      const data = await fs.readFile(SETTINGS_FILE, 'utf-8');
      const loadedSettings = JSON.parse(data);
      
      // Merge with defaults to handle new fields
      this.settings = {
        ...DEFAULT_SETTINGS,
        ...loadedSettings,
        schedule: {
          ...DEFAULT_SETTINGS.schedule,
          ...loadedSettings.schedule
        }
      };
      
      return this.settings;
    } catch (error) {
      console.log('No existing settings found, using defaults');
      this.settings = DEFAULT_SETTINGS;
      await this.saveSettings();
      return this.settings;
    }
  }

  public async saveSettings(newSettings?: Partial<BackupSettings>): Promise<void> {
    if (newSettings) {
      this.settings = {
        ...this.settings,
        ...newSettings,
        schedule: {
          ...this.settings.schedule,
          ...newSettings.schedule
        }
      };
    }

    try {
      await fs.mkdir(path.dirname(SETTINGS_FILE), { recursive: true });
      await fs.writeFile(SETTINGS_FILE, JSON.stringify(this.settings, null, 2));
      
      // Reschedule backup with new settings
      await this.scheduleBackup();
    } catch (error) {
      console.error('Failed to save backup settings:', error);
      throw new Error('Failed to save backup settings');
    }
  }

  public getSettings(): BackupSettings {
    return { ...this.settings };
  }

  private async scheduleBackup(): Promise<void> {
    // Clear existing scheduled task
    if (this.scheduledTask) {
      this.scheduledTask.stop();
      this.scheduledTask.destroy();
      this.scheduledTask = null;
    }

    if (!this.settings.schedule.enabled) {
      console.log('Backup scheduling is disabled');
      return;
    }

    const cronExpression = this.getCronExpression();
    console.log(`Scheduling backup with cron expression: ${cronExpression}`);

    try {
      this.scheduledTask = cron.schedule(cronExpression, async () => {
        console.log('Executing scheduled backup...');
        await this.executeScheduledBackup();
      }, {
        timezone: 'America/New_York' // Adjust as needed
      });

      // Update next run time
      await this.updateNextRunTime();
      
      console.log(`Backup scheduled successfully. Next run: ${this.settings.schedule.nextRun}`);
    } catch (error) {
      console.error('Failed to schedule backup:', error);
    }
  }

  private getCronExpression(): string {
    const { frequency, time, dayOfWeek, dayOfMonth } = this.settings.schedule;
    const [hour, minute] = time.split(':').map(Number);

    switch (frequency) {
      case 'daily':
        return `${minute} ${hour} * * *`;
      case 'weekly':
        const dow = dayOfWeek ?? 0; // Default to Sunday
        return `${minute} ${hour} * * ${dow}`;
      case 'monthly':
        const dom = dayOfMonth ?? 1; // Default to 1st of month
        return `${minute} ${hour} ${dom} * *`;
      default:
        return `${minute} ${hour} * * *`; // Default to daily
    }
  }

  private async updateNextRunTime(): Promise<void> {
    if (!this.scheduledTask) return;

    try {
      // Calculate next run time based on cron expression
      const now = new Date();
      const cronExpression = this.getCronExpression();
      
      // Simple calculation - in production you might want to use a proper cron parser
      let nextRun = new Date(now);
      const [minute, hour] = this.settings.schedule.time.split(':').map(Number);
      
      nextRun.setHours(hour, minute, 0, 0);
      
      // If the time has already passed today, move to next occurrence
      if (nextRun <= now) {
        switch (this.settings.schedule.frequency) {
          case 'daily':
            nextRun.setDate(nextRun.getDate() + 1);
            break;
          case 'weekly':
            nextRun.setDate(nextRun.getDate() + 7);
            break;
          case 'monthly':
            nextRun.setMonth(nextRun.getMonth() + 1);
            break;
        }
      }

      this.settings.schedule.nextRun = nextRun.toISOString();
      
      // Save updated settings
      await fs.writeFile(SETTINGS_FILE, JSON.stringify(this.settings, null, 2));
    } catch (error) {
      console.error('Failed to update next run time:', error);
    }
  }

  private async executeScheduledBackup(): Promise<void> {
    try {
      console.log('Starting scheduled backup...');
      
      // Make API call to create backup
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      const response = await fetch(`${baseUrl}/api/backups/scheduled`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'scheduled',
          name: `Scheduled Backup - ${new Date().toLocaleDateString()}`
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log('Scheduled backup completed successfully');
        this.settings.schedule.lastRun = new Date().toISOString();
      } else {
        console.error('Scheduled backup failed:', result.error);
      }
      
      // Update next run time
      await this.updateNextRunTime();
      
    } catch (error) {
      console.error('Error executing scheduled backup:', error);
    }
  }

  public async createManualBackup(): Promise<any> {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      const response = await fetch(`${baseUrl}/api/backups`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'manual',
          name: `Manual Backup - ${new Date().toLocaleDateString()}`
        }),
      });
      
      return await response.json();
    } catch (error) {
      console.error('Error creating manual backup:', error);
      throw error;
    }
  }

  public stop(): void {
    if (this.scheduledTask) {
      this.scheduledTask.stop();
      this.scheduledTask.destroy();
      this.scheduledTask = null;
    }
  }
}

export default BackupScheduler;