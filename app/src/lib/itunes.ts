import { Album, AlbumTrack } from './types';
import { extractVisualFeaturesFromImage, extractFeaturesFromUrl } from './featureExtractor';
import { BoundedTtlCache, InflightRequests } from './boundedCache';

const ITUNES_BASE_URL = 'https://itunes.apple.com';
const CACHE_TTL_MS = 1000 * 60 * 5; // Keep metadata fresh while deduplicating bursts.
const apiCache = new BoundedTtlCache<any>({ maxEntries: 128, ttlMs: CACHE_TTL_MS });
const artworkCache = new BoundedTtlCache<ArtworkAnalysis>({
  maxEntries: 256,
  ttlMs: 1000 * 60 * 60 * 24,
});
const artworkRequests = new InflightRequests<ArtworkAnalysis>();

interface ArtworkAnalysis {
  palette: Album['dominantPalette'];
  features: Album['visualFeatures'];
  embedding: number[];
  perceptualHash?: string;
  resolvedArtworkUrl?: string;
  analyzed: boolean;
}

// Helper to upgrade iTunes low-res artwork URL to high-resolution
export function getHighResArtworkUrl(url: string, size: number = 600): string {
  if (!url) return '';
  return url
    .replace(/\d+x\d+(bb)?\.(jpe?g|png|webp)/i, `${size}x${size}bb.$2`);
}

// ─────────────────────────────────────────────────────────────
// Build a rich, UNIQUE seed string per album so the seeded RNG
// in featureExtractor produces different results for every album.
// ─────────────────────────────────────────────────────────────
function buildAlbumSeed(rawItem: any): string {
  return [
    rawItem.collectionId,
    rawItem.collectionName || '',
    rawItem.artistName || '',
    rawItem.primaryGenreName || '',
    rawItem.releaseDate?.slice(0, 4) || '',
    rawItem.trackCount || 0,
    rawItem.artworkUrl100 || '',
  ].join('|');
}

// ─────────────────────────────────────────────────────────────
// Normalise a raw iTunes collection result into an Album object.
// Uses seed-based feature generation (fast, no image download).
// ─────────────────────────────────────────────────────────────
export async function normalizeItunesAlbum(rawItem: any): Promise<Album> {
  const collectionId = rawItem.collectionId;
  const title = rawItem.collectionName || 'Untitled Album';
  const artistName = rawItem.artistName || 'Unknown Artist';
  const rawArtwork = rawItem.artworkUrl100 || rawItem.artworkUrl60 || '';
  const highResArtwork = getHighResArtworkUrl(rawArtwork, 600);

  const releaseDateStr = rawItem.releaseDate || '';
  const releaseYear = releaseDateStr ? new Date(releaseDateStr).getFullYear() : 2020;

  const seed = buildAlbumSeed(rawItem);
  const { palette, features, embedding } = await extractVisualFeaturesFromImage(null, seed);

  return {
    id: `itunes-${collectionId}`,
    itunesCollectionId: collectionId,
    itunesArtistId: rawItem.artistId,
    title,
    normalizedTitle: title.toLowerCase().trim(),
    artistName,
    normalizedArtistName: artistName.toLowerCase().trim(),
    genre: rawItem.primaryGenreName || 'Music',
    releaseDate: releaseDateStr,
    releaseYear: isNaN(releaseYear) ? 2020 : releaseYear,
    country: rawItem.country || 'PH',
    trackCount: rawItem.trackCount || 1,
    explicitness: rawItem.collectionExplicitness || 'notExplicit',
    price: rawItem.collectionPrice || 0,
    currency: rawItem.currency || 'USD',
    artworkUrl: highResArtwork || rawArtwork,
    artworkSource: 'itunes',
    storeUrl: rawItem.collectionViewUrl || '',
    copyright: rawItem.copyright,
    dominantPalette: palette,
    visualFeatures: features,
    embedding,
    embeddingModel: 'seed-fallback',
    embeddingVersion: 'fallback-v1',
    visualAnalysisStatus: 'fallback',
  } as Album;
}

// ─────────────────────────────────────────────────────────────
// Enrich an album by downloading its artwork and extracting
// real palette + features.  Called on the album detail page
// so only a single image is downloaded, keeping it fast.
// ─────────────────────────────────────────────────────────────
export async function enrichAlbumWithArtwork(album: Album): Promise<Album> {
  if (!album.artworkUrl) return { ...album, visualAnalysisStatus: 'fallback' };
  if (album.visualAnalysisStatus === 'analyzed' && album.perceptualHash && album.embeddingVersion === 'visual-grid-v2') return album;

  const cacheKey = `${album.artworkUrl}|visual-grid-v2`;
  let analysis = artworkCache.get(cacheKey);

  if (!analysis) {
    analysis = await artworkRequests.run(cacheKey, async () => {
      const seed = `${album.itunesCollectionId}|${album.title}|${album.artistName}`;
      try {
        const extracted = await extractFeaturesFromUrl(album.artworkUrl, seed);
        const result: ArtworkAnalysis = extracted;
        // Successful analyses live for a day. Failed URLs are held briefly so a
        // broken cover cannot be redownloaded repeatedly during one browsing session.
        artworkCache.set(cacheKey, result, extracted.analyzed ? undefined : 1000 * 60 * 5);
        if (extracted.resolvedArtworkUrl && extracted.resolvedArtworkUrl !== album.artworkUrl) {
          artworkCache.set(`${extracted.resolvedArtworkUrl}|visual-grid-v2`, result);
        }
        return result;
      } catch (error) {
        console.warn('enrichAlbumWithArtwork failed:', error);
        const fallback = await extractVisualFeaturesFromImage(null, seed);
        const result: ArtworkAnalysis = { ...fallback, analyzed: false };
        artworkCache.set(cacheKey, result, 1000 * 60 * 5);
        return result;
      }
    });
  }

  const { palette, features, embedding, perceptualHash, analyzed, resolvedArtworkUrl } = analysis;
    return {
      ...album,
      artworkUrl: resolvedArtworkUrl || album.artworkUrl,
      dominantPalette: palette,
      visualFeatures: features,
      embedding,
      embeddingModel: analyzed ? 'spatial-palette-descriptor' : 'seed-fallback',
      embeddingVersion: analyzed ? 'visual-grid-v2' : 'fallback-v1',
      perceptualHash,
      visualAnalysisStatus: analyzed ? 'analyzed' : 'fallback',
    };
}

export function isSameAlbumIdentity(expected: Album, resolved: Album): boolean {
  return normalizeAlbumIdentityTitle(expected.normalizedTitle) === normalizeAlbumIdentityTitle(resolved.normalizedTitle) &&
    expected.normalizedArtistName === resolved.normalizedArtistName;
}

export function normalizeAlbumIdentityTitle(title: string): string {
  const editionSuffix = /\s*(?:\([^)]*\)|\[[^\]]*\])\s*$/;
  return title.toLowerCase().trim()
    .replace(editionSuffix, '')
    .replace(editionSuffix, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function findItunesAlbumExact(
  title: string,
  artistName: string,
  country: string = 'PH',
): Promise<Album | null> {
  const normalizedTitle = title.toLowerCase().trim();
  const normalizedArtist = artistName.toLowerCase().trim();
  const storefronts = country === 'US' ? ['US'] : [country, 'US'];
  const queries: Array<{ term: string; titleOnly: boolean }> = [
    { term: `${title} ${artistName}`, titleOnly: false },
    { term: title, titleOnly: true },
  ];

  for (const storefront of storefronts) {
    for (const query of queries) {
      const results = await searchItunesAlbums(query.term, storefront, 50, query.titleOnly);
      const exact = results.find(candidate =>
        normalizeAlbumIdentityTitle(candidate.normalizedTitle) === normalizeAlbumIdentityTitle(normalizedTitle) &&
        candidate.normalizedArtistName === normalizedArtist
      );
      if (exact) return exact;
    }
  }
  return null;
}

export async function refreshSeedAlbum(album: Album, country: string = 'PH'): Promise<Album> {
  if (album.artworkSource !== 'seed') return album;

  const byId = await getItunesAlbumById(album.itunesCollectionId, country);
  if (
    byId.album?.artworkUrl &&
    isSameAlbumIdentity(album, byId.album)
  ) return { ...byId.album, tracks: byId.tracks };

  return await findItunesAlbumExact(album.title, album.artistName, country) || {
    ...album,
    artworkUrl: '',
    visualAnalysisStatus: 'fallback',
  };
}

export async function enrichAlbumsWithArtwork(albums: Album[], concurrency: number = 4): Promise<Album[]> {
  const results: Album[] = new Array(albums.length);
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < albums.length) {
      const index = nextIndex++;
      results[index] = await enrichAlbumWithArtwork(albums[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, albums.length) }, worker));
  return results;
}

// ─────────────────────────────────────────────────────────────
// Search albums via iTunes Search API
// ─────────────────────────────────────────────────────────────
export async function searchItunesAlbums(
  query: string,
  country: string = 'PH',
  limit: number = 25,
  titleOnly: boolean = false,
): Promise<Album[]> {
  if (!query || !query.trim()) return [];

  const cacheKey = `search-${query.trim().toLowerCase()}-${country}-${limit}-${titleOnly ? 'title' : 'all'}`;
  const cached = apiCache.get(cacheKey);
  if (cached) return cached;

  const encodedQuery = encodeURIComponent(query.trim());
  const attribute = titleOnly ? '&attribute=albumTerm' : '';
  const url = `${ITUNES_BASE_URL}/search?term=${encodedQuery}&media=music&entity=album${attribute}&country=${country}&limit=${limit}`;

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Articol/1.0' },
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      throw new Error(`iTunes API search error: ${response.status}`);
    }

    const data = await response.json();
    const results = data.results || [];

    const albums: Album[] = [];
    const seenIdentities = new Set<string>();
    for (const item of results) {
      if (item.collectionId && item.collectionName) {
        const alb = await normalizeItunesAlbum(item);
        const identity = `${normalizeAlbumIdentityTitle(alb.normalizedTitle)}|${alb.normalizedArtistName}`;
        if (!seenIdentities.has(identity)) {
          seenIdentities.add(identity);
          albums.push(alb);
        }
      }
    }

    apiCache.set(cacheKey, albums);
    return albums;
  } catch (error) {
    console.error('iTunes Search API failed:', error);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────
// Fetch single album by iTunes Collection ID + track list
// ─────────────────────────────────────────────────────────────
export async function getItunesAlbumById(
  collectionId: number | string,
  country: string = 'PH',
): Promise<{ album: Album | null; tracks: AlbumTrack[] }> {
  const cacheKey = `lookup-${collectionId}-${country}`;
  const cached = apiCache.get(cacheKey);
  if (cached) return cached;

  const fetchLookup = async (storefront: string) => {
    const url = `${ITUNES_BASE_URL}/lookup?id=${collectionId}&entity=song&country=${storefront}`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Articol/1.0' },
      next: { revalidate: 300 },
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.results || [];
  };

  try {
    let results: any[] | null = null;
    const storefronts = Array.from(new Set([country.toUpperCase(), 'US', 'GB', 'JP']));

    for (const sf of storefronts) {
      results = await fetchLookup(sf);
      if (results && results.length > 0) break;
    }

    if (!results || results.length === 0) {
      return { album: null, tracks: [] };
    }

    const collectionRaw =
      results.find((r: any) => r.wrapperType === 'collection') || results[0];
    const trackRaws = results.filter((r: any) => r.wrapperType === 'track');

    const album = await normalizeItunesAlbum(collectionRaw);

    const tracks: AlbumTrack[] = trackRaws.map((t: any) => ({
      trackId: t.trackId,
      trackName: t.trackName || 'Untitled Track',
      trackNumber: t.trackNumber || 1,
      durationMs: t.trackTimeMillis || 180000,
      previewUrl: t.previewUrl || '',
    }));

    album.tracks = tracks;

    const resultData = { album, tracks };
    apiCache.set(cacheKey, resultData);
    return resultData;
  } catch (error) {
    console.error('iTunes Lookup API failed:', error);
    return { album: null, tracks: [] };
  }
}
