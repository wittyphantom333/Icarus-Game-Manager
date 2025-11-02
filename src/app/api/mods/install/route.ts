import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const ICARUS_SERVER_PATH = 'C:\\icarusserver';
const MODS_PATH = path.join(ICARUS_SERVER_PATH, 'Icarus', 'Content', 'Paks', 'Mods');

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('mod') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Ensure mods directory exists
    if (!fs.existsSync(MODS_PATH)) {
      fs.mkdirSync(MODS_PATH, { recursive: true });
    }

    const fileName = file.name;
    const filePath = path.join(MODS_PATH, fileName);

    // Convert file to buffer and write to disk
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    fs.writeFileSync(filePath, buffer);

    return NextResponse.json({ 
      success: true, 
      message: 'Mod installed successfully',
      fileName 
    });
  } catch (error) {
    console.error('Failed to install mod:', error);
    return NextResponse.json({ error: 'Failed to install mod' }, { status: 500 });
  }
}