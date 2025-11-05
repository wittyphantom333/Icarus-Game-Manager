import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const ICARUS_SERVER_PATH = 'C:\\icarusserver';
const MODS_PATH = path.join(ICARUS_SERVER_PATH, 'Icarus', 'Content', 'Paks', 'Mods');

export async function OPTIONS() {
  const response = new NextResponse(null, { status: 200 });
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return response;
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { modId: string } }
) {
  try {
    // URL decode the modId in case it contains spaces or special characters
    const modId = decodeURIComponent(params.modId);
    console.log(`Attempting to uninstall mod: "${modId}"`);
    
    const modPath = path.join(MODS_PATH, modId);
    
    // Check if mod file exists (could be enabled or disabled)
    let actualModPath = modPath;
    console.log(`Checking for mod at: "${modPath}"`);
    
    if (!fs.existsSync(modPath)) {
      // Check if it exists as disabled
      const disabledName = modId.startsWith('_disabled_') ? modId : `_disabled_${modId}`;
      const disabledPath = path.join(MODS_PATH, disabledName);
      console.log(`Mod not found at primary path, checking disabled path: "${disabledPath}"`);
      
      if (fs.existsSync(disabledPath)) {
        actualModPath = disabledPath;
        console.log(`Found disabled mod at: "${actualModPath}"`);
      } else {
        console.log(`Mod not found at either path. Available files in directory:`);
        try {
          const files = fs.readdirSync(MODS_PATH);
          console.log(files);
        } catch (dirError) {
          console.log(`Cannot read directory: ${dirError}`);
        }
        return NextResponse.json({ 
          error: `Mod not found: "${modId}"`,
          searchedPaths: [modPath, disabledPath]
        }, { status: 404 });
      }
    } else {
      console.log(`Found mod at primary path: "${actualModPath}"`);
    }

    // Get the clean name for metadata file
    const cleanName = modId.replace(/\.(pak|EXMODZ)$/, '').replace('_disabled_', '');
    const metadataPath = path.join(MODS_PATH, `${cleanName}.meta.json`);

    // Delete the mod file
    try {
      fs.unlinkSync(actualModPath);
      console.log(`Successfully deleted mod file: ${actualModPath}`);
    } catch (deleteError: any) {
      console.error(`Failed to delete mod file: ${actualModPath}`, deleteError);
      
      // Check if it's a file lock error (EBUSY)
      if (deleteError.code === 'EBUSY') {
        return NextResponse.json({
          error: 'Cannot uninstall mod while server is running',
          details: 'The mod file is currently locked by the Icarus server. Please stop the server first, then try uninstalling the mod.',
          code: 'SERVER_RUNNING'
        }, { status: 423 }); // 423 Locked
      }
      
      throw new Error(`Failed to delete mod file: ${deleteError instanceof Error ? deleteError.message : 'Unknown error'}`);
    }

    // Delete metadata file if it exists
    if (fs.existsSync(metadataPath)) {
      try {
        fs.unlinkSync(metadataPath);
        console.log(`Successfully deleted metadata file: ${metadataPath}`);
      } catch (metaError) {
        console.error(`Failed to delete metadata file: ${metadataPath}`, metaError);
        // Don't throw here, metadata deletion is not critical
      }
    }

    const response = NextResponse.json({ 
      success: true, 
      message: `Mod ${cleanName} has been uninstalled successfully` 
    });

    // Add CORS headers
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');

    return response;

  } catch (error) {
    console.error('Failed to uninstall mod:', error);
    return NextResponse.json(
      { error: 'Failed to uninstall mod', details: error instanceof Error ? error.message : 'Unknown error' }, 
      { status: 500 }
    );
  }
}