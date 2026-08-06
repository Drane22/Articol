import { NextRequest, NextResponse } from 'next/server';
import { getAllCatalogAlbums, saveAlbumsToDb } from '@/lib/db';
import { getColorCategory, matchesColorFilter } from '@/lib/colorUtils';
import { enrichAlbumWithArtwork } from '@/lib/itunes';
import { Album } from '@/lib/types';
import { isReliableVisualAnalysis } from '@/lib/visualValidation';

async function getFeaturedSpotlightAlbums(): Promise<Album[]> {
  const catalogAlbums = await getAllCatalogAlbums();
  const validSeeds = catalogAlbums.filter(a => Boolean(a.artworkUrl));

  // Fisher-Yates shuffle for unbiased dynamic rotation.
  const shuffled = [...validSeeds];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  if (shuffled.length >= 6) {
    return shuffled.slice(0, 6);
  }

  return validSeeds.slice(0, 6);
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const collection = searchParams.get('collection') || '';
  const filter = searchParams.get('filter') || '';
  const colorHex = searchParams.get('color') || '';
  const decade = searchParams.get('decade') || '';
  const genre = searchParams.get('genre') || '';
  const featured = searchParams.get('featured') === 'true';

  if (featured) {
    const albums = await getFeaturedSpotlightAlbums();
    await saveAlbumsToDb(albums);
    return NextResponse.json(
      { count: albums.length, albums, partial: albums.length < 6 },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  }

  let albums = await getAllCatalogAlbums();

  // 1. Predefined Collections Filter
  if (collection) {
    switch (collection.toLowerCase()) {
      case 'quiet minimalism':
        albums = albums.filter(a => a.visualFeatures.minimalismScore > 0.6 || a.visualFeatures.textRatio < 0.1);
        break;
      case 'red and black':
        albums = albums.filter(a => {
          const hexes = a.dominantPalette.map(p => p.hex.toLowerCase());
          return hexes.some(h => getColorCategory(h) === 'red') && hexes.some(h => getColorCategory(h) === 'black' || getColorCategory(h) === 'monochrome');
        });
        break;
      case 'dreamlike portraits':
        albums = albums.filter(a => a.visualFeatures.portraitProb > 0.6);
        break;
      case 'hand-drawn worlds':
        albums = albums.filter(a => a.visualFeatures.illustrationProb > 0.6);
        break;
      case 'brutalist type':
        albums = albums.filter(a => a.visualFeatures.textRatio > 0.2 || (a.visualFeatures.monochromeScore > 0.7 && a.visualFeatures.textRatio > 0.15));
        break;
      case 'analog grain':
        albums = albums.filter(a => a.visualFeatures.photographyProb > 0.6 && a.visualFeatures.edgeDensity > 0.35);
        break;
      case 'soft pastels':
        albums = albums.filter(a => a.visualFeatures.saturation > 0.25 && a.visualFeatures.luminance > 0.6);
        break;
      case 'dark monochrome':
        albums = albums.filter(a => a.visualFeatures.monochromeScore > 0.6 || a.visualFeatures.luminance < 0.3);
        break;
      case 'maximalist collage':
        albums = albums.filter(a => a.visualFeatures.collageProb > 0.6 || a.visualFeatures.visualEntropy > 0.7);
        break;
      default:
        break;
    }
  }

  // 2. Color spectrum filter
  if (colorHex) {
    const candidatesToAnalyze = albums
      .filter((album) => !isReliableVisualAnalysis(album))
      .slice(0, 48);
    if (candidatesToAnalyze.length > 0) {
      const analyzedCandidates = await Promise.all(
        candidatesToAnalyze.map((album) => enrichAlbumWithArtwork(album))
      );
      const analyzedById = new Map(
        analyzedCandidates.map((album) => [album.itunesCollectionId, album])
      );
      albums = albums.map((album) => analyzedById.get(album.itunesCollectionId) || album);
      await saveAlbumsToDb(analyzedCandidates);
    }

    // Do not make color claims from deterministic fallback palettes. They are
    // metadata-generated and do not describe the actual cover image.
    albums = albums.filter(isReliableVisualAnalysis);
    albums = albums.filter(a => matchesColorFilter(colorHex, a.dominantPalette || []));
  }

  // 3. Visual attribute filter
  if (filter) {
    switch (filter.toLowerCase()) {
      case 'minimal':
        albums = albums.filter(a => a.visualFeatures.minimalismScore > 0.6);
        break;
      case 'portrait':
        albums = albums.filter(a => a.visualFeatures.portraitProb > 0.5);
        break;
      case 'illustrated':
        albums = albums.filter(a => a.visualFeatures.illustrationProb > 0.5);
        break;
      case 'abstract':
        albums = albums.filter(a => a.visualFeatures.abstractProb > 0.5);
        break;
      case 'monochrome':
        albums = albums.filter(a => a.visualFeatures.monochromeScore > 0.5);
        break;
      case 'warm':
        albums = albums.filter(a => a.visualFeatures.warmCool > 0.2);
        break;
      case 'cool':
        albums = albums.filter(a => a.visualFeatures.warmCool < -0.2);
        break;
      default:
        break;
    }
  }

  // 4. Decade filter
  if (decade) {
    const startYear = parseInt(decade, 10);
    if (!isNaN(startYear)) {
      albums = albums.filter(a => a.releaseYear >= startYear && a.releaseYear < startYear + 10);
    }
  }

  // 5. Genre filter
  if (genre) {
    albums = albums.filter(a => a.genre.toLowerCase().includes(genre.toLowerCase()));
  }

  // Discovery is an interaction with the catalog: persist the visible rows so
  // an initially empty Supabase project grows beyond the bundled fallback.
  await saveAlbumsToDb(albums.slice(0, 100));

  return NextResponse.json(
    { count: albums.length, albums },
    { headers: { 'Cache-Control': 'private, no-store' } }
  );
}
