/** @type {import('next').NextConfig} */
const nextConfig = {
  // App directory is now stable in Next.js 14+
  
  // Configure custom server settings
  compiler: {
    // Remove console.logs in production
    removeConsole: process.env.NODE_ENV === 'production'
  },
  
  // Configure WebSocket handling
  async rewrites() {
    return {
      beforeFiles: [
        // Ensure our WebSocket endpoint is properly routed
        {
          source: '/ws',
          destination: '/ws'
        }
      ]
    };
  }
};

module.exports = nextConfig;