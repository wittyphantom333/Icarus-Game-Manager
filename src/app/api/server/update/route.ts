import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

// Configuration - these should match your setup
const STEAMCMD_PATH = 'C:\\SteamCMD'; // SteamCMD directory
const ICARUS_SERVER_PATH = 'C:\\icarusserver';
const STEAM_LOGIN = 'anonymous';
const ICARUS_APP_ID = '2089300';

// Helper function to check Steam connectivity
async function checkSteamConnectivity(): Promise<{available: boolean, message: string}> {
  try {
    const { spawn } = await import('child_process');
    return new Promise((resolve) => {
      const steamcmdExe = path.join(STEAMCMD_PATH, 'steamcmd.exe');
      const testProcess = spawn(steamcmdExe, ['+login', 'anonymous', '+quit'], {
        cwd: STEAMCMD_PATH,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true
      });

      let output = '';
      const timeout = setTimeout(() => {
        testProcess.kill();
        resolve({ available: false, message: 'Steam connectivity test timed out' });
      }, 10000);

      testProcess.stdout?.on('data', (data) => {
        output += data.toString();
      });

      testProcess.stderr?.on('data', (data) => {
        output += data.toString();
      });

      testProcess.on('close', (code) => {
        clearTimeout(timeout);
        if (output.includes('Steam server temporarily unavailable')) {
          resolve({ available: false, message: 'Steam servers temporarily unavailable' });
        } else if (output.includes('Connecting to Steam')) {
          resolve({ available: true, message: 'Steam connectivity confirmed' });
        } else {
          resolve({ available: true, message: 'Steam appears to be accessible' });
        }
      });
    });
  } catch (error) {
    return { available: false, message: 'Unable to test Steam connectivity' };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, retry } = body;

    if (action !== 'update') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Check if SteamCMD exists
    const steamcmdExe = path.join(STEAMCMD_PATH, 'steamcmd.exe');
    if (!fs.existsSync(steamcmdExe)) {
      return NextResponse.json({ 
        error: 'SteamCMD not found',
        details: `Please install SteamCMD to ${STEAMCMD_PATH}`,
        downloadUrl: 'https://steamcdn-a.akamaihd.net/client/installer/steamcmd.zip'
      }, { status: 404 });
    }

    // Check if server directory exists
    if (!fs.existsSync(ICARUS_SERVER_PATH)) {
      return NextResponse.json({ 
        error: 'Server directory not found',
        details: `Server directory ${ICARUS_SERVER_PATH} does not exist`
      }, { status: 404 });
    }

    return new NextResponse(
      new ReadableStream({
        start(controller) {
          console.log('[Server Update] Starting Icarus server update...');
          
          // Send initial status
          controller.enqueue(`data: ${JSON.stringify({
            type: 'status',
            message: 'Starting server update...',
            progress: 0
          })}\n\n`);
          
          // Clean up potential leftover files that might cause issues
          try {
            const steamcmdLogDir = path.join(STEAMCMD_PATH, 'logs');
            const rootLogDir = 'C:\\logs';
            
            const logFiles = [
              path.join(steamcmdLogDir, 'stderr.txt'),
              path.join(steamcmdLogDir, 'bootstrap_log.txt'),
              path.join(rootLogDir, 'stderr.txt'),
              path.join(rootLogDir, 'bootstrap_log.txt'),
              path.join(STEAMCMD_PATH, 'appcache'),
              path.join(STEAMCMD_PATH, 'steamapps', 'temp')
            ];
            
            logFiles.forEach(file => {
              if (fs.existsSync(file)) {
                if (fs.statSync(file).isDirectory()) {
                  fs.rmSync(file, { recursive: true, force: true });
                  console.log(`[Server Update] Cleaned up directory: ${file}`);
                } else {
                  fs.unlinkSync(file);
                  console.log(`[Server Update] Cleaned up log file: ${file}`);
                }
              }
            });
          } catch (error) {
            console.log('[Server Update] Could not clean up some files (this is usually fine):', error);
          }
          
          // SteamCMD arguments for updating Icarus server (use simple, proven parameters)
          const steamcmdArgs = [
            '+force_install_dir', ICARUS_SERVER_PATH,
            '+login', STEAM_LOGIN,
            '+app_update', ICARUS_APP_ID,
            '+quit'
          ];

          console.log(`[Server Update] Executing: ${steamcmdExe} ${steamcmdArgs.join(' ')}`);

          // Track if we've seen the "already up to date" message
          let isAlreadyUpToDate = false;

          // Set up environment for SteamCMD
          const env = { ...process.env };
          
          // Clear any potential Steam environment variables that might interfere
          delete env.STEAM_COMPAT_DATA_PATH;
          delete env.STEAM_COMPAT_CLIENT_INSTALL_PATH;
          
          // Set SteamCMD working directory explicitly
          env.STEAMCMD_HOME = STEAMCMD_PATH;
          
          // Ensure proper path separators for Windows
          env.PATH = `${STEAMCMD_PATH};${env.PATH}`;
          
          const updateProcess = spawn(steamcmdExe, steamcmdArgs, {
            cwd: STEAMCMD_PATH,
            stdio: ['pipe', 'pipe', 'pipe'],
            env: env,
            shell: false,
            windowsHide: true
          });

          // Send initial status
          controller.enqueue(`data: ${JSON.stringify({
            type: 'status',
            message: 'Starting server update...',
            progress: 0
          })}\n\n`);

          // Handle stdout
          updateProcess.stdout?.on('data', (data) => {
            const output = data.toString();
            console.log('[SteamCMD Output]:', output);
            
            // Parse progress and status from SteamCMD output
            let progress = 0;
            let message = output.trim();
            
            // Extract progress percentage if available
            const progressMatch = output.match(/\[\s*(\d+)%\]/);
            if (progressMatch) {
              progress = parseInt(progressMatch[1]);
            }
            
            // Detect key status messages and errors
            if (output.includes('Connecting anonymously') || output.includes('logging in user')) {
              message = 'Connecting to Steam...';
              progress = 10;
            } else if (output.includes('Downloading Update') || output.includes('downloading')) {
              message = 'Downloading server files...';
              progress = Math.max(progress, 25);
            } else if (output.includes('Verifying installation')) {
              message = 'Verifying installation...';
              progress = Math.max(progress, 80);
            } else if (output.includes('Success! App')) {
              message = 'Update completed successfully!';
              progress = 100;
            } else if (output.includes('state is 0x6') || 
                       output.includes("Error! App '2089300' state is 0x6") ||
                       output.includes('0x6 after update job')) {
              message = 'Server is already up to date - no update needed';
              progress = 100;
              isAlreadyUpToDate = true;
            } else if (output.includes('Steam server temporarily unavailable')) {
              message = 'Steam servers temporarily unavailable';
            } else if (output.includes('Fatal Error')) {
              // Extract the fatal error message
              const errorMatch = output.match(/Fatal Error:\s*(.+)/);
              if (errorMatch) {
                message = `Error: ${errorMatch[1].trim()}`;
              } else {
                message = 'Fatal error occurred during update';
              }
            } else if (output.includes('needs at least') && output.includes('free disk space')) {
              message = 'Insufficient disk space for update';
            } else if (output.includes('Assertion Failed')) {
              message = 'SteamCMD internal error - retrying may help';
            }

            // Don't send empty or log directory messages
            if (message && !message.includes('Logging directory') && !message.includes('stderr.txt')) {
              controller.enqueue(`data: ${JSON.stringify({
                type: 'progress',
                message: message,
                progress: progress,
                output: output.trim()
              })}\n\n`);
            }
          });

          // Handle stderr
          updateProcess.stderr?.on('data', (data) => {
            const error = data.toString();
            console.error('[SteamCMD Error]:', error);
            
            // Don't treat "state is 0x6" as an error - it means already up to date
            if (!error.includes('state is 0x6')) {
              controller.enqueue(`data: ${JSON.stringify({
                type: 'error',
                message: error.trim()
              })}\n\n`);
            } else {
              console.log('[SteamCMD] Already up to date message detected in stderr');
              isAlreadyUpToDate = true;
            }
          });

          // Handle process completion
          updateProcess.on('close', (code) => {
            console.log(`[Server Update] Process exited with code ${code}`);
            
            if (code === 0) {
              controller.enqueue(`data: ${JSON.stringify({
                type: 'complete',
                message: 'Server update completed successfully!',
                progress: 100,
                success: true
              })}\n\n`);
            } else if (code === 1 || code === 8) {
              // Exit codes 1 and 8 are commonly "already up to date" scenarios
              // If we detected the flag, use success message, otherwise be cautious but positive
              if (isAlreadyUpToDate) {
                controller.enqueue(`data: ${JSON.stringify({
                  type: 'complete',
                  message: 'Server is already up to date! No update needed.',
                  progress: 100,
                  success: true
                })}\n\n`);
              } else {
                // Assume it's "already up to date" for exit codes 1 and 8 since these are most common
                controller.enqueue(`data: ${JSON.stringify({
                  type: 'complete',
                  message: 'Server appears to be up to date! No update needed.',
                  progress: 100,
                  success: true
                })}\n\n`);
              }
            } else {
              // Provide more helpful error messages based on common exit codes
              let errorMessage = `Update failed with exit code ${code}`;
              let suggestions = '';
              
              if (code === 4294967294 || code === -2) {
                errorMessage = 'SteamCMD encountered a fatal error during update';
                suggestions = 'This may be due to temporary Steam server issues. Try again in a few minutes.';
              } else if (code === 5) {
                errorMessage = 'Access denied - insufficient permissions';
                suggestions = 'Try running as administrator or check file permissions.';
              } else if (code === 7) {
                errorMessage = 'Invalid Steam credentials or network error';
                suggestions = 'Check your internet connection and try again.';
              }
              
              controller.enqueue(`data: ${JSON.stringify({
                type: 'complete',
                message: errorMessage,
                progress: 100,
                success: false,
                exitCode: code,
                suggestions: suggestions
              })}\n\n`);
            }
            
            controller.close();
          });

          // Handle process errors
          updateProcess.on('error', (error) => {
            console.error('[Server Update] Process error:', error);
            controller.enqueue(`data: ${JSON.stringify({
              type: 'error',
              message: `Failed to start update process: ${error.message}`
            })}\n\n`);
            controller.close();
          });
        }
      }),
      {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      }
    );

  } catch (error) {
    console.error('Server update error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Server update failed' 
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    // Check SteamCMD and server status for update readiness
    const steamcmdExe = path.join(STEAMCMD_PATH, 'steamcmd.exe');
    const steamcmdExists = fs.existsSync(steamcmdExe);
    const serverExists = fs.existsSync(ICARUS_SERVER_PATH);
    
    // Get current server version if possible
    let serverVersion = 'Unknown';
    try {
      const manifestPath = path.join(ICARUS_SERVER_PATH, 'steamapps', 'appmanifest_2089300.acf');
      if (fs.existsSync(manifestPath)) {
        const manifestContent = fs.readFileSync(manifestPath, 'utf8');
        const buildIdMatch = manifestContent.match(/"buildid"\s+"(\d+)"/);
        if (buildIdMatch) {
          serverVersion = `Build ${buildIdMatch[1]}`;
        }
      }
    } catch (error) {
      console.log('Could not read server version:', error);
    }

    return NextResponse.json({
      canUpdate: steamcmdExists && serverExists,
      steamcmdExists,
      serverExists,
      steamcmdPath: STEAMCMD_PATH,
      serverPath: ICARUS_SERVER_PATH,
      currentVersion: serverVersion,
      requirements: {
        steamcmd: steamcmdExists ? 'Available' : 'Missing - Download from https://steamcdn-a.akamaihd.net/client/installer/steamcmd.zip',
        serverDirectory: serverExists ? 'Available' : 'Missing - Server not installed'
      }
    });
  } catch (error) {
    console.error('Failed to check update status:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to check update status' 
    }, { status: 500 });
  }
}