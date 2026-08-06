import { NextRequest, NextResponse } from 'next/server';
import { getItunesAlbumById, refreshSeedAlbum } from '@/lib/itunes';
import { generateCandidatePool } from '@/lib/enrichment';
import { rankDistinctRecommendationTiers } from '@/lib/visualEngine';
import { Album, RecommendationTiers, SimilarityResult } from '@/lib/types';
import { BoundedTtlCache, InflightRequests } from '@/lib/boundedCache';
import { getAlbumFromDb } from '@/lib/db';

const RECOMMENDATION_ALGORITHM_VERSION = 'articol-v1-pgvector';
const responseCache = new BoundedTtlCache<RecommendationPayload>({
  maxEntries: 48,
  ttlMs: 1000 * 60 * 60 * 6,
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
  limit: number
): Promise<RecommendationPayload> {
  // Check indexed database catalog first
  let queryAlbum = await getAlbumFromDb(collectionId);

  // If not found in DB, check iTunes metadata
  if (!queryAlbum) {
    const { album: fetched } = await getItunesAlbumById(collectionId, country);
    if (!fetched) throw new Error('Album not found');
    queryAlbum = await refreshSeedAlbum(fetched, country);
  }

  // Verify visual indexing status (Section 4 & 24: Unindexed albums return not_indexed)
  const isIndexed =
    queryAlbum.visualAnalysisStatus === 'indexed' ||
    queryAlbum.visualAnalysisStatus === 'analyzed';

  if (!isIndexed) {
    return {
      status: 'not_indexed',
      count: 0,
      results: [],
      algorithmVersion: RECOMMENDATION_ALGORITHM_VERSION,
    };
  }

  // Retrieve candidate pool (No runtime image downloads or Sharp model inference!)
  const { candidates, lastFmScores } = await generateCandidatePool(queryAlbum, country);

  // Compute confidence-weighted visual & mode similarity ranking
  const ranked = rankDistinctRecommendationTiers(queryAlbum, candidates, lastFmScores, limit);

  const tiers = Object.fromEntries(
    Object.entries(ranked).map(([mode, results]) => [mode, results.map(publicResult)])
  ) as unknown as RecommendationTiers;

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
  const country = (request.nextUrl.searchParams.get('country') || 'PH').toUpperCase().slice(0, 2);

  if (!Number.isFinite(collectionId)) {
    return NextResponse.json({ error: 'Invalid collection ID' }, { status: 400 });
  }

  const cacheKey = `${RECOMMENDATION_ALGORITHM_VERSION}:${collectionId}:${country}:${limit}`;

  try {
    let payload = responseCache.get(cacheKey);
    const cacheStatus = payload ? 'HIT' : 'MISS';
    if (!payload) {
      payload = await inflight.run(cacheKey, () => calculateRecommendations(collectionId, country, limit));
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
          'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=86400',
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
