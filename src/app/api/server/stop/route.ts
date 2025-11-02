import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST() {
  try {
    console.log('Attempting to stop IcarusServer-Win64-Shipping.exe...');
    
    // First check if the process is running and get PIDs
    let runningPids: string[] = [];
    try {
      const { stdout: checkOutput } = await execAsync('tasklist /FI "IMAGENAME eq IcarusServer-Win64-Shipping.exe" /FO CSV');
      console.log('Process check output:', checkOutput);
      
      // Parse CSV output to get PIDs
      const lines = checkOutput.split('\n');
      lines.forEach(line => {
        if (line.includes('IcarusServer-Win64-Shipping.exe') && line.includes(',')) {
          const parts = line.split(',');
          if (parts.length >= 2) {
            const pid = parts[1].replace(/"/g, '').trim();
            runningPids.push(pid);
          }
        }
      });
      
      if (runningPids.length === 0) {
        return NextResponse.json({ 
          success: true, 
          message: 'Server is not running' 
        });
      }
      
      console.log('Found running processes with PIDs:', runningPids);
    } catch (checkError) {
      console.error('Error checking process:', checkError);
      return NextResponse.json({ 
        success: true, 
        message: 'No server processes found' 
      });
    }

    // Kill all IcarusServer-Win64-Shipping.exe processes
    try {
      // Try graceful termination first
      console.log('Attempting graceful termination...');
      await execAsync('taskkill /IM "IcarusServer-Win64-Shipping.exe"');
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (gracefulError) {
      console.log('Graceful termination failed, trying force kill');
    }

    // Force kill any remaining processes
    try {
      const { stdout, stderr } = await execAsync('taskkill /F /IM "IcarusServer-Win64-Shipping.exe"');
      console.log('Force kill output:', stdout);
      if (stderr) console.log('Force kill stderr:', stderr);
    } catch (forceError) {
      console.log('Force kill completed (processes may have already been terminated)');
    }
    
    // Wait and verify all processes are stopped
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    try {
      const { stdout: verifyOutput } = await execAsync('tasklist /FI "IMAGENAME eq IcarusServer-Win64-Shipping.exe" /FO CSV');
      
      // Check if any processes are still running
      const stillRunning = verifyOutput.split('\n').some(line => 
        line.includes('IcarusServer-Win64-Shipping.exe') && line.includes(',')
      );
      
      if (stillRunning) {
        console.log('Some processes still running after kill attempts');
        return NextResponse.json({ 
          success: false, 
          error: 'Some server processes could not be terminated' 
        }, { status: 500 });
      }
    } catch (verifyError) {
      // Error is expected if no processes exist
      console.log('Process verification completed (no processes found - good)');
    }
    
    console.log('All IcarusServer processes terminated successfully');
    return NextResponse.json({ 
      success: true, 
      message: 'Server stopped successfully' 
    });
  } catch (error) {
    console.error('Failed to stop server:', error);
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Check if the error is because process was not found
    if (errorMessage && (errorMessage.includes('not found') || errorMessage.includes('not running'))) {
      return NextResponse.json({ 
        success: true, 
        message: 'Server was not running' 
      });
    }
    
    return NextResponse.json({ 
      success: false, 
      error: `Failed to stop server: ${errorMessage}` 
    }, { status: 500 });
  }
}