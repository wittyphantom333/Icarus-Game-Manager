# Icarus Game Manager

A comprehensive Next.js-based web application for managing Icarus dedicated game servers and mods on Windows.

## Features

### 🎮 Server Management
- **Start/Stop/Restart** Icarus server instances
- **Process Management** - Direct IcarusServer.exe process control
- **Real-time Status Monitoring** - Live server status updates
- **Automatic Process Cleanup** - Reliable server termination

### 📊 Real-time Monitoring
- **Live Log Viewer** - WebSocket-based real-time log streaming
- **Server Status Dashboard** - Visual status indicators
- **Performance Metrics** - Server uptime and resource usage

### 🔧 Mod Management
- **Community Mod Browser** - Browse 79+ mods from Jimk72/Icarus_Mods repository
- **Automatic Conversion** - EXMODZ files automatically converted to PAK format
- **One-Click Installation** - Download and install mods with progress tracking
- **Local Mod Upload** - Upload and install .pak, .zip, .EXMODZ mod files
- **Enable/Disable Mods** - Toggle mods without deletion
- **Mod Library** - View all installed mods with metadata
- **Automatic Mod Detection** - Scans existing mod directory

### ⚙️ Configuration
- **Server Settings** - Manage server configuration files
- **Service Configuration** - Control Windows service settings
- **Automated Backups** - Optional backup functionality

## Prerequisites

Before running this application, ensure you have:

1. **Node.js** (v18 or higher) - [Download here](https://nodejs.org/)
2. **Icarus Dedicated Server** installed at `C:\\icarusserver` via SteamCMD
3. **Windows** operating system (required for service management)
4. **Administrator privileges** (required for Windows service operations)

## Installation

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Server Path** (if different from default)
   
   Edit the server path in the API routes if your Icarus server is not located at `C:\\icarusserver`:
   - `src/app/api/server/*/route.ts`
   - `server.js` (WebSocket log monitoring)

## Usage

### Development Mode

1. **Start the Development Server**
   ```bash
   npm run dev
   ```

2. **Access the Web Interface**
   
   Open your browser and navigate to [http://localhost:3000](http://localhost:3000)

### Production Deployment

1. **Build the Application**
   ```bash
   npm run build
   ```

2. **Start the Production Server**
   ```bash
   npm start
   ```

## Server Configuration

### Default Server Path
The application expects the Icarus server to be installed at:
```
C:\\icarusserver\\IcarusServer.exe
```

### Mod Directory
Mods are managed in:
```
C:\\icarusserver\\Icarus\\Content\\Paks\\Mods\\
```

### Log Files
Server logs are automatically detected from multiple possible locations:
```
C:\\icarusserver\\Icarus\\Saved\\Logs\\Icarus.log
C:\\icarusserver\\Icarus\\Saved\\Logs\\IcarusServer.log
C:\\icarusserver\\Logs\\server.log
C:\\icarusserver\\Logs\\Icarus.log
```

## Process Management

The application provides direct process control of IcarusServer.exe:

1. **Direct Process Control**: Start/stop IcarusServer.exe directly
2. **Reliable Termination**: Uses taskkill with force flag for guaranteed stopping
3. **Process Monitoring**: Real-time status checking via tasklist
4. **Automatic Cleanup**: Ensures complete process termination

### Server Management Features

Through the web interface, you can:
- Start the Icarus server process
- Stop the server with force termination
- Restart the server (stop + start)
- Monitor real-time server status

## API Endpoints

### Server Management
- `GET /api/server/status` - Get current server status
- `POST /api/server/start` - Start the server
- `POST /api/server/stop` - Stop the server  
- `POST /api/server/restart` - Restart the server

### Mod Management
- `GET /api/mods` - List all installed mods
- `GET /api/mods/browse` - Browse available community mods
- `POST /api/mods/download` - Download and install community mods (auto-converts EXMODZ to PAK)
- `POST /api/mods/install` - Install a local mod file
- `POST /api/mods/[modId]/toggle` - Enable/disable a mod

## WebSocket Integration

Real-time features powered by WebSocket server on port 3001:
- Live log streaming
- Server status updates
- Mod installation progress

## Troubleshooting

### Common Issues

1. **Server Path Not Found**
   - Verify Icarus server is installed at `C:\\icarusserver`
   - Check file permissions
   - Ensure IcarusServer.exe exists

2. **Server Won't Start/Stop**
   - Check if IcarusServer.exe exists at the configured path
   - Verify Windows permissions for process management
   - Ensure no antivirus blocking process operations

3. **Logs Not Displaying**
   - Check if server is running and generating logs
   - Verify log file permissions in Icarus/Saved/Logs directory
   - Ensure WebSocket connection on port 3001
   - Server logs are automatically detected from multiple locations

4. **Mod Installation Issues**
   - Check mod directory permissions
   - Ensure .pak file format
   - Verify sufficient disk space

### Process Debugging

Use these commands to debug server issues:
- `tasklist /FI "IMAGENAME eq IcarusServer.exe"` - Check if server is running
- `taskkill /F /IM IcarusServer.exe` - Force stop the server
- Check the browser's developer console for API errors

## Development

### Project Structure
```
src/
├── app/
│   ├── api/                 # API routes
│   │   ├── server/         # Server management endpoints
│   │   └── mods/           # Mod management endpoints
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Main dashboard
├── components/             # React components
│   ├── ServerStatus.tsx    # Server status display
│   ├── ServerControls.tsx  # Server control buttons
│   ├── LogViewer.tsx       # Real-time log viewer
│   └── ModManager.tsx      # Mod management interface
└── server.js               # Custom Next.js + WebSocket server
```

### Adding Features

1. **New API Endpoints**: Add routes in `src/app/api/`
2. **UI Components**: Create components in `src/components/`
3. **Server Features**: Modify API routes in `src/app/api/`
4. **Real-time Features**: Extend WebSocket functionality in `server.js`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly on Windows
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues and support:
1. Check the troubleshooting section
2. Review Windows Event Viewer logs
3. Open an issue on GitHub with detailed error information

---

**Note**: This application is designed specifically for Windows environments due to Windows process management requirements (`tasklist` and `taskkill` commands). Administrator privileges may be required for some process management operations.