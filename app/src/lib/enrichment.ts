import { Album } from './types';
import { searchItunesAlbums } from './itunes';
import { getCatalogCandidates } from './db';
import { BoundedTtlCache, InflightRequests } from './boundedCache';

const LASTFM_API_KEY = process.env.LASTFM_API_KEY || '';

const candidatePoolCache = new BoundedTtlCache<{ candidates: Album[]; lastFmScores: Record<number, number> }>({
  maxEntries: 64,
  ttlMs: 1000 * 30, // Newly indexed albums should enter the next interaction.
});

const inflightPoolRequests = new InflightRequests<{ candidates: Album[]; lastFmScores: Record<number, number> }>();

interface SimilarArtistMatch {
  name: string;
  matchScore: number;
}

// Fetch similar artists from Last.fm API if key is present, otherwise fallback
export async function getSimilarArtistsFromLastFm(artistName: string): Promise<SimilarArtistMatch[]> {
  if (!LASTFM_API_KEY) {
    return [];
  }

  const url = `https://ws.audioscrobbler.com/2.0/?method=artist.getsimilar&artist=${encodeURIComponent(artistName)}&api_key=${LASTFM_API_KEY}&format=json&limit=6`;

  try {
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) return [];

    const data = await res.json();
    const artistList = data.similarartists?.artist || [];

    return artistList.map((a: any) => ({
      name: a.name,
      matchScore: parseFloat(a.match) || 0.5,
    }));
  } catch (err) {
    console.warn('Last.fm artist.getSimilar failed:', err);
    return [];
  }
}

// Internal uncached pool generation
async function buildCandidatePool(
  queryAlbum: Album,
  country: string = 'PH',
  poolLimit: number = 500,
): Promise<{ candidates: Album[]; lastFmScores: Record<number, number> }> {
  const candidatesMap = new Map<number, Album>();
  const lastFmScores: Record<number, number> = {};

  const addCandidate = (alb: Album, score: number = 0) => {
    if (
      alb.itunesCollectionId === queryAlbum.itunesCollectionId
    ) return;

    if (!candidatesMap.has(alb.itunesCollectionId)) candidatesMap.set(alb.itunesCollectionId, alb);
    lastFmScores[alb.itunesCollectionId] = Math.max(lastFmScores[alb.itunesCollectionId] || 0, score);
  };

  // 1. Include the current Supabase-first catalog.
  try {
    const catalogAlbums = await getCatalogCandidates(queryAlbum, poolLimit);
    for (const alb of catalogAlbums) {
      addCandidate(alb, 0);
    }
  } catch (e) {
    console.warn('Catalog inclusion failed:', e);
  }

  // 2. Search for albums sharing the same genre (expanded to 30 limit)
  try {
    const genreAlbums = await searchItunesAlbums(queryAlbum.genre, country, 30);
    for (const alb of genreAlbums) {
      addCandidate(alb, 0);
    }
  } catch (e) {
    console.warn('Genre candidate fetch failed:', e);
  }

  // 3. Fetch similar artists via Last.fm and resolve top albums
  const similarArtists = await getSimilarArtistsFromLastFm(queryAlbum.artistName);
  if (similarArtists.length > 0) {
    for (const simArtist of similarArtists.slice(0, 4)) {
      try {
        const simAlbums = await searchItunesAlbums(simArtist.name, country, 5);
        for (const alb of simAlbums) {
          addCandidate(alb, simArtist.matchScore);
        }
      } catch (e) {
        // Continue silently
      }
    }
  } else {
    // Fallback search when Last.fm key is absent: search genre + decade/era
    try {
      const eraTerm = `${queryAlbum.genre} ${queryAlbum.releaseYear ? Math.floor(queryAlbum.releaseYear / 10) * 10 : ''}`;
      const eraAlbums = await searchItunesAlbums(eraTerm, country, 15);
      for (const alb of eraAlbums) {
        addCandidate(alb, 0);
      }
    } catch (e) {
      // Continue silently
    }
  }

  return {
    candidates: Array.from(candidatesMap.values()),
    lastFmScores,
  };
}

// Public candidate pool generator with TTL caching & request deduplication
export async function generateCandidatePool(
  queryAlbum: Album,
  country: string = 'PH',
  poolLimit: number = 500,
): Promise<{ candidates: Album[]; lastFmScores: Record<number, number> }> {
  const boundedPoolLimit = Math.min(Math.max(poolLimit, 50), 500);
  const cacheKey = `pool-${queryAlbum.itunesCollectionId}-${country}-${boundedPoolLimit}`;
  const cached = candidatePoolCache.get(cacheKey);
  if (cached) return cached;

  return inflightPoolRequests.run(cacheKey, async () => {
    const pool = await buildCandidatePool(queryAlbum, country, boundedPoolLimit);
    candidatePoolCache.set(cacheKey, pool);
    return pool;
  });
}
