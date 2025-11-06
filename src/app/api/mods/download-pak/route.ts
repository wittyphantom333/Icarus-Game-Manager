import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const ICARUS_SERVER_PATH = 'C:\\icarusserver';
const MODS_PATH = path.join(ICARUS_SERVER_PATH, 'Icarus', 'Content', 'Paks', 'Mods');

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const modId = searchParams.get('id');
    
    if (!modId) {
      return NextResponse.json({ error: 'Mod ID is required' }, { status: 400 });
    }

    // Decode the mod ID since it comes from the URL
    const decodedModId = decodeURIComponent(modId);
    const filePath = path.join(MODS_PATH, decodedModId);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Mod file not found' }, { status: 404 });
    }

    // Read the file
    const fileBuffer = fs.readFileSync(filePath);
    const stats = fs.statSync(filePath);
    
    // Determine the content type based on file extension
    const ext = path.extname(decodedModId).toLowerCase();
    let contentType = 'application/octet-stream';
    
    if (ext === '.pak') {
      contentType = 'application/octet-stream';
    } else if (ext === '.exmodz') {
      contentType = 'application/zip';
    }
    
    // Set appropriate headers for file download
    const headers = new Headers();
    headers.set('Content-Type', contentType);
    headers.set('Content-Disposition', `attachment; filename="${decodedModId}"`);
    headers.set('Content-Length', stats.size.toString());
    headers.set('Cache-Control', 'no-cache');
    
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: headers,
    });
    
  } catch (error) {
    console.error('Failed to download mod:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to download mod' 
    }, { status: 500 });
  }
}