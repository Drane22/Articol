import { after, NextRequest, NextResponse } from 'next/server';
import { getItunesAlbumById, enrichAlbumWithArtwork } from '@/lib/itunes';
import { getAlbumFromDb, saveAlbumToDb } from '@/lib/db';
import { Album } from '@/lib/types';
import { normalizeStorefront } from '@/lib/storefronts';
import { isReliableVisualAnalysis } from '@/lib/visualValidation';

function mergeAlbumMetadata(stored: Album | null, live: Album | null, country: string): Album | null {
  if (!live) {
    return stored ? { ...stored, country } : null;
  }
  if (!stored) return live;

  return {
    ...stored,
    itunesArtistId: live.itunesArtistId || stored.itunesArtistId,
    title: live.title || stored.title,
    normalizedTitle: live.normalizedTitle || stored.normalizedTitle,
    artistName: live.artistName || stored.artistName,
    normalizedArtistName: live.normalizedArtistName || stored.normalizedArtistName,
    genre: live.genre || stored.genre,
    label: live.label || stored.label,
    country: live.country || country,
    storeUrl: live.storeUrl || stored.storeUrl,
    artworkUrl: live.artworkUrl || stored.artworkUrl,
    artworkSource: live.artworkSource || stored.artworkSource,
    trackCount: live.trackCount || stored.trackCount,
    explicitness: live.explicitness || stored.explicitness,
    releaseDate: live.releaseDate || stored.releaseDate,
    releaseYear: live.releaseYear || stored.releaseYear,
  };
}

function needsBackgroundRefresh(album: Album, country: string): boolean {
  if (!isReliableVisualAnalysis(album) || album.artworkSource === 'seed' || album.country !== country) {
    return true;
  }
  const updatedAt = album.updatedAt ? Date.parse(album.updatedAt) : Number.NaN;
  return !Number.isFinite(updatedAt) || Date.now() - updatedAt > 1000 * 60 * 60 * 6;
}

async function refreshAndPersistAlbum(album: Album, country: string): Promise<void> {
  try {
    const { album: live } = await getItunesAlbumById(album.itunesCollectionId, country, false);
    const refreshed = mergeAlbumMetadata(album, live, country) || album;
    const enriched = await enrichAlbumWithArtwork(refreshed);
    await saveAlbumToDb(enriched);
  } catch (error) {
    console.warn(`Album ${album.itunesCollectionId} background refresh failed:`, error);
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const collectionId = parseInt(id, 10);
  const searchParams = request.nextUrl.searchParams;
  const country = normalizeStorefront(searchParams.get('country'));

  if (isNaN(collectionId)) {
    return NextResponse.json({ error: 'Invalid album ID' }, { status: 400 });
  }

  try {
    const storedAlbum = await getAlbumFromDb(collectionId);
    if (storedAlbum && storedAlbum.artworkSource !== 'seed') {
      const album = { ...storedAlbum, country };
      if (needsBackgroundRefresh(storedAlbum, country)) {
        after(() => refreshAndPersistAlbum(storedAlbum, country));
      }
      return NextResponse.json(
        { album: { ...album, embedding: undefined, perceptualHash: undefined } },
        { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600' } },
      );
    }

    const { album: fetchedAlbum } = await getItunesAlbumById(collectionId, country, false);
    const album = mergeAlbumMetadata(storedAlbum, fetchedAlbum, country);

    if (!album) {
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }

    // Album metadata is enough to paint the page. Real-pixel analysis and the
    // write-through catalog update continue after the response.
    after(() => refreshAndPersistAlbum(album, country));
    return NextResponse.json(
      { album: { ...album, embedding: undefined, perceptualHash: undefined } },
      { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600' } },
    );
  } catch (error: any) {
    console.error(`API /api/albums/${id} error:`, error);
    return NextResponse.json({ error: error.message || 'Album lookup failed' }, { status: 500 });
  }
}
