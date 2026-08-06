import { NextRequest, NextResponse } from 'next/server';
import { getItunesAlbumById, searchItunesAlbums } from '@/lib/itunes';
import { calculateMusicScore } from '@/lib/visualEngine';
import { Album } from '@/lib/types';
import { normalizeStorefront } from '@/lib/storefronts';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const collectionId = parseInt(id, 10);
  const country = normalizeStorefront(request.nextUrl.searchParams.get('country'));

  if (isNaN(collectionId)) {
    return NextResponse.json({ error: 'Invalid album ID' }, { status: 400 });
  }

  try {
    const { album: queryAlbum } = await getItunesAlbumById(collectionId, country);
    if (!queryAlbum) {
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }

    // Search for related albums by artist or genre via metadata lookup
    const artistCandidates = await searchItunesAlbums(queryAlbum.artistName, country, 15);
    const genreCandidates = await searchItunesAlbums(queryAlbum.genre, country, 15);

    const pool = new Map<number, Album>();
    for (const c of [...artistCandidates, ...genreCandidates]) {
      if (c.itunesCollectionId !== queryAlbum.itunesCollectionId && c.normalizedArtistName !== queryAlbum.normalizedArtistName) {
        pool.set(c.itunesCollectionId, c);
      }
    }

    const scored = Array.from(pool.values()).map(candidate => {
      const musicScore = calculateMusicScore(queryAlbum, candidate);
      return {
        album: candidate,
        musicScore,
        reason: `Related album in ${queryAlbum.genre}`,
      };
    });

    scored.sort((a, b) => b.musicScore - a.musicScore);

    return NextResponse.json({
      status: 'metadata_only',
      results: scored.slice(0, 12),
    });
  } catch (error: any) {
    console.error(`API /api/albums/${id}/related error:`, error);
    return NextResponse.json({ error: error.message || 'Related albums lookup failed' }, { status: 500 });
  }
}
