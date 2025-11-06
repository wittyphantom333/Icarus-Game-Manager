import { NextResponse } from 'next/server';

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
    exmodz?: string;
    download_url?: string;
  };
  source: 'github';
}

// Function to fetch mods from GitHub (Jimk's repository)
async function fetchGitHubMods(): Promise<any[]> {
  try {
    const response = await fetch(MODINFO_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch GitHub mod info: ${response.statusText}`);
    }

    const modInfoData = await response.json();
    const modsArray = modInfoData.mods || [];

    // Transform to include source information and fix missing images
    return modsArray.map((mod: any) => {
      let imageURL = mod.imageURL;
      
      // If no image URL or it's empty/invalid, use default mod image
      if (!imageURL || imageURL.trim() === '' || imageURL === 'null' || imageURL === 'undefined') {
        imageURL = '/default-mod-image.svg';
      }
      
      // If we have an imageURL but it might be broken, we'll let the frontend handle fallback
      
      return {
        ...mod,
        imageURL,
        source: 'github'
      };
    });

  } catch (error) {
    console.error('[Browse API] Error fetching GitHub mods:', error);
    return [];
  }
}

// Removed Nexus Mods integration - simplified to GitHub only

export async function GET(request: Request) {
  try {
    console.log('[Browse API] Fetching GitHub mods...');
    
    // Fetch GitHub mods only
    const githubMods = await fetchGitHubMods();
    
    console.log(`[Browse API] GitHub: ${githubMods.length} mods loaded`);
    
    return NextResponse.json({
      success: true,
      sources: {
        github: githubMods.length
      },
      mods: githubMods
    });

  } catch (error) {
    console.error('[Browse API] Unexpected error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch mods',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}