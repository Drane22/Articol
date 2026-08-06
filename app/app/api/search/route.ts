import { NextRequest, NextResponse } from 'next/server';
import { searchItunesAlbums } from '@/lib/itunes';
import type { Album } from '@/lib/types';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q') || '';
  const country = searchParams.get('country') || 'PH';
  const requestedScope = searchParams.get('scope') || 'all';
  const scope = ['all', 'title', 'artist'].includes(requestedScope) ? requestedScope : 'all';
  const requestedLimit = Number.parseInt(searchParams.get('limit') || '50', 10);
  const limit = Math.max(
    1,
    Math.min(Number.isFinite(requestedLimit) ? requestedLimit : 50, 50),
  );

  if (!query.trim()) {
    return NextResponse.json({ results: [] });
  }

  try {
    let sourceAlbums: Album[];
    if (scope === 'title') {
      sourceAlbums = await searchItunesAlbums(query, country, limit, true);
    } else if (scope === 'artist') {
      sourceAlbums = await searchItunesAlbums(query, country, limit, false, true);
    } else {
      const [artistAlbums, broadAlbums] = await Promise.all([
        searchItunesAlbums(query, country, limit, false, true),
        searchItunesAlbums(query, country, limit),
      ]);
      sourceAlbums = [...artistAlbums, ...broadAlbums];
    }
    const albums = Array.from(
      new Map(
        sourceAlbums.map((album) => [album.itunesCollectionId, album])
      ).values()
    ).slice(0, limit);
    return NextResponse.json(
      { results: albums, scope },
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
