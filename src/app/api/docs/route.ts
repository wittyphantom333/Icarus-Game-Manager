import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format');

  try {
    const filePath = join(process.cwd(), 'src', 'app', 'api', 'openapi.yaml');
    const yamlContent = await readFile(filePath, 'utf8');
    
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
<html lang="en">
<head>
  <title>Icarus Game Manager API Documentation</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body {
      margin: 0;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
      background: #f8f9fa;
    }
    .test-message {
      text-align: center;
      padding: 50px;
      background: white;
      border-radius: 8px;
      margin: 20px auto;
      max-width: 600px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .loading {
      text-align: center;
      padding: 50px;
      color: #666;
    }
    .fallback {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
  </style>
</head>
<body>
  <div class="test-message">
    <h1>🚀 API Documentation Loading...</h1>
    <p>If you can see this message, the HTML is working correctly!</p>
    <p><strong>Testing:</strong> This should display in your browser, not download.</p>
    <hr>
    <div id="scalar-container">
      <p>Scalar documentation will load below...</p>
    </div>
  </div>
  
  <div id="loading" class="loading">
    <h2>Loading Interactive API Documentation...</h2>
    <p>Please wait while the Scalar documentation loads.</p>
  </div>
  
  <div id="fallback" class="fallback" style="display: none;">
    <h1>Icarus Game Manager API Documentation</h1>
    <p>The interactive documentation failed to load. You can:</p>
    <ul>
      <li><a href="/api/docs?format=yaml" target="_blank">Download the OpenAPI YAML specification</a></li>
      <li>Use tools like Postman or Insomnia to import the API specification</li>
      <li>Refresh this page to try again</li>
    </ul>
    
    <h2>Quick Reference</h2>
    <h3>Server Control</h3>
    <ul>
      <li><code>GET /api/server/status</code> - Get server status</li>
      <li><code>POST /api/server/start</code> - Start the server</li>
      <li><code>POST /api/server/stop</code> - Stop the server</li>
      <li><code>POST /api/server/restart</code> - Restart the server</li>
    </ul>
    
    <h3>Configuration</h3>
    <ul>
      <li><code>GET /api/server/config</code> - Get server configuration</li>
      <li><code>POST /api/server/config</code> - Update server configuration</li>
    </ul>
    
    <h3>Mods</h3>
    <ul>
      <li><code>GET /api/mods</code> - List installed mods</li>
      <li><code>POST /api/mods/install</code> - Install a mod</li>
      <li><code>POST /api/mods/{modId}/toggle</code> - Toggle mod status</li>
    </ul>
  </div>

  <script
    id="api-reference"
    data-url="/api/docs?format=yaml"
    data-configuration='{"theme": "default"}'></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.24.66"></script>
  
  <script>
    console.log('API Documentation page loaded');
    
    // Show fallback after 10 seconds if Scalar hasn't loaded
    setTimeout(function() {
      const apiRef = document.querySelector('#api-reference');
      console.log('Checking Scalar loading...', apiRef);
      if (!apiRef || !apiRef.innerHTML.trim()) {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('fallback').style.display = 'block';
      } else {
        document.getElementById('loading').style.display = 'none';
      }
    }, 10000);
    
    // Hide loading when Scalar loads
    document.addEventListener('DOMContentLoaded', function() {
      console.log('DOM loaded');
      setTimeout(function() {
        const apiRef = document.querySelector('#api-reference');
        if (apiRef && apiRef.innerHTML.trim()) {
          document.getElementById('loading').style.display = 'none';
        }
      }, 3000);
    });
  </script>
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