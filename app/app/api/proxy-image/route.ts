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
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
    });

    if (!imgResponse.ok) {
      console.warn(`Proxy fetch failed for ${imageUrl}: HTTP ${imgResponse.status}`);
      return NextResponse.json({ error: `Failed to fetch image: HTTP ${imgResponse.status}` }, { status: 502 });
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
