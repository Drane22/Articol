import { NextRequest, NextResponse } from 'next/server';
import { searchItunesAlbums } from '@/lib/itunes';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q') || '';
  const country = searchParams.get('country') || 'PH';
  const limit = parseInt(searchParams.get('limit') || '25', 10);

  if (!query.trim()) {
    return NextResponse.json({ results: [] });
  }

  try {
    const albums = await searchItunesAlbums(query, country, limit);
    return NextResponse.json(
      { results: albums },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      }
    );
  } catch (error: any) {
    console.error('API /api/search error:', error);
    return NextResponse.json({ error: error.message || 'Search failed' }, { status: 500 });
  }
}
