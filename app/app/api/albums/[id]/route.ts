import { NextRequest, NextResponse } from 'next/server';
import { getItunesAlbumById, enrichAlbumWithArtwork, refreshSeedAlbum } from '@/lib/itunes';
import { getAlbumFromDb, saveAlbumToDb } from '@/lib/db';
import { Album } from '@/lib/types';
import { normalizeStorefront } from '@/lib/storefronts';

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
    const { album: fetchedAlbum, tracks } = await getItunesAlbumById(collectionId, country);
    let album: Album | null = fetchedAlbum
      ? storedAlbum
        ? {
            ...storedAlbum,
            country: fetchedAlbum.country,
            price: fetchedAlbum.price,
            currency: fetchedAlbum.currency,
            storeUrl: fetchedAlbum.storeUrl,
            artworkUrl: fetchedAlbum.artworkUrl || storedAlbum.artworkUrl,
            trackCount: fetchedAlbum.trackCount,
            explicitness: fetchedAlbum.explicitness,
            releaseDate: fetchedAlbum.releaseDate || storedAlbum.releaseDate,
            releaseYear: fetchedAlbum.releaseYear || storedAlbum.releaseYear,
            tracks,
          }
        : { ...fetchedAlbum, tracks }
      : storedAlbum
        ? {
            ...storedAlbum,
            country: country.toUpperCase(),
            price: undefined,
            currency: undefined,
            storeUrl: undefined,
          }
        : null;

    if (!album) {
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }

    album = await refreshSeedAlbum(album, country);
    album = await enrichAlbumWithArtwork(album);
    // Persist metadata even when artwork analysis falls back. Otherwise an
    // empty Supabase catalog never learns from normal album interactions.
    await saveAlbumToDb(album);
    return NextResponse.json(
      { album: { ...album, embedding: undefined, perceptualHash: undefined } },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error: any) {
    console.error(`API /api/albums/${id} error:`, error);
    return NextResponse.json({ error: error.message || 'Album lookup failed' }, { status: 500 });
  }
}
