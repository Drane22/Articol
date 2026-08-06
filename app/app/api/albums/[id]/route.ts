import { NextRequest, NextResponse } from 'next/server';
import { getItunesAlbumById, enrichAlbumWithArtwork, refreshSeedAlbum } from '@/lib/itunes';
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
    // Album detail is API-first. Automatic browsing never inserts catalog rows.
    const { album: fetchedAlbum, tracks } = await getItunesAlbumById(collectionId, country);
    if (!fetchedAlbum) {
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }
    let album: Album = { ...fetchedAlbum, tracks };

    album = await refreshSeedAlbum(album, country);

    // 3. Enrich with real artwork analysis (downloads the cover image
    //    and extracts actual dominant palette & visual features).
    album = await enrichAlbumWithArtwork(album);
    return NextResponse.json(
      { album: { ...album, embedding: undefined, perceptualHash: undefined } },
      { headers: { 'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=86400' } },
    );
  } catch (error: any) {
    console.error(`API /api/albums/${id} error:`, error);
    return NextResponse.json({ error: error.message || 'Album lookup failed' }, { status: 500 });
  }
}
