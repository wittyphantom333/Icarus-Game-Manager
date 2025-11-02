# Icarus Server and Mod Manager

This project is a Next.js-based web application for managing Icarus game servers and mods.

## Key Features
- Server management (start/stop/restart IcarusServer.exe)
- Windows service integration with -Log flag
- Real-time log monitoring
- Mod installation and management
- Server configuration management
- Dashboard with server status

## Development Guidelines
- Use TypeScript for all components
- Follow Next.js App Router conventions
- Implement proper error handling for server operations
- Use Windows-specific Node.js APIs for service management
- Ensure secure file operations for game directory access