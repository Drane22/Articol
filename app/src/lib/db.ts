import { Album, RecommendationTiers, SearchMode, SimilarityResult } from './types';
import { SEED_ALBUMS, initSeedAlbums } from '../data/seedCatalog';
import { calculatePaletteCompatibility, rankDistinctRecommendationTiers } from './visualEngine';
import { BoundedTtlCache, InflightRequests } from './boundedCache';
import { hexToRgb, rgbToLab } from './colorUtils';
import { isReliableVisualAnalysis } from './visualValidation';
import { MAX_PALETTE_COLORS } from './palette';

// The process-local map is a fast fallback and a write-through view of the catalog.
const memoryStore = new Map<number, Album>();
let seedLoadPromise: Promise<void> | null = null;

const catalogCache = new BoundedTtlCache<Album[]>({ maxEntries: 1, ttlMs: 1000 * 30 });
const catalogRequests = new InflightRequests<Album[]>();
const supabaseClients = new Map<string, Promise<any>>();

async function ensureSeedsLoaded(): Promise<void> {
  if (!seedLoadPromise) {
    seedLoadPromise = (async () => {
      await initSeedAlbums();
      for (const album of SEED_ALBUMS) memoryStore.set(album.itunesCollectionId, album);
    })();
  }
  await seedLoadPromise;
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function parseEmbedding(value: unknown): number[] | undefined {
  const parsed = parseJson<unknown>(value, []);
  if (!Array.isArray(parsed)) return undefined;
  const embedding = parsed.map(Number);
  return embedding.length > 0 && embedding.every(Number.isFinite) ? embedding : undefined;
}

function normalizePalette(value: unknown): Album['dominantPalette'] {
  const palette = parseJson<unknown[]>(value, []);
  if (!Array.isArray(palette)) return [];
  return palette.flatMap((entry: any) => {
    if (!entry?.hex || typeof entry.hex !== 'string' || !/^#[0-9a-f]{6}$/i.test(entry.hex)) return [];
    const lab = rgbToLab(...hexToRgb(entry.hex));
    return [{ hex: entry.hex, lab, weight: Number(entry.weight) || 0 }];
  }).slice(0, MAX_PALETTE_COLORS);
}

export function mapSupabaseAlbumRow(data: any): Album {
  const collectionId = Number(data?.itunes_collection_id);
  if (!Number.isFinite(collectionId)) throw new Error('Supabase album row has no valid collection ID');

  const title = data.title || 'Untitled Album';
  const artistName = data.artist_name || 'Unknown Artist';

  const embeddingModel = data.embedding_model || undefined;
  const embeddingVersion = data.embedding_version || undefined;
  const storedStatus = data.visual_analysis_status || 'fallback';
  const isSyntheticVisualData = embeddingModel === 'seed-fallback' || embeddingVersion === 'fallback-v1';

  return {
    id: String(data.id ?? `supabase-${collectionId}`),
    itunesCollectionId: collectionId,
    itunesArtistId: data.itunes_artist_id == null ? undefined : Number(data.itunes_artist_id),
    title,
    normalizedTitle: data.normalized_title || title.toLowerCase().trim(),
    artistName,
    normalizedArtistName: data.normalized_artist_name || artistName.toLowerCase().trim(),
    genre: data.genre || 'Music',
    styles: parseJson<string[]>(data.styles, []),
    label: data.label || undefined,
    releaseDate: data.release_date || '',
    releaseYear: Number(data.release_year) || 0,
    country: data.country || 'PH',
    trackCount: Number(data.track_count) || 0,
    explicitness: data.explicitness || 'notExplicit',
    price: data.price == null ? undefined : Number(data.price),
    currency: data.currency || undefined,
    artworkUrl: data.artwork_url || '',
    artworkSource: data.artwork_source || 'itunes',
    storeUrl: data.store_url || '',
    dominantPalette: normalizePalette(data.dominant_palette),
    visualFeatures: parseJson<Album['visualFeatures']>(data.visual_features, {} as Album['visualFeatures']),
    perceptualHash: data.perceptual_hash || undefined,
    embedding: parseEmbedding(data.embedding),
    embeddingModel,
    embeddingVersion,
    featureExtractionVersion: data.feature_extraction_version || undefined,
    scoringVersion: data.scoring_version || undefined,
    artworkChecksum: data.artwork_checksum || undefined,
    visualAnalysisStatus: isSyntheticVisualData ? 'fallback' : storedStatus,
    visualAnalysisError: data.visual_analysis_error || undefined,
    createdAt: data.created_at || undefined,
    updatedAt: data.updated_at || undefined,
  };
}

export function mergeCatalogAlbums(seedAlbums: Album[], remoteAlbums: Album[]): Album[] {
  const merged = new Map<number, Album>();
  for (const album of remoteAlbums) merged.set(album.itunesCollectionId, album);
  for (const album of seedAlbums) {
    if (!merged.has(album.itunesCollectionId)) merged.set(album.itunesCollectionId, album);
  }
  return Array.from(merged.values());
}

function normalizeSupabaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '').replace(/\/rest\/v1$/i, '');
}

function getSupabaseConfig(write = false): { url: string; key: string } | null {
  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const url = normalizeSupabaseUrl(configuredUrl);
  const key = write
    ? process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    : process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return url && key ? { url, key } : null;
}

async function getSupabaseClient(write = false): Promise<any | null> {
  const config = getSupabaseConfig(write);
  if (!config) return null;

  const cacheKey = `${config.url}|${config.key}`;
  let client = supabaseClients.get(cacheKey);
  if (!client) {
    client = import('@supabase/supabase-js').then(({ createClient }) => createClient(config.url, config.key));
    supabaseClients.set(cacheKey, client);
  }
  return client;
}

async function fetchRemoteCatalog(): Promise<Album[] | null> {
  const supabase = await getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('albums')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(2000);

  if (error) throw error;
  return (data || []).flatMap((row: any) => {
    try {
      return [mapSupabaseAlbumRow(row)];
    } catch (error) {
      console.warn('Skipping malformed Supabase album row:', error);
      return [];
    }
  });
}

async function fetchRemoteVisualCandidates(queryAlbum: Album, limit: number): Promise<Album[]> {
  if (!queryAlbum.embedding?.length) return [];
  const supabase = await getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase.rpc('match_album_candidates', {
    query_embedding: queryAlbum.embedding,
    exclude_collection_id: queryAlbum.itunesCollectionId,
    match_count: Math.min(Math.max(limit, 50), 250),
  });
  if (error) throw error;

  return (data || []).flatMap((row: any) => {
    try {
      return [mapSupabaseAlbumRow(row)];
    } catch (mappingError) {
      console.warn('Skipping malformed Supabase visual candidate:', mappingError);
      return [];
    }
  });
}

export async function getAllCatalogAlbums(): Promise<Album[]> {
  await ensureSeedsLoaded();
  const cached = catalogCache.get('catalog');
  if (cached) return cached;

  return catalogRequests.run('catalog', async () => {
    const secondCached = catalogCache.get('catalog');
    if (secondCached) return secondCached;

    const seeds = Array.from(memoryStore.values());
    let remote: Album[] | null = null;
    try {
      remote = await fetchRemoteCatalog();
    } catch (error) {
      console.warn('Supabase catalog read failed; using local fallback:', error);
    }

    const catalog = mergeCatalogAlbums(seeds, remote || []);
    for (const album of catalog) memoryStore.set(album.itunesCollectionId, album);
    // Do not cache a fallback snapshot after a failed remote read.
    if (remote !== null) catalogCache.set('catalog', catalog);
    return catalog;
  });
}

export async function getCatalogCandidates(queryAlbum: Album, limit: number = 200): Promise<Album[]> {
  const catalog = await getAllCatalogAlbums();
  try {
    const visualCandidates = await fetchRemoteVisualCandidates(queryAlbum, limit);
    const queryGenre = queryAlbum.genre.toLowerCase();
    const queryYear = queryAlbum.releaseYear || 0;
    const metadataCandidates = catalog
      .filter((album) => {
        if (album.itunesCollectionId === queryAlbum.itunesCollectionId) return false;
        const sameGenre = queryGenre && album.genre.toLowerCase().includes(queryGenre);
        const nearbyEra = queryYear > 0 && album.releaseYear > 0 && Math.abs(album.releaseYear - queryYear) <= 15;
        return sameGenre || nearbyEra;
      })
      .slice(0, limit);
    const paletteCandidates = isReliableVisualAnalysis(queryAlbum)
      ? catalog
        .filter((album) => album.itunesCollectionId !== queryAlbum.itunesCollectionId && isReliableVisualAnalysis(album))
        .map((album) => ({ album, compatibility: calculatePaletteCompatibility(queryAlbum, album) }))
        .filter((entry) => entry.compatibility >= 0.30)
        .sort((left, right) => right.compatibility - left.compatibility)
        .slice(0, Math.min(limit, 160))
        .map((entry) => entry.album)
      : [];
    const candidates = new Map<number, Album>();
    for (const album of visualCandidates) candidates.set(album.itunesCollectionId, album);
    for (const album of paletteCandidates) candidates.set(album.itunesCollectionId, album);
    for (const album of metadataCandidates) candidates.set(album.itunesCollectionId, album);
    if (candidates.size === 0) {
      for (const album of catalog.slice(0, limit)) candidates.set(album.itunesCollectionId, album);
    }
    return Array.from(candidates.values());
  } catch (error) {
    // The SQL function is optional until the Supabase migration is applied.
    console.warn('Supabase vector candidate query unavailable; using catalog rows:', error);
    return catalog;
  }
}

export async function getAlbumFromDb(collectionId: number): Promise<Album | null> {
  const catalog = await getAllCatalogAlbums();
  return catalog.find((album) => album.itunesCollectionId === collectionId) || null;
}

export async function saveAlbumToDb(album: Album): Promise<void> {
  await saveAlbumsToDb([album]);
}

export async function saveAlbumsToDb(albums: Album[]): Promise<void> {
  await ensureSeedsLoaded();
  const uniqueAlbums = Array.from(
    new Map(albums.map((album) => [album.itunesCollectionId, album])).values()
  );
  if (uniqueAlbums.length === 0) return;

  for (const album of uniqueAlbums) memoryStore.set(album.itunesCollectionId, album);
  catalogCache.delete('catalog');

  const supabase = await getSupabaseClient(true);
  if (!supabase) {
    console.warn(
      'Supabase writes disabled: configure SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) in Vercel.'
    );
    return;
  }

  try {
    const rows = uniqueAlbums.map((album) => ({
      itunes_collection_id: album.itunesCollectionId,
      itunes_artist_id: album.itunesArtistId,
      title: album.title,
      normalized_title: album.normalizedTitle,
      artist_name: album.artistName,
      normalized_artist_name: album.normalizedArtistName,
      genre: album.genre,
      styles: album.styles || [],
      label: album.label,
      release_date: album.releaseDate,
      release_year: album.releaseYear,
      country: album.country,
      track_count: album.trackCount,
      explicitness: album.explicitness,
      price: album.price,
      currency: album.currency,
      artwork_url: album.artworkUrl,
      artwork_source: album.artworkSource,
      store_url: album.storeUrl,
      dominant_palette: album.dominantPalette,
      visual_features: album.visualFeatures,
      embedding: album.embedding,
      embedding_model: album.embeddingModel,
      embedding_version: album.embeddingVersion,
      feature_extraction_version: album.featureExtractionVersion,
      scoring_version: album.scoringVersion,
      perceptual_hash: album.perceptualHash,
      artwork_checksum: album.artworkChecksum,
      visual_analysis_status: album.visualAnalysisStatus || 'fallback',
      visual_analysis_error: album.visualAnalysisError,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('albums')
      .upsert(rows, { onConflict: 'itunes_collection_id' });

    if (error) throw error;
  } catch (error) {
    console.error('Supabase save albums failed:', error);
  }
}

export async function saveSimilarityResultsToCache(
  queryAlbum: Album,
  tiers: RecommendationTiers,
  scoringVersion: string,
): Promise<void> {
  const rows = Object.entries(tiers).flatMap(([mode, results]) =>
    results.map((result) => ({
      // iTunes collection IDs are stable across seed and Supabase records.
      source_album_id: queryAlbum.itunesCollectionId,
      candidate_album_id: result.album.itunesCollectionId,
      mode,
      visual_score: result.visualScore,
      visual_confidence: result.visualConfidence,
      music_score: result.musicScore,
      music_confidence: result.musicConfidence,
      final_score: result.finalScore,
      final_confidence: result.finalConfidence,
      component_scores: result.componentScores,
      eligibility_version: scoringVersion,
      scoring_version: scoringVersion,
      calculated_at: new Date().toISOString(),
    }))
  );
  if (rows.length === 0) return;

  const supabase = await getSupabaseClient(true);
  if (!supabase) {
    console.warn('Supabase similarity cache disabled: configure a server write key.');
    return;
  }

  const { error } = await supabase
    .from('album_similarity_cache')
    .upsert(rows, { onConflict: 'source_album_id,candidate_album_id,mode,scoring_version' });
  if (error) console.error('Supabase similarity cache save failed:', error);
}

export async function getSimilarAlbumsFromDb(
  queryAlbum: Album,
  mode: SearchMode = 'art_style',
  candidatePool: Album[] = [],
  lastFmScores: Record<number, number> = {},
  limit: number = 18,
): Promise<SimilarityResult[]> {
  const catalogAlbums = await getCatalogCandidates(queryAlbum);
  const allCandidates = new Map<number, Album>();

  for (const album of [...catalogAlbums, ...candidatePool]) {
    if (album.itunesCollectionId !== queryAlbum.itunesCollectionId) {
      allCandidates.set(album.itunesCollectionId, album);
    }
  }

  return rankDistinctRecommendationTiers(queryAlbum, Array.from(allCandidates.values()), lastFmScores, limit)[mode];
}

// Kept for callers that explicitly need the bundled fallback catalog.
export async function getAllSeedAlbums(): Promise<Album[]> {
  await ensureSeedsLoaded();
  return Array.from(memoryStore.values());
}
