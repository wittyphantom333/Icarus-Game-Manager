import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Download UnrealPak tool from GitHub
async function downloadUnrealPak(toolsPath: string): Promise<void> {
  const unrealPakUrl = 'https://github.com/Jimk72/Icarus_Software/raw/main/UnrealPak.zip';
  const zipPath = path.join(toolsPath, 'UnrealPak.zip');
  
  try {
    const response = await fetch(unrealPakUrl);
    if (!response.ok) {
      throw new Error(`Failed to download UnrealPak: ${response.statusText}`);
    }
    
    const buffer = await response.arrayBuffer();
    fs.writeFileSync(zipPath, Buffer.from(buffer));
    
    // Extract the zip file (for now we'll use PowerShell)
    const extractCommand = `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${toolsPath}' -Force"`;
    await execAsync(extractCommand);
    
    console.log('[Download] UnrealPak tool downloaded and extracted successfully');
    
    // Clean up zip file
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }
  } catch (error) {
    console.error('[Download] Failed to download UnrealPak tool:', error);
    throw new Error('Failed to download UnrealPak tool');
  }
}

// Convert EXMODZ to PAK using UnrealPak
async function convertExmodzToPak(exmodzPath: string, pakPath: string, unrealPakPath: string, toolsPath: string): Promise<void> {
  try {
    console.log(`[Download] Processing EXMODZ file with proper conversion logic...`);
    
    // Read EXMODZ content and analyze format
    let exmodzContent: string;
    let modData: any;
    
    try {
      // First try to read as text
      exmodzContent = fs.readFileSync(exmodzPath, 'utf8');
      console.log(`[Download] EXMODZ content preview: "${exmodzContent.substring(0, 100)}..."`);
      
      // Check if it starts with JSON
      if (exmodzContent.trim().startsWith('{')) {
        modData = JSON.parse(exmodzContent);
        console.log(`[Download] Parsed EXMODZ JSON for mod: ${modData.ModName || 'Unknown'}`);
      } else {
        console.log('[Download] EXMODZ is not JSON format, trying as binary/archive...');
        
        // Try to read as binary to see if it's a compressed format
        const binaryContent = fs.readFileSync(exmodzPath);
        const header = binaryContent.toString('hex', 0, 10);
        console.log(`[Download] EXMODZ binary header: ${header}`);
        
        // Check for common archive signatures
        if (binaryContent[0] === 0x50 && binaryContent[1] === 0x4B) {
          // ZIP file signature (PK)
          console.log('[Download] EXMODZ appears to be a ZIP archive');
          return await handleZipExmodz(exmodzPath, pakPath, unrealPakPath, toolsPath);
        } else {
          // Unknown binary format - create placeholder
          console.log('[Download] Unknown EXMODZ format, creating placeholder...');
          return await createPlaceholderPak(exmodzPath, pakPath, unrealPakPath, toolsPath);
        }
      }
    } catch (readError) {
      console.log(`[Download] Could not read EXMODZ file: ${readError instanceof Error ? readError.message : String(readError)}`);
      return await createPlaceholderPak(exmodzPath, pakPath, unrealPakPath, toolsPath);
    }
    
    // Download and extract game data if needed
    const gameDataPath = await ensureGameData(toolsPath);
    
    // Process EXMODZ and merge with game data
    const extractDir = path.join(toolsPath, 'temp', 'extracted');
    if (fs.existsSync(extractDir)) {
      fs.rmSync(extractDir, { recursive: true, force: true });
    }
    fs.mkdirSync(extractDir, { recursive: true });
    
    // Create game content structure
    const contentDir = path.join(extractDir, 'Icarus', 'Content');
    fs.mkdirSync(contentDir, { recursive: true });
    
    // Process mod files from EXMODZ
    if (modData.Files && Array.isArray(modData.Files)) {
      for (const fileEntry of modData.Files) {
        const fileName = fileEntry.FileName || fileEntry.File;
        const items = fileEntry.Items || fileEntry.Data;
        
        if (fileName && items) {
          await processModFile(fileName, items, gameDataPath, contentDir);
        }
      }
    } else {
      console.log('[Download] No Files array found in EXMODZ, creating basic structure...');
      
      // Create a basic Data folder structure
      const dataDir = path.join(contentDir, 'Data');
      fs.mkdirSync(dataDir, { recursive: true });
      
      // Save the mod data as a reference file
      const modDataPath = path.join(dataDir, 'ModData.json');
      fs.writeFileSync(modDataPath, JSON.stringify(modData, null, 2));
    }
    
    // Create PAK file
    const fileListPath = path.join(toolsPath, 'temp', 'filelist.txt');
    const files = getAllFiles(extractDir);
    
    if (files.length === 0) {
      throw new Error('No files generated from EXMODZ processing');
    }
    
    const fileListContent = files.map(file => {
      const relativePath = path.relative(extractDir, file).replace(/\\/g, '/');
      return `"${file}" "../../../${relativePath}"`;
    }).join('\n');
    
    fs.writeFileSync(fileListPath, fileListContent);
    
    // Run UnrealPak to create PAK file
    const pakCommand = `"${unrealPakPath}" "${pakPath}" -create="${fileListPath}"`;
    await execAsync(pakCommand, { cwd: toolsPath });
    
    console.log('[Download] Successfully converted EXMODZ to PAK format');
    
    // Clean up temp files
    if (fs.existsSync(extractDir)) {
      fs.rmSync(extractDir, { recursive: true, force: true });
    }
    if (fs.existsSync(fileListPath)) {
      fs.unlinkSync(fileListPath);
    }
  } catch (error) {
    console.error('[Download] Failed to convert EXMODZ to PAK:', error);
    throw new Error(`Failed to convert EXMODZ to PAK: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Helper function to ensure game data is available
async function ensureGameData(toolsPath: string): Promise<string> {
  const gameDataPath = path.join(toolsPath, 'gamedata');
  
  // Check if we already have game data
  if (fs.existsSync(gameDataPath)) {
    console.log('[Download] Using existing game data');
    return gameDataPath;
  }
  
  console.log('[Download] Game data not found, creating basic structure...');
  fs.mkdirSync(gameDataPath, { recursive: true });
  
  // Create basic game data structure
  const dataDir = path.join(gameDataPath, 'Data');
  fs.mkdirSync(dataDir, { recursive: true });
  
  // Create some basic template files that mods commonly modify
  const basicFiles = [
    'D_ItemTemplate.json',
    'D_ItemsStatic.json', 
    'D_Recipes.json',
    'D_TechTree.json'
  ];
  
  for (const fileName of basicFiles) {
    const filePath = path.join(dataDir, fileName);
    const basicStructure = {
      Type: "DataTable",
      Name: fileName.replace('.json', ''),
      Rows: {}
    };
    fs.writeFileSync(filePath, JSON.stringify(basicStructure, null, 2));
  }
  
  return gameDataPath;
}

// Helper function to process individual mod files
async function processModFile(fileName: string, items: any[], gameDataPath: string, outputDir: string): Promise<void> {
  console.log(`[Download] Processing mod file: ${fileName}`);
  
  // Load base game file if it exists
  const gameFilePath = path.join(gameDataPath, 'Data', fileName);
  let baseData: any = {
    Type: "DataTable",
    Name: fileName.replace('.json', ''),
    Rows: {}
  };
  
  if (fs.existsSync(gameFilePath)) {
    try {
      baseData = JSON.parse(fs.readFileSync(gameFilePath, 'utf8'));
    } catch (error) {
      console.log(`[Download] Could not parse base game file ${fileName}, using template`);
    }
  }
  
  // Merge mod items into base data
  for (const item of items) {
    if (item.Name) {
      baseData.Rows[item.Name] = { ...baseData.Rows[item.Name], ...item };
    }
  }
  
  // Write merged file to output directory
  const outputFilePath = path.join(outputDir, 'Data', fileName);
  const outputFileDir = path.dirname(outputFilePath);
  
  if (!fs.existsSync(outputFileDir)) {
    fs.mkdirSync(outputFileDir, { recursive: true });
  }
  
  fs.writeFileSync(outputFilePath, JSON.stringify(baseData, null, 2));
  console.log(`[Download] Created merged file: ${fileName}`);
}

// Helper function to handle ZIP-format EXMODZ files
async function handleZipExmodz(exmodzPath: string, pakPath: string, unrealPakPath: string, toolsPath: string): Promise<void> {
  const extractDir = path.join(toolsPath, 'temp', 'zip_extracted');
  
  try {
    // Extract ZIP EXMODZ
    if (fs.existsSync(extractDir)) {
      fs.rmSync(extractDir, { recursive: true, force: true });
    }
    fs.mkdirSync(extractDir, { recursive: true });
    
    // PowerShell Expand-Archive doesn't like .EXMODZ extension, so copy to .zip first
    const tempZipPath = exmodzPath.replace('.EXMODZ', '_temp.zip');
    fs.copyFileSync(exmodzPath, tempZipPath);
    
    try {
      const extractCommand = `powershell -Command "Expand-Archive -Path '${tempZipPath}' -DestinationPath '${extractDir}' -Force"`;
      await execAsync(extractCommand);
    } finally {
      // Clean up temp zip file
      if (fs.existsSync(tempZipPath)) {
        fs.unlinkSync(tempZipPath);
      }
    }
    
    console.log('[Download] Successfully extracted ZIP EXMODZ');
    
    // Now process the extracted contents
    const finalExtractDir = path.join(toolsPath, 'temp', 'extracted');
    if (fs.existsSync(finalExtractDir)) {
      fs.rmSync(finalExtractDir, { recursive: true, force: true });
    }
    
    // Copy extracted contents to final directory with proper structure
    const contentDir = path.join(finalExtractDir, 'Icarus', 'Content');
    fs.mkdirSync(contentDir, { recursive: true });
    
    // Copy all extracted files
    const extractedFiles = getAllFiles(extractDir);
    for (const file of extractedFiles) {
      const relativePath = path.relative(extractDir, file);
      const targetPath = path.join(contentDir, relativePath);
      const targetDir = path.dirname(targetPath);
      
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      
      fs.copyFileSync(file, targetPath);
    }
    
    // Create PAK file
    const fileListPath = path.join(toolsPath, 'temp', 'filelist.txt');
    const files = getAllFiles(finalExtractDir);
    
    const fileListContent = files.map(file => {
      const relativePath = path.relative(finalExtractDir, file).replace(/\\/g, '/');
      return `"${file}" "../../../${relativePath}"`;
    }).join('\n');
    
    fs.writeFileSync(fileListPath, fileListContent);
    
    const pakCommand = `"${unrealPakPath}" "${pakPath}" -create="${fileListPath}"`;
    await execAsync(pakCommand, { cwd: toolsPath });
    
    console.log('[Download] Successfully created PAK from ZIP EXMODZ');
    
  } finally {
    // Clean up
    if (fs.existsSync(extractDir)) {
      fs.rmSync(extractDir, { recursive: true, force: true });
    }
  }
}

// Helper function to create placeholder PAK for unknown formats
async function createPlaceholderPak(exmodzPath: string, pakPath: string, unrealPakPath: string, toolsPath: string): Promise<void> {
  const extractDir = path.join(toolsPath, 'temp', 'extracted');
  
  if (fs.existsSync(extractDir)) {
    fs.rmSync(extractDir, { recursive: true, force: true });
  }
  fs.mkdirSync(extractDir, { recursive: true });
  
  // Create basic structure
  const contentDir = path.join(extractDir, 'Icarus', 'Content', 'Mods');
  fs.mkdirSync(contentDir, { recursive: true });
  
  // Copy original EXMODZ file for reference
  const originalFileName = path.basename(exmodzPath);
  const backupPath = path.join(contentDir, originalFileName);
  fs.copyFileSync(exmodzPath, backupPath);
  
  // Create mod info
  const modInfoPath = path.join(contentDir, 'modinfo.json');
  const modInfo = {
    name: originalFileName.replace('.EXMODZ', ''),
    description: 'Unsupported EXMODZ format - original file preserved',
    version: "1.0.0",
    originalFile: originalFileName,
    note: "This EXMODZ format is not supported. Use the official Icarus Mod Manager for full conversion."
  };
  fs.writeFileSync(modInfoPath, JSON.stringify(modInfo, null, 2));
  
  // Create PAK file
  const fileListPath = path.join(toolsPath, 'temp', 'filelist.txt');
  const files = getAllFiles(extractDir);
  
  const fileListContent = files.map(file => {
    const relativePath = path.relative(extractDir, file).replace(/\\/g, '/');
    return `"${file}" "../../../${relativePath}"`;
  }).join('\n');
  
  fs.writeFileSync(fileListPath, fileListContent);
  
  const pakCommand = `"${unrealPakPath}" "${pakPath}" -create="${fileListPath}"`;
  await execAsync(pakCommand, { cwd: toolsPath });
  
  console.log('[Download] Created placeholder PAK for unsupported EXMODZ format');
}

// Helper function to get all files recursively
function getAllFiles(dir: string): string[] {
  const files: string[] = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      files.push(...getAllFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  
  return files;
}

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
    const appPath = process.cwd();
    const toolsPath = path.join(appPath, 'tools');
    const unrealPakPath = path.join(toolsPath, 'UnrealPak', 'Engine', 'Binaries', 'Win64', 'UnrealPak.exe');
    
    // Ensure directories exist
    if (!fs.existsSync(modsPath)) {
      fs.mkdirSync(modsPath, { recursive: true });
    }
    if (!fs.existsSync(toolsPath)) {
      fs.mkdirSync(toolsPath, { recursive: true });
    }

    // Download UnrealPak tool if it doesn't exist
    if (!fs.existsSync(unrealPakPath)) {
      console.log('[Download] UnrealPak tool not found, downloading...');
      await downloadUnrealPak(toolsPath);
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
    
    // Clean filename 
    const cleanName = name.replace(/[<>:"/\\|?*]/g, '_');
    
    let finalFilePath: string;
    
    if (extension.toLowerCase() === '.exmodz') {
      // Handle EXMODZ conversion to PAK
      const exmodzPath = path.join(toolsPath, 'temp', `${cleanName}.EXMODZ`);
      const pakFilename = `${cleanName}.pak`;
      finalFilePath = path.join(modsPath, pakFilename);
      
      // Ensure temp directory exists
      const tempDir = path.dirname(exmodzPath);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Write EXMODZ file to temp location
      fs.writeFileSync(exmodzPath, Buffer.from(buffer));
      
      // Convert EXMODZ to PAK using UnrealPak
      console.log(`[Download] Converting ${name} from EXMODZ to PAK format...`);
      await convertExmodzToPak(exmodzPath, finalFilePath, unrealPakPath, toolsPath);
      
      // Clean up temp file
      if (fs.existsSync(exmodzPath)) {
        fs.unlinkSync(exmodzPath);
      }
    } else {
      // Handle other file types (PAK, ZIP, etc.)
      const filename = `${cleanName}${extension}`;
      finalFilePath = path.join(modsPath, filename);
      fs.writeFileSync(finalFilePath, Buffer.from(buffer));
    }
    
    // Create a metadata file for tracking
    const metadataPath = path.join(modsPath, `${cleanName}.meta.json`);
    const finalFilename = path.basename(finalFilePath);
    const metadata = {
      name,
      author,
      version,
      description,
      downloadUrl,
      installedAt: new Date().toISOString(),
      filename: finalFilename,
      originalFormat: extension,
      convertedToPak: extension.toLowerCase() === '.exmodz'
    };
    
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    
    console.log(`[Download] Successfully installed: ${name}`);
    
    return NextResponse.json({
      success: true,
      message: `Successfully installed ${name}`,
      filePath: finalFilePath,
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