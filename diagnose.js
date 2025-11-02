const IcarusServiceManager = require('./src/lib/service-manager');
const fs = require('fs');
const path = require('path');

async function diagnoseService() {
  console.log('🔍 Icarus Service Diagnostics');
  console.log('============================\n');
  
  const serviceManager = new IcarusServiceManager();
  const serverPath = 'C:\\icarusserver\\IcarusServer.exe';
  
  // 1. Check if server executable exists
  console.log('1. Checking server executable...');
  if (fs.existsSync(serverPath)) {
    console.log('✅ IcarusServer.exe found at:', serverPath);
  } else {
    console.log('❌ IcarusServer.exe NOT found at:', serverPath);
    console.log('   Please verify your Icarus server installation path');
    return;
  }
  
  // 2. Check service status
  console.log('\n2. Checking service status...');
  try {
    const status = await serviceManager.getServiceStatus();
    console.log(`📊 Service status: ${status}`);
    
    if (status === 'not-installed') {
      console.log('💡 Service is not installed. Run "node service-setup.js install" to install.');
    }
  } catch (error) {
    console.log('❌ Error checking service status:', error.message);
  }
  
  // 3. Check if process is running
  console.log('\n3. Checking if IcarusServer.exe process is running...');
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    const { stdout } = await execAsync('tasklist /FI "IMAGENAME eq IcarusServer.exe" /FO CSV');
    const isRunning = stdout.includes('IcarusServer.exe');
    
    if (isRunning) {
      console.log('✅ IcarusServer.exe process is running');
    } else {
      console.log('❌ IcarusServer.exe process is NOT running');
    }
  } catch (error) {
    console.log('❌ Error checking process:', error.message);
  }
  
  // 4. Check log files
  console.log('\n4. Checking for log files...');
  const possibleLogPaths = [
    'C:\\icarusserver\\Icarus\\Saved\\Logs\\Icarus.log',
    'C:\\icarusserver\\Icarus\\Saved\\Logs\\IcarusServer.log',
    'C:\\icarusserver\\Logs\\server.log',
    'C:\\icarusserver\\Logs\\Icarus.log'
  ];
  
  let foundLogs = false;
  possibleLogPaths.forEach(logPath => {
    if (fs.existsSync(logPath)) {
      const stats = fs.statSync(logPath);
      console.log(`✅ Log file found: ${logPath} (${Math.round(stats.size/1024)}KB, modified: ${stats.mtime.toLocaleString()})`);
      foundLogs = true;
    }
  });
  
  if (!foundLogs) {
    console.log('❌ No log files found. Server may not be running or logging may be disabled.');
  }
  
  // 5. Check directories
  console.log('\n5. Checking directory structure...');
  const directories = [
    'C:\\icarusserver',
    'C:\\icarusserver\\Icarus',
    'C:\\icarusserver\\Icarus\\Saved',
    'C:\\icarusserver\\Icarus\\Saved\\Logs',
    'C:\\icarusserver\\Icarus\\Content\\Paks\\Mods'
  ];
  
  directories.forEach(dir => {
    if (fs.existsSync(dir)) {
      console.log(`✅ Directory exists: ${dir}`);
    } else {
      console.log(`❌ Directory missing: ${dir}`);
    }
  });
  
  console.log('\n🔧 Recommendations:');
  console.log('- If service fails, try running IcarusServer.exe manually first to check for errors');
  console.log('- Check Windows Event Viewer for service-related errors');
  console.log('- Ensure you run service installation as Administrator');
  console.log('- Verify no antivirus is blocking the service');
}

diagnoseService().catch(console.error);