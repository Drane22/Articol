import { NextRequest, NextResponse } from 'next/server';
import { getAllCatalogAlbums } from '@/lib/db';
import { matchesColorFilter } from '@/lib/colorUtils';
import { Album } from '@/lib/types';
import { isReliableVisualAnalysis } from '@/lib/visualValidation';
import { getCuratedVisualCollection, rankCuratedVisualAlbums } from '@/lib/curatedCollections';

const CACHE_HEADERS = { 'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600' };

function displayAlbum(album: Album): Album {
  const { embedding, perceptualHash, visualAnalysisError, artworkChecksum, ...display } = album;
  return display;
}

function pageInteger(value: string | null, fallback: number, max: number): number {
  if (value === null || !/^\d+$/.test(value)) return fallback;
  return Math.min(Number(value), max);
}

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
    return NextResponse.json(
      { count: albums.length, albums: albums.map(displayAlbum), partial: albums.length < 6 },
      { headers: CACHE_HEADERS }
    );
  }

  let albums = await getAllCatalogAlbums();

  // 1. Curated collections use the same strict, scored visual vocabulary in
  // the API and the Explore UI. Unknown values intentionally fall through.
  const curatedCollection = getCuratedVisualCollection(collection);
  if (curatedCollection) {
    albums = rankCuratedVisualAlbums(albums, curatedCollection);
  }

  // 2. Color spectrum filter
  if (colorHex) {
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

  // Browsing is read-only. Indexing/population owns artwork analysis and writes.
  const limit = Math.max(1, pageInteger(searchParams.get('limit'), 48, 96));
  const offset = pageInteger(searchParams.get('offset'), 0, Number.MAX_SAFE_INTEGER);
  const page = albums.slice(offset, offset + limit);
  const nextOffset = offset + page.length < albums.length ? offset + page.length : null;

  return NextResponse.json(
    { count: albums.length, albums: page.map(displayAlbum), nextOffset },
    { headers: CACHE_HEADERS }
  );
}
