import { NextRequest, NextResponse } from 'next/server';
import { getAllSeedAlbums } from '@/lib/db';
import { getColorCategory } from '@/lib/colorUtils';
import { Album } from '@/lib/types';
import { findItunesAlbumExact } from '@/lib/itunes';
import { BoundedTtlCache, InflightRequests } from '@/lib/boundedCache';

const HOMEPAGE_FEATURES = [
  { title: 'Abbey Road', artist: 'The Beatles' },
  { title: 'Kind of Blue', artist: 'Miles Davis' },
  { title: 'The Dark Side of the Moon', artist: 'Pink Floyd' },
  { title: 'Blonde', artist: 'Frank Ocean' },
  { title: 'IGOR', artist: 'Tyler, The Creator' },
  { title: 'Currents', artist: 'Tame Impala' },
  { title: 'Thriller', artist: 'Michael Jackson' },
  { title: 'Rumours', artist: 'Fleetwood Mac' },
  { title: 'Nevermind', artist: 'Nirvana' },
  { title: 'Back to Black', artist: 'Amy Winehouse' },
  { title: 'In Rainbows', artist: 'Radiohead' },
  { title: 'Melodrama', artist: 'Lorde' },
];

const featuredCache = new BoundedTtlCache<Album[]>({
  maxEntries: 10,
  ttlMs: 1000 * 60 * 60 * 12, // 12 hours
});
const featuredInflight = new InflightRequests<Album[]>();

async function getFeaturedSpotlightAlbums(country: string): Promise<Album[]> {
  const cacheKey = `featured-${country}`;
  const cached = featuredCache.get(cacheKey);
  if (cached) return cached;

  return featuredInflight.run(cacheKey, async () => {
    const seedAlbums = await getAllSeedAlbums();
    const resolved = await Promise.all(HOMEPAGE_FEATURES.map(async feature => {
      const match = seedAlbums.find(s =>
        s.normalizedTitle.includes(feature.title.toLowerCase()) ||
        s.normalizedArtistName.includes(feature.artist.toLowerCase())
      );
      if (match) return match;
      return findItunesAlbumExact(feature.title, feature.artist, country);
    }));

    const albums = resolved.filter((album): album is Album => Boolean(album?.artworkUrl)).slice(0, 6);
    featuredCache.set(cacheKey, albums);
    return albums;
  });
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
    const country = searchParams.get('country') || 'PH';
    const albums = await getFeaturedSpotlightAlbums(country);
    return NextResponse.json(
      { count: albums.length, albums, partial: albums.length < 6 },
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } }
    );
  }

  let albums = await getAllSeedAlbums();

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
    const targetCategory = getColorCategory(colorHex);
    albums = albums.filter(a =>
      a.dominantPalette.some(p => getColorCategory(p.hex) === targetCategory)
    );
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

  return NextResponse.json(
    { count: albums.length, albums },
    { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } }
  );
}
