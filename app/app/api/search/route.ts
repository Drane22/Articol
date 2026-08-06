import { NextRequest, NextResponse } from 'next/server';
import { searchItunesAlbums } from '@/lib/itunes';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q') || '';
  const country = searchParams.get('country') || 'PH';
  const requestedLimit = Number.parseInt(searchParams.get('limit') || '50', 10);
  const limit = Math.max(
    1,
    Math.min(Number.isFinite(requestedLimit) ? requestedLimit : 50, 50),
  );

  if (!query.trim()) {
    return NextResponse.json({ results: [] });
  }

  try {
    const [artistAlbums, broadAlbums] = await Promise.all([
      searchItunesAlbums(query, country, limit, false, true),
      searchItunesAlbums(query, country, limit),
    ]);
    const albums = Array.from(
      new Map(
        [...artistAlbums, ...broadAlbums].map((album) => [album.itunesCollectionId, album])
      ).values()
    ).slice(0, limit);
    return NextResponse.json(
      { results: albums },
      {
        headers: {
          'Cache-Control': 'private, max-age=60, stale-while-revalidate=300',
        },
      }
    );
  } catch (error: any) {
    console.error('API /api/search error:', error);
    return NextResponse.json({ error: error.message || 'Search failed' }, { status: 500 });
  }
}
