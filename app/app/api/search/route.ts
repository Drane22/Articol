import { NextRequest, NextResponse } from 'next/server';
import { searchItunesAlbums } from '@/lib/itunes';
import type { Album } from '@/lib/types';

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function matchesScopedField(value: string, query: string): boolean {
  const fieldTokens = normalizeSearchText(value).split(' ').filter(Boolean);
  const queryTokens = normalizeSearchText(query).split(' ').filter(Boolean);
  if (fieldTokens.length === 0 || queryTokens.length === 0) return false;

  return queryTokens.every((queryToken) =>
    fieldTokens.some((fieldToken) => fieldToken === queryToken || fieldToken.startsWith(queryToken))
  );
}

function filterScopedAlbums(albums: Album[], query: string, scope: string): Album[] {
  if (scope === 'title') return albums.filter((album) => matchesScopedField(album.title, query));
  if (scope === 'artist') return albums.filter((album) => matchesScopedField(album.artistName, query));
  return albums;
}

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
    const scopedAlbums = filterScopedAlbums(sourceAlbums, query, scope);
    const albums = Array.from(
      new Map(
        scopedAlbums.map((album) => [album.itunesCollectionId, album])
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
