import { NextRequest, NextResponse } from 'next/server';
import { getItunesAlbumById, enrichAlbumWithArtwork, refreshSeedAlbum } from '@/lib/itunes';
import { getAlbumFromDb, saveAlbumToDb } from '@/lib/db';
import { Album } from '@/lib/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const collectionId = parseInt(id, 10);
  const searchParams = request.nextUrl.searchParams;
  const country = searchParams.get('country') || 'PH';

  if (isNaN(collectionId)) {
    return NextResponse.json({ error: 'Invalid album ID' }, { status: 400 });
  }

  try {
    let album: Album | null = await getAlbumFromDb(collectionId);

    if (!album) {
      const { album: fetchedAlbum, tracks } = await getItunesAlbumById(collectionId, country);
      if (fetchedAlbum) {
        album = { ...fetchedAlbum, tracks };
      }
    }

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
