import { NextRequest, NextResponse } from 'next/server';
import { searchAlbums } from '@/lib/albumSearch';
import type { SearchScope } from '@/lib/types';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q') || '';
  const country = searchParams.get('country') || 'PH';
  const requestedScope = searchParams.get('scope') || 'all';
  const scope: SearchScope = ['all', 'title', 'artist'].includes(requestedScope)
    ? requestedScope as SearchScope
    : 'all';
  const requestedLimit = Number.parseInt(searchParams.get('limit') || '50', 10);
  const limit = Math.max(
    1,
    Math.min(Number.isFinite(requestedLimit) ? requestedLimit : 50, 50),
  );

  if (!query.trim()) {
    return NextResponse.json({ results: [] });
  }

  try {
    const albums = await searchAlbums({ query, country, limit, scope });
    return NextResponse.json(
      { results: albums, scope },
      {
        headers: {
          'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
        },
      }
    );
  } catch (error: any) {
    console.error('API /api/search error:', error);
    return NextResponse.json({ error: error.message || 'Search failed' }, { status: 500 });
  }
}
