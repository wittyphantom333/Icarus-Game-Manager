import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const BACKUP_DIR = 'C:\\IcarusBackups';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const backupId = url.searchParams.get('id');
    
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
      // Check if file exists
      const stats = await fs.stat(backupPath);
      
      // Read the file
      const fileBuffer = await fs.readFile(backupPath);
      
      // Create a readable stream response
      const response = new NextResponse(fileBuffer);
      
      // Set headers for file download
      response.headers.set('Content-Type', 'application/zip');
      response.headers.set('Content-Length', stats.size.toString());
      response.headers.set('Content-Disposition', `attachment; filename="${backupFileName}"`);
      response.headers.set('Cache-Control', 'no-cache');
      
      return response;
      
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: 'Backup file not found'
      }, { status: 404 });
    }
    
  } catch (error) {
    console.error('Failed to download backup:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to download backup'
    }, { status: 500 });
  }
}