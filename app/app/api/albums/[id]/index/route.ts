import { NextRequest, NextResponse } from 'next/server';
import { getItunesAlbumById } from '@/lib/itunes';
import { extractVisualFeaturesFromImage } from '@/lib/featureExtractor';
import { saveAlbumToDb } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const collectionId = parseInt(id, 10);
  const authHeader = request.headers.get('authorization');
  const expectedSecret = process.env.INDEXING_SECRET;

  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'Unauthorized indexing request' }, { status: 401 });
  }

  if (isNaN(collectionId)) {
    return NextResponse.json({ error: 'Invalid collection ID' }, { status: 400 });
  }

  try {
    const { album } = await getItunesAlbumById(collectionId);
    if (!album) {
      return NextResponse.json({ error: 'Album not found on iTunes' }, { status: 404 });
    }

    // Proxy image download server-side for indexing
    let imageBuffer: Buffer | null = null;
    try {
      const imgRes = await fetch(album.artworkUrl, {
        headers: { 'User-Agent': 'Articol-Indexer/1.0' },
        cache: 'no-store',
      });
      if (imgRes.ok) {
        const arrayBuf = await imgRes.arrayBuffer();
        imageBuffer = Buffer.from(arrayBuf);
      }
    } catch (err) {
      console.warn('Artwork download during indexing failed, using fallback generator:', err);
    }

    // Process image feature extraction & CLIP embedding
    const { palette, features, embedding, perceptualHash } = await extractVisualFeaturesFromImage(
      imageBuffer,
      `${collectionId}-${album.title}`
    );

    album.dominantPalette = palette;
    album.visualFeatures = features;
    album.embedding = embedding;
    album.perceptualHash = perceptualHash;
    album.visualAnalysisStatus = perceptualHash ? 'analyzed' : 'fallback';
    album.embeddingModel = perceptualHash ? 'spatial-palette-descriptor' : 'seed-fallback';
    album.embeddingVersion = perceptualHash ? 'visual-grid-v2' : 'fallback-v1';

    await saveAlbumToDb(album);

    return NextResponse.json({
      success: true,
      indexedId: collectionId,
      album,
    });
  } catch (error: any) {
    console.error(`API /api/albums/${id}/index error:`, error);
    return NextResponse.json({ error: error.message || 'Indexing failed' }, { status: 500 });
  }
}
