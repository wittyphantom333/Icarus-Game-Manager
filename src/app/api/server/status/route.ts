import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Check if IcarusServer-Win64-Shipping.exe is running
async function checkServerStatus(): Promise<'running' | 'stopped'> {
  try {
    const { stdout } = await execAsync('tasklist /FI "IMAGENAME eq IcarusServer-Win64-Shipping.exe" /FO CSV');
    console.log('Status check output:', stdout);
    
    // Check if the CSV output contains IcarusServer-Win64-Shipping.exe data (not just the header)
    const lines = stdout.split('\n');
    
    // Look for lines that contain IcarusServer-Win64-Shipping.exe and have actual process data
    // The CSV format is: "Image Name","PID","Session Name","Session#","Mem Usage"
    const hasRunningProcess = lines.some(line => {
      const trimmedLine = line.trim();
      
      // Must contain IcarusServer-Win64-Shipping.exe and have comma-separated values (indicating actual process data)
      return trimmedLine.includes('IcarusServer-Win64-Shipping.exe') && 
             trimmedLine.includes(',') && 
             !trimmedLine.startsWith('INFO:') && // Exclude error messages
             trimmedLine.split(',').length >= 4; // Should have at least 4 CSV fields
    });
    
    console.log('Server status detection result:', hasRunningProcess ? 'RUNNING' : 'STOPPED');
    return hasRunningProcess ? 'running' : 'stopped';
  } catch (error) {
    console.error('Error checking server status:', error);
    return 'stopped';
  }
}

export async function GET() {
  try {
    const status = await checkServerStatus();
    return NextResponse.json({ status });
  } catch (error) {
    console.error('Failed to get server status:', error);
    return NextResponse.json({ error: 'Failed to get server status' }, { status: 500 });
  }
}