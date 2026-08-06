import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_HOSTS = [
  'is1-ssl.mzstatic.com',
  'is2-ssl.mzstatic.com',
  'is3-ssl.mzstatic.com',
  'is4-ssl.mzstatic.com',
  'is5-ssl.mzstatic.com',
  'coverartarchive.org',
  'i.discogs.com',
  'lastfm.freetls.fastly.net',
];

export async function GET(request: NextRequest) {
  const imageUrl = request.nextUrl.searchParams.get('url');

  if (!imageUrl) {
    return NextResponse.json({ error: 'Missing image URL' }, { status: 400 });
  }

  try {
    const parsedUrl = new URL(imageUrl);
    const host = parsedUrl.hostname.toLowerCase();
    const isAllowed = ALLOWED_HOSTS.includes(host) || host.endsWith('.mzstatic.com') || host === 'mzstatic.com';
    if (!isAllowed) {
      return NextResponse.json({ error: 'Host not allowed' }, { status: 403 });
    }

    const imgResponse = await fetch(imageUrl, {
      headers: { 'User-Agent': 'Articol-Proxy/1.0' },
    });

    if (!imgResponse.ok) {
      return NextResponse.json({ error: 'Failed to fetch image' }, { status: 502 });
    }

    const contentType = imgResponse.headers.get('content-type') || 'image/jpeg';
    const buffer = await imgResponse.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Invalid URL or proxy error' }, { status: 400 });
  }
}
