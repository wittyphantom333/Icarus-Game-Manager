import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const ICARUS_SERVER_PATH = 'C:\\icarusserver';
const MODS_PATH = path.join(ICARUS_SERVER_PATH, 'Icarus', 'Content', 'Paks', 'Mods');

export async function POST(
  request: NextRequest,
  { params }: { params: { modId: string } }
) {
  try {
    const { enabled } = await request.json();
    const modId = params.modId;
    
    const currentPath = path.join(MODS_PATH, modId);
    
    if (!fs.existsSync(currentPath)) {
      return NextResponse.json({ error: 'Mod not found' }, { status: 404 });
    }

    let newPath: string;
    
    if (enabled) {
      // Enable mod by removing _disabled_ prefix
      newPath = path.join(MODS_PATH, modId.replace('_disabled_', ''));
    } else {
      // Disable mod by adding _disabled_ prefix
      if (!modId.startsWith('_disabled_')) {
        newPath = path.join(MODS_PATH, `_disabled_${modId}`);
      } else {
        newPath = currentPath; // Already disabled
      }
    }

    // Rename the file
    if (currentPath !== newPath) {
      fs.renameSync(currentPath, newPath);
    }

    return NextResponse.json({ 
      success: true, 
      message: `Mod ${enabled ? 'enabled' : 'disabled'} successfully` 
    });
  } catch (error) {
    console.error('Failed to toggle mod:', error);
    return NextResponse.json({ error: 'Failed to toggle mod' }, { status: 500 });
  }
}