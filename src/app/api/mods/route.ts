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
}

export async function GET() {
  try {
    // Ensure mods directory exists
    if (!fs.existsSync(MODS_PATH)) {
      fs.mkdirSync(MODS_PATH, { recursive: true });
    }

    const modFiles = fs.readdirSync(MODS_PATH);
    const mods: Mod[] = modFiles
      .filter(file => file.endsWith('.pak'))
      .map(file => {
        const filePath = path.join(MODS_PATH, file);
        const stats = fs.statSync(filePath);
        const enabled = !file.startsWith('_disabled_');
        
        return {
          id: file,
          name: file.replace('.pak', '').replace('_disabled_', ''),
          version: '1.0.0', // Default version, could be extracted from mod metadata
          enabled,
          description: `Mod file: ${file}`
        };
      });

    return NextResponse.json({ mods });
  } catch (error) {
    console.error('Failed to load mods:', error);
    return NextResponse.json({ error: 'Failed to load mods' }, { status: 500 });
  }
}