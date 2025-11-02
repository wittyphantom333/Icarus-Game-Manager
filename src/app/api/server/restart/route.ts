import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);
const ICARUS_SERVER_PATH = 'C:\\icarusserver';
const SERVER_EXE = 'IcarusServer.exe';

export async function POST() {
  try {
    console.log('Restarting Icarus server...');
    
    // First stop the server using the same logic as stop endpoint
    console.log('Stopping existing processes...');
    try {
      // Force kill all processes
      await execAsync('taskkill /F /IM "IcarusServer-Win64-Shipping.exe"');
      console.log('Stop command executed');
    } catch (stopError) {
      console.log('No processes to stop, continuing with start');
    }

    // Wait for cleanup
    console.log('Waiting for cleanup...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Verify all processes are stopped
    try {
      const { stdout: checkOutput } = await execAsync('tasklist /FI "IMAGENAME eq IcarusServer-Win64-Shipping.exe" /FO CSV');
      if (checkOutput.includes('IcarusServer-Win64-Shipping.exe') && checkOutput.includes(',')) {
        console.log('Warning: Some processes may still be running');
        // Continue anyway, the start process might handle duplicates
      }
    } catch (checkError) {
      console.log('Process check completed');
    }

    // Start the server using the same logic as start endpoint
    console.log('Starting server...');
    const serverExePath = path.join(ICARUS_SERVER_PATH, SERVER_EXE);
    
    // Check if executable exists
    if (!require('fs').existsSync(serverExePath)) {
      return NextResponse.json({ 
        success: false, 
        error: `IcarusServer.exe not found at ${serverExePath}` 
      }, { status: 404 });
    }
    
    // Start the server using PowerShell
    const startCommand = `Start-Process -FilePath "${serverExePath}" -WorkingDirectory "${ICARUS_SERVER_PATH}" -WindowStyle Hidden`;
    
    console.log('Executing start command:', startCommand);
    await execAsync(startCommand, { shell: 'powershell.exe' });
    
    // Wait for the process to start
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Verify the server started
    try {
      const { stdout: verifyOutput } = await execAsync('tasklist /FI "IMAGENAME eq IcarusServer-Win64-Shipping.exe" /FO CSV');
      if (verifyOutput.includes('IcarusServer-Win64-Shipping.exe') && verifyOutput.includes(',')) {
        console.log('Server restarted successfully');
        return NextResponse.json({ 
          success: true, 
          message: 'Server restarted successfully' 
        });
      } else {
        console.log('Server restart could not be verified');
        return NextResponse.json({ 
          success: false, 
          error: 'Server restart could not be verified' 
        }, { status: 500 });
      }
    } catch (verifyError) {
      console.error('Error verifying server restart:', verifyError);
      return NextResponse.json({ 
        success: false, 
        error: 'Could not verify server restarted' 
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Failed to restart server:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ 
      success: false, 
      error: `Failed to restart server: ${errorMessage}` 
    }, { status: 500 });
  }
}