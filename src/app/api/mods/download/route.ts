import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export async function POST(request: NextRequest) {
  try {
    const { name, downloadUrl, author, version, description } = await request.json();
    
    if (!name || !downloadUrl) {
      return NextResponse.json(
        { error: 'Missing required fields: name and downloadUrl' },
        { status: 400 }
      );
    }

    // Set up paths
    const serverPath = 'C:\\icarusserver';
    const modsPath = path.join(serverPath, 'Icarus', 'Content', 'Paks', 'Mods');
    
    // Ensure mods directory exists
    if (!fs.existsSync(modsPath)) {
      fs.mkdirSync(modsPath, { recursive: true });
    }

    // Download the mod file
    console.log(`[Download] Installing mod: ${name}`);
    const response = await fetch(downloadUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to download mod: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    
    // Determine file extension from URL
    const urlPath = new URL(downloadUrl).pathname;
    const extension = path.extname(urlPath) || '.EXMODZ';
    
    // Clean filename and add extension
    const cleanName = name.replace(/[<>:"/\\|?*]/g, '_');
    const filename = `${cleanName}${extension}`;
    const filePath = path.join(modsPath, filename);
    
    // Write the file
    fs.writeFileSync(filePath, Buffer.from(buffer));
    
    // Create a metadata file for tracking
    const metadataPath = path.join(modsPath, `${cleanName}.meta.json`);
    const metadata = {
      name,
      author,
      version,
      description,
      downloadUrl,
      installedAt: new Date().toISOString(),
      filename
    };
    
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    
    console.log(`[Download] Successfully installed: ${name}`);
    
    return NextResponse.json({
      success: true,
      message: `Successfully installed ${name}`,
      filePath,
      metadata
    });
    
  } catch (error) {
    console.error('Error downloading mod:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to download mod' },
      { status: 500 }
    );
  }
}