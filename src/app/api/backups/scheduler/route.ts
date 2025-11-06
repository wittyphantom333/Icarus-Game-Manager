import { NextRequest, NextResponse } from 'next/server';
import BackupScheduler from '@/lib/services/backup-scheduler';

let schedulerInstance: BackupScheduler | null = null;

export async function POST() {
  try {
    if (!schedulerInstance) {
      schedulerInstance = BackupScheduler.getInstance();
      await schedulerInstance.initialize();
    }
    
    return NextResponse.json({
      success: true,
      message: 'Backup scheduler initialized successfully'
    });
  } catch (error) {
    console.error('Failed to initialize backup scheduler:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to initialize scheduler'
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    if (!schedulerInstance) {
      schedulerInstance = BackupScheduler.getInstance();
      await schedulerInstance.initialize();
    }
    
    const settings = schedulerInstance.getSettings();
    
    return NextResponse.json({
      success: true,
      settings,
      message: 'Scheduler status retrieved'
    });
  } catch (error) {
    console.error('Failed to get scheduler status:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get scheduler status'
    }, { status: 500 });
  }
}