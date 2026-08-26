import { Album, RecommendationTiers, SearchMode, SimilarityResult } from './types';
import { SEED_ALBUMS, initSeedAlbums } from '../data/seedCatalog';
import { generateMatchExplanation, rankDistinctRecommendationTiers } from './visualEngine';
import { BoundedTtlCache, InflightRequests } from './boundedCache';
import { hexToRgb, rgbToLab } from './colorUtils';
import { MAX_PALETTE_COLORS } from './palette';
import { VERIFIED_VISUAL_ANALYSIS_VERSION } from './visualValidation';

// The process-local map is a fast fallback and a write-through view of the catalog.
const memoryStore = new Map<number, Album>();
let seedLoadPromise: Promise<void> | null = null;

const catalogCache = new BoundedTtlCache<Album[]>({ maxEntries: 1, ttlMs: 1000 * 30 });
const catalogRequests = new InflightRequests<Album[]>();
const albumLookupCache = new BoundedTtlCache<Album>({ maxEntries: 512, ttlMs: 1000 * 60 * 5 });
const albumLookupRequests = new InflightRequests<Album | null>();
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

function parseStringArray(value: unknown): string[] {
  const parsed = parseJson<unknown>(value, []);
  return Array.isArray(parsed)
    ? parsed.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    : [];
}

function parseVisualFeatures(value: unknown): Album['visualFeatures'] {
  const parsed = parseJson<unknown>(value, {});
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? parsed as Album['visualFeatures']
    : {} as Album['visualFeatures'];
}

function normalizePalette(value: unknown): Album['dominantPalette'] {
  const palette = parseJson<unknown[]>(value, []);
  if (!Array.isArray(palette)) return [];
  return palette.flatMap((entry: any) => {
    if (!entry?.hex || typeof entry.hex !== 'string' || !/^#[0-9a-f]{6}$/i.test(entry.hex)) return [];
    const lab: [number, number, number] = Array.isArray(entry.lab) && entry.lab.length === 3 && entry.lab.every(Number.isFinite)
      ? entry.lab
      : rgbToLab(...hexToRgb(entry.hex));
    const weight = Number.isFinite(Number(entry.weight)) && Number(entry.weight) > 0 ? Number(entry.weight) : 0.1;
    return [{ hex: entry.hex.toLowerCase(), lab, weight }];
  }).slice(0, MAX_PALETTE_COLORS);
}

export function mapSupabaseAlbumRow(data: any): Album {
  const collectionId = Number(data?.itunes_collection_id);
  if (!Number.isFinite(collectionId)) throw new Error('Supabase album row has no valid collection ID');

  const title = String(data.title || 'Untitled Album');
  const artistName = String(data.artist_name || 'Unknown Artist');

  const embeddingModel = data.embedding_model || undefined;
  const embeddingVersion = data.embedding_version || undefined;
  const storedStatus = data.visual_analysis_status || 'fallback';
  const isSyntheticVisualData = embeddingModel === 'seed-fallback' || embeddingVersion === 'fallback-v1';

  return {
    id: String(data.id ?? `supabase-${collectionId}`),
    itunesCollectionId: collectionId,
    itunesArtistId: data.itunes_artist_id == null ? undefined : Number(data.itunes_artist_id),
    title,
    normalizedTitle: String(data.normalized_title || title.toLowerCase().trim()),
    artistName,
    normalizedArtistName: String(data.normalized_artist_name || artistName.toLowerCase().trim()),
    genre: String(data.genre || 'Music'),
    styles: parseStringArray(data.styles),
    label: data.label == null ? undefined : String(data.label),
    releaseDate: data.release_date || '',
    releaseYear: Number(data.release_year) || 0,
    country: data.country || 'PH',
    trackCount: Number(data.track_count) || 0,
    explicitness: data.explicitness || 'notExplicit',
    price: data.price == null ? undefined : Number(data.price),
    currency: data.currency || undefined,
    artworkUrl: String(data.artwork_url || ''),
    artworkSource: String(data.artwork_source || 'itunes'),
    storeUrl: String(data.store_url || ''),
    dominantPalette: normalizePalette(data.dominant_palette),
    visualFeatures: parseVisualFeatures(data.visual_features),
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
    match_count: Math.min(Math.max(limit, 50), 500),
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

async function fetchRemotePaletteCandidates(queryAlbum: Album, limit: number): Promise<Album[]> {
  const profile = queryAlbum.visualFeatures?.colorProfile;
  if (
    !profile ||
    !Number.isFinite(profile.neutralCoverage) ||
    !Number.isFinite(profile.chromaticCoverage) ||
    !Number.isFinite(profile.dominantHue)
  ) return [];

  const supabase = await getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase.rpc('match_palette_candidates', {
    query_neutral_coverage: profile.neutralCoverage,
    query_chromatic_coverage: profile.chromaticCoverage,
    query_dominant_hue: profile.dominantHue,
    query_embedding: queryAlbum.embedding || null,
    verified_embedding_version: VERIFIED_VISUAL_ANALYSIS_VERSION,
    exclude_collection_id: queryAlbum.itunesCollectionId,
    match_count: Math.min(Math.max(limit, 50), 500),
  });
  if (error) throw error;
  return mapRemoteAlbumRows(data, 'palette');
}

function mapRemoteAlbumRows(rows: any[] | null | undefined, source: string): Album[] {
  return (rows || []).flatMap((row: any) => {
    try {
      return [mapSupabaseAlbumRow(row)];
    } catch (error) {
      console.warn(`Skipping malformed Supabase ${source} candidate:`, error);
      return [];
    }
  });
}

async function fetchRemoteMetadataCandidates(queryAlbum: Album, limit: number): Promise<Album[]> {
  const supabase = await getSupabaseClient();
  if (!supabase) return [];

  const perQueryLimit = Math.min(125, Math.max(20, Math.ceil(limit / 4)));
  const queries: Array<{ source: string; request: PromiseLike<any> }> = [];
  const genre = queryAlbum.genre.trim();
  if (genre) {
    queries.push({
      source: 'genre',
      request: supabase
        .from('albums')
        .select('*')
        .neq('itunes_collection_id', queryAlbum.itunesCollectionId)
        .ilike('genre', `%${genre}%`)
        .order('updated_at', { ascending: false })
        .limit(perQueryLimit),
    });
  }

  if (queryAlbum.releaseYear > 0) {
    queries.push({
      source: 'release-era',
      request: supabase
        .from('albums')
        .select('*')
        .neq('itunes_collection_id', queryAlbum.itunesCollectionId)
        .gte('release_year', queryAlbum.releaseYear - 15)
        .lte('release_year', queryAlbum.releaseYear + 15)
        .order('updated_at', { ascending: false })
        .limit(perQueryLimit),
    });
  }

  if (queries.length === 0) return [];
  const settled = await Promise.allSettled(queries.map(({ request }) => request));
  const candidates = new Map<number, Album>();
  settled.forEach((result, index) => {
    const source = queries[index].source;
    if (result.status === 'rejected') {
      console.warn(`Supabase ${source} candidate query failed:`, result.reason);
      return;
    }
    if (result.value.error) {
      console.warn(`Supabase ${source} candidate query failed:`, result.value.error);
      return;
    }
    for (const album of mapRemoteAlbumRows(result.value.data, source)) {
      candidates.set(album.itunesCollectionId, album);
    }
  });
  return Array.from(candidates.values());
}

async function fetchRemoteRecentCandidates(queryAlbum: Album, limit: number): Promise<Album[]> {
  const supabase = await getSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('albums')
    .select('*')
    .neq('itunes_collection_id', queryAlbum.itunesCollectionId)
    .order('updated_at', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 200));
  if (error) throw error;
  return mapRemoteAlbumRows(data, 'recent');
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

export async function getCatalogCandidates(queryAlbum: Album, limit: number = 500): Promise<Album[]> {
  const boundedLimit = Math.min(Math.max(limit, 1), 500);
  const [paletteResult, visualResult, metadataResult] = await Promise.allSettled([
    fetchRemotePaletteCandidates(queryAlbum, Math.min(boundedLimit, 400)),
    fetchRemoteVisualCandidates(queryAlbum, Math.min(boundedLimit, 400)),
    fetchRemoteMetadataCandidates(queryAlbum, boundedLimit),
  ]);

  const paletteCandidates = paletteResult.status === 'fulfilled' ? paletteResult.value : [];
  const visualCandidates = visualResult.status === 'fulfilled' ? visualResult.value : [];
  const metadataCandidates = metadataResult.status === 'fulfilled' ? metadataResult.value : [];
  if (paletteResult.status === 'rejected') {
    console.warn('Supabase palette candidate query unavailable:', paletteResult.reason);
  }
  if (visualResult.status === 'rejected') {
    console.warn('Supabase vector candidate query unavailable:', visualResult.reason);
  }
  if (metadataResult.status === 'rejected') {
    console.warn('Supabase metadata candidate query unavailable:', metadataResult.reason);
  }

  const candidates = new Map<number, Album>();
  for (const album of paletteCandidates) candidates.set(album.itunesCollectionId, album);
  for (const album of visualCandidates) candidates.set(album.itunesCollectionId, album);
  for (const album of metadataCandidates) candidates.set(album.itunesCollectionId, album);

  if (candidates.size === 0) {
    try {
      for (const album of await fetchRemoteRecentCandidates(queryAlbum, boundedLimit)) {
        candidates.set(album.itunesCollectionId, album);
      }
    } catch (error) {
      console.warn('Supabase bounded candidate fallback unavailable:', error);
    }
  }

  if (candidates.size < boundedLimit) {
    await ensureSeedsLoaded();
    for (const album of memoryStore.values()) {
      if (album.itunesCollectionId !== queryAlbum.itunesCollectionId) {
        candidates.set(album.itunesCollectionId, album);
      }
      if (candidates.size >= boundedLimit) break;
    }
  }

  return Array.from(candidates.values()).slice(0, boundedLimit);
}

export async function getAlbumFromDb(collectionId: number): Promise<Album | null> {
  if (!Number.isFinite(collectionId)) return null;

  const cacheKey = String(collectionId);
  const cached = albumLookupCache.get(cacheKey);
  if (cached) return cached;

  return albumLookupRequests.run(cacheKey, async () => {
    const secondCached = albumLookupCache.get(cacheKey);
    if (secondCached) return secondCached;

    const supabase = await getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('albums')
          .select('*')
          .eq('itunes_collection_id', collectionId)
          .maybeSingle();

        if (error) throw error;
        if (data) {
          const album = mapSupabaseAlbumRow(data);
          memoryStore.set(collectionId, album);
          albumLookupCache.set(cacheKey, album);
          return album;
        }
      } catch (error) {
        console.warn(`Supabase album ${collectionId} read failed; using local fallback:`, error);
      }
    }

    await ensureSeedsLoaded();
    return memoryStore.get(collectionId) || null;
  });
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

  for (const album of uniqueAlbums) {
    memoryStore.set(album.itunesCollectionId, album);
    albumLookupCache.set(String(album.itunesCollectionId), album);
  }
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
  const candidateAlbums = Array.from(new Map(
    Object.values(tiers)
      .flat()
      .map((result) => [result.album.itunesCollectionId, result.album] as const),
  ).values());
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

  const supabase = await getSupabaseClient(true);
  if (!supabase) {
    console.warn('Supabase similarity cache disabled: configure a server write key.');
    return;
  }

  const { error: deleteError } = await supabase
    .from('album_similarity_cache')
    .delete()
    .eq('source_album_id', queryAlbum.itunesCollectionId)
    .eq('scoring_version', scoringVersion);
  if (deleteError) {
    console.error('Supabase stale similarity cache replacement failed:', deleteError);
    return;
  }
  if (rows.length === 0) return;

  if (candidateAlbums.length > 0) {
    const metadataRows = candidateAlbums.map((album) => ({
      itunes_collection_id: album.itunesCollectionId,
      itunes_artist_id: album.itunesArtistId,
      title: album.title,
      normalized_title: album.normalizedTitle,
      artist_name: album.artistName,
      normalized_artist_name: album.normalizedArtistName,
      genre: album.genre,
      styles: album.styles || [],
      label: album.label,
      release_date: album.releaseDate || null,
      release_year: album.releaseYear,
      country: album.country,
      track_count: album.trackCount,
      explicitness: album.explicitness,
      artwork_url: album.artworkUrl,
      artwork_source: album.artworkSource,
      store_url: album.storeUrl,
    }));
    const { error: albumError } = await supabase
      .from('albums')
      .upsert(metadataRows, { onConflict: 'itunes_collection_id' });
    if (albumError) {
      console.warn('Supabase recommendation candidate metadata save failed:', albumError);
    }
  }

  const { error } = await supabase
    .from('album_similarity_cache')
    .upsert(rows, { onConflict: 'source_album_id,candidate_album_id,mode,scoring_version' });
  if (error) console.error('Supabase similarity cache save failed:', error);
}

const CACHEABLE_SEARCH_MODES: SearchMode[] = ['art_style', 'balanced', 'music_relation'];

function numericScore(value: unknown, fallback: number = 0): number {
  const score = Number(value);
  return Number.isFinite(score) ? score : fallback;
}

function nullableNumericScore(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const score = Number(value);
  return Number.isFinite(score) ? score : null;
}

export async function getSimilarityResultsFromCache(
  queryAlbum: Album,
  scoringVersion: string,
  limit: number = 18,
): Promise<RecommendationTiers | null> {
  const supabase = await getSupabaseClient();
  if (!supabase) return null;

  try {
    const cacheRowsByMode = await Promise.all(CACHEABLE_SEARCH_MODES.map(async (mode) => {
      const { data, error } = await supabase
        .from('album_similarity_cache')
        .select('candidate_album_id,mode,visual_score,visual_confidence,music_score,music_confidence,final_score,final_confidence,component_scores,calculated_at')
        .eq('source_album_id', queryAlbum.itunesCollectionId)
        .eq('scoring_version', scoringVersion)
        .eq('mode', mode)
        .order('final_score', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    }));
    const cacheRows = cacheRowsByMode.flat();

    if (!cacheRows?.length) return null;

    const candidateIds: number[] = Array.from(new Set<number>(
      cacheRows
        .map((row: any) => Number(row.candidate_album_id))
        .filter((id: number) => Number.isFinite(id)),
    ));
    if (candidateIds.length === 0) return null;

    const { data: albumRows, error: albumError } = await supabase
      .from('albums')
      .select('*')
      .in('itunes_collection_id', candidateIds);
    if (albumError) throw albumError;

    const albumsById = new Map<number, Album>();
    for (const row of albumRows || []) {
      try {
        const album = mapSupabaseAlbumRow(row);
        albumsById.set(album.itunesCollectionId, album);
      } catch (error) {
        console.warn('Skipping malformed cached recommendation album:', error);
      }
    }
    if (candidateIds.some((id) => !albumsById.has(id))) return null;

    const tiers: RecommendationTiers = {
      art_style: [],
      balanced: [],
      music_relation: [],
    };

    for (const row of cacheRows) {
      const mode = row.mode as SearchMode;
      if (!CACHEABLE_SEARCH_MODES.includes(mode) || tiers[mode].length >= limit) continue;
      const album = albumsById.get(Number(row.candidate_album_id));
      if (!album) return null;

      const visualScore = nullableNumericScore(row.visual_score);
      const musicScore = nullableNumericScore(row.music_score);
      const explanation = generateMatchExplanation(
        queryAlbum,
        album,
        visualScore || 0,
        musicScore || 0,
        mode,
      );
      const queryPalette = queryAlbum.dominantPalette?.map((color) => color.hex) || [];
      const candidatePalette = album.dominantPalette?.map((color) => color.hex) || [];

      tiers[mode].push({
        album,
        finalScore: numericScore(row.final_score),
        finalConfidence: numericScore(row.final_confidence),
        visualScore,
        visualConfidence: numericScore(row.visual_confidence),
        musicScore,
        musicConfidence: numericScore(row.music_confidence),
        componentScores: parseJson(row.component_scores, {
          embedding: null,
          color: null,
          layout: null,
          typography: null,
          complexity: null,
          medium: null,
        }),
        matchReasons: explanation.reasons,
        explanation: explanation.explanation,
        sharedAttributes: explanation.sharedAttrs,
        paletteComparison: queryPalette.length && candidatePalette.length
          ? { query: queryPalette, candidate: candidatePalette }
          : undefined,
      });
    }

    return CACHEABLE_SEARCH_MODES.some((mode) => tiers[mode].length > 0) ? tiers : null;
  } catch (error) {
    console.warn('Supabase similarity cache read failed; recalculating:', error);
    return null;
  }
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
