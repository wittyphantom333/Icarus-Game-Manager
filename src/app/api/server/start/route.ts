import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

const ICARUS_SERVER_PATH = 'C:\\icarusserver';
const SERVER_EXE = 'IcarusServer.exe';

export async function POST() {
  try {
    console.log('Starting Icarus server...');
    
    // First check if server is already running
    try {
      const { stdout: checkOutput } = await execAsync('tasklist /FI "IMAGENAME eq IcarusServer-Win64-Shipping.exe" /FO CSV');
      if (checkOutput.includes('IcarusServer-Win64-Shipping.exe') && checkOutput.includes(',')) {
        return NextResponse.json({ 
          success: false, 
          error: 'Server is already running' 
        }, { status: 400 });
      }
    } catch (checkError) {
      console.log('Process check completed, proceeding with start');
    }

    const serverExePath = path.join(ICARUS_SERVER_PATH, SERVER_EXE);
    
    // Check if executable exists
    if (!require('fs').existsSync(serverExePath)) {
      return NextResponse.json({ 
        success: false, 
        error: `IcarusServer.exe not found at ${serverExePath}` 
      }, { status: 404 });
    }
    
    // Start the server using PowerShell Start-Process for better process management
    const startCommand = `Start-Process -FilePath "${serverExePath}" -WorkingDirectory "${ICARUS_SERVER_PATH}" -WindowStyle Hidden`;
    
    console.log('Executing start command:', startCommand);
    const { stdout, stderr } = await execAsync(startCommand, { shell: 'powershell.exe' });
    
    if (stderr) {
      console.error('Start command stderr:', stderr);
    }
    
    // Wait a moment for the process to start
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Verify the server started
    try {
      const { stdout: verifyOutput } = await execAsync('tasklist /FI "IMAGENAME eq IcarusServer-Win64-Shipping.exe" /FO CSV');
      if (verifyOutput.includes('IcarusServer-Win64-Shipping.exe') && verifyOutput.includes(',')) {
        console.log('Server started successfully');
        return NextResponse.json({ 
          success: true, 
          message: 'Server started successfully' 
        });
      } else {
        console.log('Server may not have started properly');
        return NextResponse.json({ 
          success: false, 
          error: 'Server start could not be verified' 
        }, { status: 500 });
      }
    } catch (verifyError) {
      console.error('Error verifying server start:', verifyError);
      return NextResponse.json({ 
        success: false, 
        error: 'Could not verify server started' 
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Failed to start server:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ 
      success: false, 
      error: `Failed to start server: ${errorMessage}` 
    }, { status: 500 });
  }
}