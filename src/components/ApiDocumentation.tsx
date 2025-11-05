'use client';

import { useEffect, useRef } from 'react';

export default function ApiDocumentation() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && containerRef.current) {
      // Clear any existing content
      containerRef.current.innerHTML = '';
      
      // Create the script element for Scalar
      const scriptElement = document.createElement('script');
      scriptElement.id = 'api-reference';
      scriptElement.setAttribute('data-url', '/api/docs?format=yaml');
      scriptElement.setAttribute('data-configuration', JSON.stringify({
        theme: 'default',
        layout: 'modern',
        showSidebar: true,
        hideDownloadButton: false,
        hideTestRequestButton: false
      }));
      
      // Add the script to our container
      containerRef.current.appendChild(scriptElement);
      
      // Load the Scalar library
      const scalarScript = document.createElement('script');
      scalarScript.src = 'https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.24.66';
      scalarScript.onload = () => {
        console.log('Scalar API Reference loaded successfully');
      };
      scalarScript.onerror = () => {
        console.error('Failed to load Scalar API Reference');
        // Show fallback content
        if (containerRef.current) {
          containerRef.current.innerHTML = `
            <div class="min-h-screen bg-white p-8">
              <div class="max-w-4xl mx-auto">
                <h1 class="text-3xl font-bold text-gray-900 mb-8">Icarus Game Manager API Documentation</h1>
                <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-8">
                  <h2 class="text-lg font-semibold text-yellow-800 mb-2">Interactive Documentation Unavailable</h2>
                  <p class="text-yellow-700 mb-4">The interactive documentation failed to load. You can:</p>
                  <ul class="list-disc list-inside text-yellow-700 space-y-1">
                    <li><a href="/api/docs?format=yaml" target="_blank" class="underline hover:text-yellow-900">Download the OpenAPI YAML specification</a></li>
                    <li>Use tools like Postman or Insomnia to import the API specification</li>
                    <li>Refresh this page to try again</li>
                  </ul>
                </div>
                
                <div class="space-y-8">
                  <div>
                    <h3 class="text-xl font-semibold text-gray-900 mb-4">Server Control</h3>
                    <div class="bg-gray-50 rounded-lg p-4">
                      <ul class="space-y-2">
                        <li><code class="bg-white px-3 py-1 rounded border">GET /api/server/status</code> - Get server status</li>
                        <li><code class="bg-white px-3 py-1 rounded border">POST /api/server/start</code> - Start the server</li>
                        <li><code class="bg-white px-3 py-1 rounded border">POST /api/server/stop</code> - Stop the server</li>
                        <li><code class="bg-white px-3 py-1 rounded border">POST /api/server/restart</code> - Restart the server</li>
                      </ul>
                    </div>
                  </div>
                  
                  <div>
                    <h3 class="text-xl font-semibold text-gray-900 mb-4">Configuration</h3>
                    <div class="bg-gray-50 rounded-lg p-4">
                      <ul class="space-y-2">
                        <li><code class="bg-white px-3 py-1 rounded border">GET /api/server/config</code> - Get server configuration</li>
                        <li><code class="bg-white px-3 py-1 rounded border">POST /api/server/config</code> - Update server configuration</li>
                      </ul>
                    </div>
                  </div>
                  
                  <div>
                    <h3 class="text-xl font-semibold text-gray-900 mb-4">Mods</h3>
                    <div class="bg-gray-50 rounded-lg p-4">
                      <ul class="space-y-2">
                        <li><code class="bg-white px-3 py-1 rounded border">GET /api/mods</code> - List installed mods</li>
                        <li><code class="bg-white px-3 py-1 rounded border">POST /api/mods/install</code> - Install a mod</li>
                        <li><code class="bg-white px-3 py-1 rounded border">POST /api/mods/[modId]/toggle</code> - Toggle mod status</li>
                      </ul>
                    </div>
                  </div>
                  
                  <div>
                    <h3 class="text-xl font-semibold text-gray-900 mb-4">Backups</h3>
                    <div class="bg-gray-50 rounded-lg p-4">
                      <ul class="space-y-2">
                        <li><code class="bg-white px-3 py-1 rounded border">GET /api/backups</code> - List backups</li>
                        <li><code class="bg-white px-3 py-1 rounded border">POST /api/backups</code> - Create backup</li>
                        <li><code class="bg-white px-3 py-1 rounded border">POST /api/backups/restore</code> - Restore backup</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          `;
        }
      };
      
      document.head.appendChild(scalarScript);
      
      // Cleanup function
      return () => {
        if (document.head.contains(scalarScript)) {
          document.head.removeChild(scalarScript);
        }
      };
    }
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <div ref={containerRef} className="min-h-screen">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading Scalar API documentation...</p>
          </div>
        </div>
      </div>
    </div>
  );
}