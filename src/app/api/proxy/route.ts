import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
      return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
    }

    // Only allow GitHub raw URLs for security
    if (!url.includes('raw.githubusercontent.com') && !url.includes('github.com')) {
      return NextResponse.json({ error: 'Only GitHub URLs are allowed' }, { status: 403 });
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Icarus-Game-Manager/1.0',
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch content' }, { status: response.status });
    }

    const content = await response.text();
    
    return new NextResponse(content, {
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
      },
    });

  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json({ error: 'Failed to fetch content' }, { status: 500 });
  }
}