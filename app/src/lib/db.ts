import { Album, SearchMode, SimilarityResult } from './types';
import { SEED_ALBUMS, initSeedAlbums } from '../data/seedCatalog';
import { rankDistinctRecommendationTiers } from './visualEngine';

// In-memory catalog store — populated lazily after seed init
const memoryStore = new Map<number, Album>();
let _seedsLoaded = false;

async function ensureSeedsLoaded() {
  if (_seedsLoaded) return;
  _seedsLoaded = true;
  await initSeedAlbums();
  for (const alb of SEED_ALBUMS) {
    memoryStore.set(alb.itunesCollectionId, alb);
  }
}

export async function getAlbumFromDb(collectionId: number): Promise<Album | null> {
  await ensureSeedsLoaded();

  if (memoryStore.has(collectionId)) {
    return memoryStore.get(collectionId)!;
  }

  // Supabase check if configured
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey) {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data, error } = await supabase
        .from('albums')
        .select('*')
        .eq('itunes_collection_id', collectionId)
        .single();

      if (data && !error) {
        const album: Album = {
          id: data.id,
          itunesCollectionId: data.itunes_collection_id,
          itunesArtistId: data.itunes_artist_id,
          title: data.title,
          normalizedTitle: data.normalized_title,
          artistName: data.artist_name,
          normalizedArtistName: data.normalized_artist_name,
          genre: data.genre,
          label: data.label,
          releaseDate: data.release_date,
          releaseYear: data.release_year,
          country: data.country,
          trackCount: data.track_count,
          artworkUrl: data.artwork_url,
          artworkSource: data.artwork_source,
          storeUrl: data.store_url,
          dominantPalette: data.dominant_palette,
          visualFeatures: data.visual_features,
          embedding: data.embedding,
          embeddingModel: data.embedding_model,
          embeddingVersion: data.embedding_version,
          perceptualHash: data.perceptual_hash,
          visualAnalysisStatus: data.visual_analysis_status || 'fallback',
        };
        memoryStore.set(collectionId, album);
        return album;
      }
    } catch (e) {
      console.warn('Supabase fetch album failed:', e);
    }
  }

  return null;
}

export async function saveAlbumToDb(album: Album): Promise<void> {
  await ensureSeedsLoaded();
  memoryStore.set(album.itunesCollectionId, album);

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey) {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, supabaseKey);
      await supabase.from('albums').upsert({
        itunes_collection_id: album.itunesCollectionId,
        itunes_artist_id: album.itunesArtistId,
        title: album.title,
        normalized_title: album.normalizedTitle,
        artist_name: album.artistName,
        normalized_artist_name: album.normalizedArtistName,
        genre: album.genre,
        label: album.label,
        release_date: album.releaseDate,
        release_year: album.releaseYear,
        country: album.country,
        track_count: album.trackCount,
        artwork_url: album.artworkUrl,
        dominant_palette: album.dominantPalette,
        visual_features: album.visualFeatures,
        embedding: album.embedding,
        embedding_model: album.embeddingModel,
        embedding_version: album.embeddingVersion,
        perceptual_hash: album.perceptualHash,
        visual_analysis_status: album.visualAnalysisStatus || 'fallback',
      });
    } catch (e) {
      console.warn('Supabase save album failed:', e);
    }
  }
}

export async function getSimilarAlbumsFromDb(
  queryAlbum: Album,
  mode: SearchMode = 'art_style',
  candidatePool: Album[] = [],
  lastFmScores: Record<number, number> = {},
  limit: number = 18,
): Promise<SimilarityResult[]> {
  await ensureSeedsLoaded();

  // Combine memory store albums with candidate pool
  const allCandidates = new Map<number, Album>();

  memoryStore.forEach(a => {
    if (a.itunesCollectionId !== queryAlbum.itunesCollectionId) {
      allCandidates.set(a.itunesCollectionId, a);
    }
  });

  candidatePool.forEach(a => {
    if (a.itunesCollectionId !== queryAlbum.itunesCollectionId) {
      allCandidates.set(a.itunesCollectionId, a);
    }
  });

  const candidatesList = Array.from(allCandidates.values());

  return rankDistinctRecommendationTiers(queryAlbum, candidatesList, lastFmScores, limit)[mode];
}

export async function getAllSeedAlbums(): Promise<Album[]> {
  await ensureSeedsLoaded();
  return Array.from(memoryStore.values());
}
