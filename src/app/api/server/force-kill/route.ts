import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST() {
  try {
    console.log('Force killing all IcarusServer processes...');
    
    // Get all IcarusServer processes first
    let allProcesses: { pid: string, memUsage: string }[] = [];
    
    try {
      const { stdout: checkOutput } = await execAsync('tasklist /FI "IMAGENAME eq IcarusServer-Win64-Shipping.exe" /FO CSV');
      console.log('Current processes:', checkOutput);
      
      // Parse CSV output to get all PIDs and memory usage
      const lines = checkOutput.split('\n');
      lines.forEach(line => {
        if (line.includes('IcarusServer-Win64-Shipping.exe') && line.includes(',')) {
          const parts = line.split(',');
          if (parts.length >= 5) {
            const pid = parts[1].replace(/"/g, '').trim();
            const memUsage = parts[4].replace(/"/g, '').trim();
            allProcesses.push({ pid, memUsage });
          }
        }
      });
      
      if (allProcesses.length === 0) {
        return NextResponse.json({ 
          success: true, 
          message: 'No IcarusServer processes found to kill',
          processesKilled: 0
        });
      }
      
      console.log(`Found ${allProcesses.length} processes to kill:`, allProcesses);
    } catch (checkError) {
      console.error('Error checking processes:', checkError);
      return NextResponse.json({ 
        success: true, 
        message: 'No processes found to kill',
        processesKilled: 0
      });
    }

    // Force kill all processes by PID for more reliable termination
    let killedCount = 0;
    const killResults = [];
    
    for (const process of allProcesses) {
      try {
        console.log(`Force killing PID ${process.pid} (Memory: ${process.memUsage})`);
        const { stdout, stderr } = await execAsync(`taskkill /F /PID ${process.pid}`);
        
        if (stdout.includes('SUCCESS') || stdout.includes('terminated')) {
          killedCount++;
          killResults.push(`Successfully killed PID ${process.pid}`);
          console.log(`Successfully killed PID ${process.pid}`);
        } else {
          killResults.push(`Failed to kill PID ${process.pid}: ${stdout}`);
          console.log(`Failed to kill PID ${process.pid}:`, stdout);
        }
      } catch (killError) {
        const errorMsg = killError instanceof Error ? killError.message : String(killError);
        
        // Check if process was already terminated
        if (errorMsg.includes('not found') || errorMsg.includes('not running')) {
          killResults.push(`PID ${process.pid} was already terminated`);
          console.log(`PID ${process.pid} was already terminated`);
        } else {
          killResults.push(`Error killing PID ${process.pid}: ${errorMsg}`);
          console.error(`Error killing PID ${process.pid}:`, killError);
        }
      }
    }
    
    // Wait and verify all processes are gone
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    try {
      const { stdout: verifyOutput } = await execAsync('tasklist /FI "IMAGENAME eq IcarusServer-Win64-Shipping.exe" /FO CSV');
      
      const remainingProcesses = verifyOutput.split('\n').filter(line => 
        line.includes('IcarusServer-Win64-Shipping.exe') && line.includes(',')
      ).length;
      
      if (remainingProcesses > 0) {
        console.log(`Warning: ${remainingProcesses} processes may still be running`);
        killResults.push(`Warning: ${remainingProcesses} processes may still be running`);
      }
    } catch (verifyError) {
      // Expected if no processes exist
      console.log('Process verification completed - no processes found');
    }
    
    const message = killedCount > 0 
      ? `Force killed ${killedCount} of ${allProcesses.length} IcarusServer processes`
      : 'No processes were successfully killed';
    
    console.log('Force kill operation completed:', message);
    return NextResponse.json({ 
      success: true, 
      message: message,
      processesKilled: killedCount,
      totalProcesses: allProcesses.length,
      details: killResults
    });

  } catch (error) {
    console.error('Failed to force kill processes:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ 
      success: false, 
      error: `Failed to force kill processes: ${errorMessage}` 
    }, { status: 500 });
  }
}