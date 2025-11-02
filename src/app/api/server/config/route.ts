import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const CONFIG_FILE_PATH = 'C:\\icarusserver\\Icarus\\Saved\\Config\\WindowsServer\\ServerSettings.ini';

interface ServerConfig {
  SessionName: string;
  JoinPassword: string;
  MaxPlayers: number;
  ShutdownIfNotJoinedFor: number;
  ShutdownIfEmptyFor: number;
  AdminPassword: string;
  LoadProspect: string;
  CreateProspect: string;
  ResumeProspect: boolean;
  LastProspectName: string;
  AllowNonAdminsToLaunchProspects: boolean;
  AllowNonAdminsToDeleteProspects: boolean;
  FiberFoliageRespawn: boolean;
  LargeStonesRespawn: boolean;
  GameSaveFrequency: number;
  SaveGameOnExit: boolean;
}

function parseIniFile(content: string): ServerConfig {
  const lines = content.split('\n');
  const config: Partial<ServerConfig> = {};
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('[') && trimmed.includes('=')) {
      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=').trim();
      
      switch (key) {
        case 'SessionName':
        case 'JoinPassword':
        case 'AdminPassword':
        case 'LoadProspect':
        case 'CreateProspect':
        case 'LastProspectName':
          config[key] = value;
          break;
        case 'MaxPlayers':
          config[key] = parseInt(value) || 8;
          break;
        case 'ShutdownIfNotJoinedFor':
        case 'ShutdownIfEmptyFor':
        case 'GameSaveFrequency':
          config[key] = parseFloat(value) || 0;
          break;
        case 'ResumeProspect':
        case 'AllowNonAdminsToLaunchProspects':
        case 'AllowNonAdminsToDeleteProspects':
        case 'FiberFoliageRespawn':
        case 'LargeStonesRespawn':
        case 'SaveGameOnExit':
          config[key] = value.toLowerCase() === 'true';
          break;
      }
    }
  }
  
  return config as ServerConfig;
}

function generateIniContent(config: ServerConfig): string {
  return `[/Script/Icarus.DedicatedServerSettings]
SessionName=${config.SessionName || 'Icarus Server'}
JoinPassword=${config.JoinPassword || ''}
MaxPlayers=${config.MaxPlayers || 8}
ShutdownIfNotJoinedFor=${config.ShutdownIfNotJoinedFor.toFixed(6)}
ShutdownIfEmptyFor=${config.ShutdownIfEmptyFor.toFixed(6)}
AdminPassword=${config.AdminPassword || ''}
LoadProspect=${config.LoadProspect || ''}
CreateProspect=${config.CreateProspect || ''}
ResumeProspect=${config.ResumeProspect}
LastProspectName=${config.LastProspectName || ''}
AllowNonAdminsToLaunchProspects=${config.AllowNonAdminsToLaunchProspects}
AllowNonAdminsToDeleteProspects=${config.AllowNonAdminsToDeleteProspects}
FiberFoliageRespawn=${config.FiberFoliageRespawn}
LargeStonesRespawn=${config.LargeStonesRespawn}
GameSaveFrequency=${config.GameSaveFrequency.toFixed(6)}
SaveGameOnExit=${config.SaveGameOnExit}


`;
}

export async function GET() {
  try {
    if (!fs.existsSync(CONFIG_FILE_PATH)) {
      return NextResponse.json({ error: 'Configuration file not found' }, { status: 404 });
    }
    
    const content = fs.readFileSync(CONFIG_FILE_PATH, 'utf8');
    const config = parseIniFile(content);
    
    return NextResponse.json({ config });
  } catch (error) {
    console.error('Error reading server config:', error);
    return NextResponse.json({ error: 'Failed to read server configuration' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { config } = await request.json();
    
    if (!config) {
      return NextResponse.json({ error: 'Configuration data is required' }, { status: 400 });
    }
    
    // Create backup of current config
    const backupPath = CONFIG_FILE_PATH + '.backup.' + Date.now();
    if (fs.existsSync(CONFIG_FILE_PATH)) {
      fs.copyFileSync(CONFIG_FILE_PATH, backupPath);
    }
    
    // Generate new INI content
    const iniContent = generateIniContent(config);
    
    // Ensure directory exists
    const configDir = path.dirname(CONFIG_FILE_PATH);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    // Write new configuration
    fs.writeFileSync(CONFIG_FILE_PATH, iniContent, 'utf8');
    
    console.log(`Server configuration updated. Backup saved to: ${backupPath}`);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Server configuration updated successfully',
      backupPath 
    });
  } catch (error) {
    console.error('Error updating server config:', error);
    return NextResponse.json({ error: 'Failed to update server configuration' }, { status: 500 });
  }
}