import { after, NextRequest, NextResponse } from 'next/server';
import { getItunesAlbumById, refreshSeedAlbum, enrichAlbumWithArtwork } from '@/lib/itunes';
import { generateCandidatePool } from '@/lib/enrichment';
import { RECOMMENDATION_ALGORITHM_VERSION, rankDistinctRecommendationTiers } from '@/lib/visualEngine';
import { Album, RecommendationTiers, SimilarityResult } from '@/lib/types';
import { BoundedTtlCache, InflightRequests } from '@/lib/boundedCache';
import { getAlbumFromDb, getSimilarityResultsFromCache, saveAlbumToDb, saveSimilarityResultsToCache } from '@/lib/db';
import { isReliableVisualAnalysis } from '@/lib/visualValidation';
import { normalizeStorefront } from '@/lib/storefronts';

const responseCache = new BoundedTtlCache<RecommendationPayload>({
  maxEntries: 48,
  ttlMs: 1000 * 30,
});
const inflight = new InflightRequests<RecommendationPayload>();

interface RecommendationPayload {
  status: 'indexed' | 'not_indexed';
  queryAlbum?: Album;
  count: number;
  tiers?: RecommendationTiers;
  results?: SimilarityResult[];
  algorithmVersion: string;
}

function withoutInternalVector(album: Album): Album {
  return { ...album, embedding: undefined, perceptualHash: undefined };
}

function publicResult(result: SimilarityResult): SimilarityResult {
  return { ...result, album: withoutInternalVector(result.album) };
}

async function calculateRecommendations(
  collectionId: number,
  country: string,
  limit: number,
  poolLimit: number,
  forceRebuild: boolean,
): Promise<RecommendationPayload> {
  const storedAlbum = await getAlbumFromDb(collectionId);

  if (!forceRebuild && storedAlbum && isReliableVisualAnalysis(storedAlbum)) {
    const cached = await getSimilarityResultsFromCache(
      storedAlbum,
      RECOMMENDATION_ALGORITHM_VERSION,
      limit,
    );
    if (cached) {
      const tiers = Object.fromEntries(
        Object.entries(cached).map(([mode, results]) => [mode, results.map(publicResult)])
      ) as unknown as RecommendationTiers;
      return {
        status: 'indexed',
        queryAlbum: withoutInternalVector(storedAlbum),
        count: Math.max(...Object.values(tiers).map((results) => results.length), 0),
        tiers,
        algorithmVersion: RECOMMENDATION_ALGORITHM_VERSION,
      };
    }
  }

  let queryAlbum: Album | null = storedAlbum;
  if (!queryAlbum || queryAlbum.artworkSource === 'seed') {
    const { album: fetched } = await getItunesAlbumById(collectionId, country, false);
    queryAlbum = fetched
      ? storedAlbum
        ? {
            ...storedAlbum,
            itunesArtistId: fetched.itunesArtistId || storedAlbum.itunesArtistId,
            title: fetched.title || storedAlbum.title,
            normalizedTitle: fetched.normalizedTitle || storedAlbum.normalizedTitle,
            artistName: fetched.artistName || storedAlbum.artistName,
            normalizedArtistName: fetched.normalizedArtistName || storedAlbum.normalizedArtistName,
            country: fetched.country,
            storeUrl: fetched.storeUrl,
            artworkUrl: fetched.artworkUrl || storedAlbum.artworkUrl,
            artworkSource: fetched.artworkSource,
            trackCount: fetched.trackCount,
            explicitness: fetched.explicitness,
          }
        : fetched
      : storedAlbum;
  }

  if (!queryAlbum) throw new Error('Album not found');
  queryAlbum = await refreshSeedAlbum(queryAlbum, country);
  let shouldPersistQueryAlbum = false;

  // Enrich query album if it has not been visually analyzed yet
  if (!isReliableVisualAnalysis(queryAlbum)) {
    queryAlbum = await enrichAlbumWithArtwork(queryAlbum);
    shouldPersistQueryAlbum = true;
  }

  // Verify visual indexing status (Section 4 & 24: Unindexed albums return not_indexed)
  const isIndexed = isReliableVisualAnalysis(queryAlbum);

  if (!isIndexed) {
    if (shouldPersistQueryAlbum) {
      const albumToPersist = queryAlbum;
      after(() => saveAlbumToDb(albumToPersist));
    }
    return {
      status: 'not_indexed',
      count: 0,
      results: [],
      algorithmVersion: RECOMMENDATION_ALGORITHM_VERSION,
    };
  }

  // Retrieve candidate pool (No runtime image downloads or Sharp model inference!)
  const { candidates, lastFmScores } = await generateCandidatePool(queryAlbum, country, poolLimit);

  // Compute confidence-weighted visual & mode similarity ranking
  const ranked = rankDistinctRecommendationTiers(queryAlbum, candidates, lastFmScores, limit);

  const tiers = Object.fromEntries(
    Object.entries(ranked).map(([mode, results]) => [mode, results.map(publicResult)])
  ) as unknown as RecommendationTiers;

  const albumToPersist = queryAlbum;
  if (forceRebuild) {
    // Rebuild workers need a durable write before they advance their
    // checkpoint. Normal interactive requests keep the non-blocking path.
    if (shouldPersistQueryAlbum) await saveAlbumToDb(albumToPersist);
    await saveSimilarityResultsToCache(albumToPersist, ranked, RECOMMENDATION_ALGORITHM_VERSION);
  } else {
    after(async () => {
      if (shouldPersistQueryAlbum) await saveAlbumToDb(albumToPersist);
      await saveSimilarityResultsToCache(albumToPersist, ranked, RECOMMENDATION_ALGORITHM_VERSION);
    });
  }

  return {
    status: 'indexed',
    queryAlbum: withoutInternalVector(queryAlbum),
    count: Math.max(...Object.values(tiers).map((results) => results.length), 0),
    tiers,
    algorithmVersion: RECOMMENDATION_ALGORITHM_VERSION,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const collectionId = Number.parseInt(id, 10);
  const requestedMode = request.nextUrl.searchParams.get('mode') || 'art_style';
  const mode = ['art_style', 'balanced', 'music_relation'].includes(requestedMode)
    ? (requestedMode as keyof RecommendationTiers)
    : 'art_style';
  const requestedLimit = Number.parseInt(request.nextUrl.searchParams.get('limit') || '18', 10);
  const limit = Math.max(1, Math.min(Number.isFinite(requestedLimit) ? requestedLimit : 18, 18));
  const requestedPoolLimit = Number.parseInt(request.nextUrl.searchParams.get('pool') || '500', 10);
  const poolLimit = Math.max(50, Math.min(Number.isFinite(requestedPoolLimit) ? requestedPoolLimit : 500, 500));
  const forceRebuild = request.nextUrl.searchParams.get('rebuild') === '1';
  const country = normalizeStorefront(request.nextUrl.searchParams.get('country'));

  if (!Number.isFinite(collectionId)) {
    return NextResponse.json({ error: 'Invalid collection ID' }, { status: 400 });
  }

  const cacheKey = `${RECOMMENDATION_ALGORITHM_VERSION}:${collectionId}:${country}:${limit}:${poolLimit}:${forceRebuild ? 'rebuild' : 'cached'}`;

  try {
    let payload = responseCache.get(cacheKey);
    const cacheStatus = payload ? 'HIT' : 'MISS';
    if (!payload) {
      payload = await inflight.run(cacheKey, () => calculateRecommendations(collectionId, country, limit, poolLimit, forceRebuild));
      responseCache.set(cacheKey, payload);
    }

    if (payload.status === 'not_indexed') {
      return NextResponse.json({
        status: 'not_indexed',
        results: [],
        message: 'This album has not been visually indexed yet.',
      });
    }

    return NextResponse.json(
      {
        ...payload,
        mode,
        results: payload.tiers ? payload.tiers[mode] : [],
        recommendations: payload.tiers ? payload.tiers[mode] : [],
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
          'X-Articol-Cache': cacheStatus,
        },
      }
    );
  } catch (error: any) {
    console.error(`API /api/albums/${id}/similar error:`, error);
    const status = error?.message === 'Album not found' ? 404 : 500;
    return NextResponse.json(
      { error: error?.message || 'Similar covers calculation failed' },
      { status }
    );
  }
}
