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
  try {
    // Fetch mod info from the repository
    const response = await fetch(MODINFO_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch mod info: ${response.statusText}`);
    }

    const modInfoData = await response.json();
    
    // Extract the mods array from the JSON structure
    const modsArray = modInfoData.mods || [];
    console.log('[Browse API] Found', modsArray.length, 'mods available');
    
    // Check which mods are already installed
    const serverPath = 'C:\\icarusserver';
    const modsPath = path.join(serverPath, 'Icarus', 'Content', 'Paks', 'Mods');
    
    let installedMods: Array<{name: string, file: string}> = [];
    try {
      if (fs.existsSync(modsPath)) {
        const allFiles = fs.readdirSync(modsPath);
        const modFiles = allFiles.filter(file => 
          file.endsWith('.pak') || file.endsWith('.EXMODZ')
        );
        
        for (const file of modFiles) {
          const cleanName = file.replace(/\.(pak|EXMODZ)$/, '').replace('_disabled_', '');
          
          // Try to read metadata to get original name
          const metadataFile = `${cleanName}.meta.json`;
          const metadataPath = path.join(modsPath, metadataFile);
          
          let originalName = cleanName;
          if (fs.existsSync(metadataPath)) {
            try {
              const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
              originalName = metadata.name || cleanName;
            } catch (error) {
              console.warn(`Failed to read metadata for ${file}:`, error);
            }
          }
          
          installedMods.push({ name: originalName, file: cleanName });
        }
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
      installed: installedMods.some(installedMod => 
        installedMod.name.toLowerCase() === mod.name?.toLowerCase() ||
        installedMod.file.toLowerCase().includes(mod.name?.toLowerCase() || '')
      )
    }));

    return NextResponse.json(processedMods);
  } catch (error) {
    console.error('[Browse API] Error fetching available mods:', error);
    return NextResponse.json(
      { error: 'Failed to fetch available mods', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}