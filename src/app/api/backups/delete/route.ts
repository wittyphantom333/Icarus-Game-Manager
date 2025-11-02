import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const BACKUP_DIR = 'C:\\IcarusBackups';

export async function DELETE(request: NextRequest) {
  try {
    const { backupId } = await request.json();
    
    if (!backupId) {
      return NextResponse.json({
        success: false,
        error: 'Backup ID is required'
      }, { status: 400 });
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
    
    // Delete the backup file
    await fs.unlink(backupPath);
    
    console.log(`Deleted backup: ${backupPath}`);
    
    return NextResponse.json({
      success: true,
      message: 'Backup deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete backup failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete backup'
    }, { status: 500 });
  }
}