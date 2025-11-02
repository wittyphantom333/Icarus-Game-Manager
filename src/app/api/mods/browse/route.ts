import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

const MODS_BASE_URL = 'https://raw.githubusercontent.com/Jimk72/Icarus_Mods/main';
const MODINFO_URL = `${MODS_BASE_URL}/modinfo.json`;

interface ModInfo {
  name: string;
  author: string;
  version: string;
  compatibility: string;
  description: string;
  imageURL: string;
  readmeURL: string;
  files: {
    exmodz: string;
  };
}

export async function GET() {
  console.log('[Browse API] Starting request');
  try {
    // Fetch mod info from the repository
    console.log('[Browse API] Fetching from:', MODINFO_URL);
    const response = await fetch(MODINFO_URL);
    console.log('[Browse API] Response status:', response.status);
    if (!response.ok) {
      throw new Error(`Failed to fetch mod info: ${response.statusText}`);
    }

    const modInfoData = await response.json();
    console.log('[Browse API] Received mod data structure:', Object.keys(modInfoData));
    
    // Extract the mods array from the JSON structure
    const modsArray = modInfoData.mods || [];
    console.log('[Browse API] Found', modsArray.length, 'mods in array');
    
    // Check which mods are already installed
    const serverPath = 'C:\\icarusserver';
    const modsPath = path.join(serverPath, 'Icarus', 'Content', 'Paks', 'Mods');
    
    let installedModNames: string[] = [];
    try {
      if (fs.existsSync(modsPath)) {
        const files = fs.readdirSync(modsPath);
        installedModNames = files
          .filter(file => file.endsWith('.pak') || file.endsWith('.EXMODZ'))
          .map(file => path.parse(file).name);
      }
    } catch (error) {
      console.warn('Could not read mods directory:', error);
    }

    // Process mod info and mark installed mods
    const processedMods = modsArray.map((mod: any) => ({
      name: mod.name || 'Unknown Mod',
      author: mod.author || 'Unknown',
      version: mod.version || '1.0.0',
      compatibility: mod.compatibility || 'Unknown',
      description: mod.description || 'No description available',
      imageURL: mod.imageURL || '',
      readmeURL: mod.readmeURL || '',
      files: {
        exmodz: mod.files?.exmodz || '',
        png: mod.imageURL || undefined
      },
      installed: installedModNames.some(installedName => 
        installedName.toLowerCase().includes(mod.name?.toLowerCase() || '')
      )
    }));

    console.log('[Browse API] Processed', processedMods.length, 'mods');
    return NextResponse.json(processedMods);
  } catch (error) {
    console.error('[Browse API] Error fetching available mods:', error);
    return NextResponse.json(
      { error: 'Failed to fetch available mods', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}