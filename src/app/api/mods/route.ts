import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const ICARUS_SERVER_PATH = 'C:\\icarusserver';
const MODS_PATH = path.join(ICARUS_SERVER_PATH, 'Icarus', 'Content', 'Paks', 'Mods');

interface Mod {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  description: string;
  author?: string;
}

export async function GET() {
  try {
    // Ensure mods directory exists
    if (!fs.existsSync(MODS_PATH)) {
      fs.mkdirSync(MODS_PATH, { recursive: true });
    }

    const allFiles = fs.readdirSync(MODS_PATH);
    const modFiles = allFiles.filter(file => 
      file.endsWith('.pak') || file.endsWith('.EXMODZ')
    );
    
    const mods: Mod[] = modFiles.map(file => {
      const enabled = !file.startsWith('_disabled_');
      const cleanName = file.replace(/\.(pak|EXMODZ)$/, '').replace('_disabled_', '');
      
      // Try to read metadata file if it exists
      const metadataFile = `${cleanName}.meta.json`;
      const metadataPath = path.join(MODS_PATH, metadataFile);
      
      let metadata = null;
      if (fs.existsSync(metadataPath)) {
        try {
          metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        } catch (error) {
          console.warn(`Failed to read metadata for ${file}:`, error);
        }
      }
      
      return {
        id: file,
        name: metadata?.name || cleanName,
        version: metadata?.version || '1.0.0',
        enabled,
        description: metadata?.description || `Mod file: ${file}`,
        author: metadata?.author
      };
    });

    return NextResponse.json({ mods });
  } catch (error) {
    console.error('Failed to load mods:', error);
    return NextResponse.json({ error: 'Failed to load mods' }, { status: 500 });
  }
}