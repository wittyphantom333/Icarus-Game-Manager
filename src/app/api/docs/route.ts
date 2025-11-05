import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format');

  console.log('API docs request:', {
    url: request.url,
    format,
    headers: Object.fromEntries(request.headers.entries())
  });

  try {
    const filePath = join(process.cwd(), 'src', 'app', 'api', 'openapi.yaml');
    let yamlContent = await readFile(filePath, 'utf8');
    
    // Get the host from headers (more reliable for proxied requests)
    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = request.headers.get('x-forwarded-proto') || 
                    (request.url.startsWith('https:') ? 'https' : 'http');
    const serverUrl = `${protocol}://${host}/api`;
    
    // Always replace the server URL for both HTML and YAML responses
    yamlContent = yamlContent.replace(
      '  - url: /api',
      `  - url: ${serverUrl}`
    );
    
    console.log('Dynamic server URL replacement:', { host, protocol, serverUrl });
    
    // If format=yaml is requested, return raw YAML
    if (format === 'yaml') {
      return new NextResponse(yamlContent, {
        headers: {
          'Content-Type': 'application/x-yaml; charset=utf-8',
          'Cache-Control': 'public, max-age=3600',
          'Content-Disposition': 'attachment; filename="openapi.yaml"',
        },
      });
    }

    // Otherwise, return Scalar HTML documentation
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Icarus Game Manager API Documentation</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { margin: 0; padding: 0; }
  </style>
</head>
<body>
  <script
    id="api-reference"
    data-url="/api/docs?format=yaml"
    data-configuration='{
      "theme": "default",
      "layout": "modern",
      "showSidebar": true,
      "hideDownloadButton": false,
      "hideTestRequestButton": false
    }'></script>
  <script>
    // Add polyfill for URL.createObjectURL if it's missing
    if (!window.URL.createObjectURL) {
      window.URL.createObjectURL = function(blob) {
        console.warn('URL.createObjectURL polyfill called - functionality may be limited');
        return 'data:application/octet-stream;base64,';
      };
    }
    
    if (!window.URL.revokeObjectURL) {
      window.URL.revokeObjectURL = function(url) {
        console.warn('URL.revokeObjectURL polyfill called');
      };
    }
    
    // Add comprehensive error handling
    window.addEventListener('load', function() {
      console.log('Scalar documentation loaded');
      
      // Catch all errors
      window.addEventListener('error', function(e) {
        console.error('Global error:', e.error, e.message, e.filename, e.lineno);
      });
      
      window.addEventListener('unhandledrejection', function(e) {
        console.error('Unhandled promise rejection:', e.reason);
      });
      
      // Override URL constructor to catch invalid URLs
      const originalURL = window.URL;
      window.URL = function(url, base) {
        try {
          return new originalURL(url, base);
        } catch (error) {
          console.error('Invalid URL construction:', {url, base, error});
          throw error;
        }
      };
      
      // Log any fetch requests
      const originalFetch = window.fetch;
      window.fetch = function(...args) {
        console.log('Fetch request:', args);
        return originalFetch.apply(this, args).then(response => {
          console.log('Fetch response:', response.status, response.statusText);
          return response;
        }).catch(error => {
          console.error('Fetch error:', error);
          throw error;
        });
      };
    });
  </script>
  
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.24.45"></script>
</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
        'Content-Disposition': 'inline',
      },
    });
  } catch (error) {
    console.error('Error serving API documentation:', error);
    return NextResponse.json(
      { error: 'Failed to load API documentation' },
      { status: 500 }
    );
  }
}