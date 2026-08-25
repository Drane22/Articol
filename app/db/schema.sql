-- Enable pgvector extension for high-performance vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Albums table holding artwork metadata, extracted visual features, and embeddings
CREATE TABLE IF NOT EXISTS albums (
  id BIGSERIAL PRIMARY KEY,

  itunes_collection_id BIGINT UNIQUE NOT NULL,
  itunes_artist_id BIGINT,

  title TEXT NOT NULL,
  normalized_title TEXT NOT NULL,
  artist_name TEXT NOT NULL,
  normalized_artist_name TEXT NOT NULL,

  artwork_url TEXT,
  artwork_source TEXT,
  store_url TEXT,

  genre TEXT,
  styles JSONB NOT NULL DEFAULT '[]'::jsonb,
  label TEXT,
  release_date DATE,
  release_year INTEGER,
  country TEXT DEFAULT 'PH',
  track_count INTEGER,
  explicitness TEXT,
  price NUMERIC,
  currency TEXT,

  embedding VECTOR(512),
  dominant_palette JSONB,
  visual_features JSONB,
  perceptual_hash TEXT,

  embedding_model TEXT DEFAULT 'clip-vit-base-patch32',
  embedding_version TEXT DEFAULT 'v1',
  feature_extraction_version TEXT DEFAULT 'v1',
  scoring_version TEXT DEFAULT 'v1',
  artwork_checksum TEXT,

  visual_analysis_status TEXT NOT NULL DEFAULT 'pending',
  visual_analysis_error TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Keep existing installations compatible with the runtime Album shape.
ALTER TABLE albums ADD COLUMN IF NOT EXISTS artwork_source TEXT;
ALTER TABLE albums ADD COLUMN IF NOT EXISTS label TEXT;
ALTER TABLE albums ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'PH';

CREATE OR REPLACE FUNCTION set_album_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS albums_set_updated_at ON albums;
CREATE TRIGGER albums_set_updated_at
BEFORE UPDATE ON albums
FOR EACH ROW
EXECUTE FUNCTION set_album_updated_at();

-- Indexes for fast query lookup
CREATE INDEX IF NOT EXISTS idx_albums_itunes_collection_id ON albums(itunes_collection_id);
CREATE INDEX IF NOT EXISTS idx_albums_itunes_artist_id ON albums(itunes_artist_id);
CREATE INDEX IF NOT EXISTS idx_albums_release_year ON albums(release_year);
CREATE INDEX IF NOT EXISTS idx_albums_genre ON albums(genre);
CREATE INDEX IF NOT EXISTS idx_albums_visual_status ON albums(visual_analysis_status);

-- Approximate Nearest Neighbor (ANN) index for fast vector similarity lookup using Cosine similarity
CREATE INDEX IF NOT EXISTS idx_albums_embedding_cosine ON albums 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Optional RPC used by the recommendation route for a bounded visual candidate pool.
CREATE OR REPLACE FUNCTION match_album_candidates(
  query_embedding VECTOR(512),
  exclude_collection_id BIGINT DEFAULT NULL,
  match_count INTEGER DEFAULT 200
)
RETURNS SETOF albums
LANGUAGE sql
STABLE
AS $$
  SELECT a.*
  FROM albums AS a
  WHERE a.embedding IS NOT NULL
    AND a.visual_analysis_status = 'analyzed'
    AND a.embedding_version = 'visual-grid-v4-palette10'
    AND (exclude_collection_id IS NULL OR a.itunes_collection_id <> exclude_collection_id)
  ORDER BY a.embedding <=> query_embedding
  LIMIT LEAST(GREATEST(match_count, 1), 500);
$$;

-- Palette-family retrieval supplements vector neighbors so visually accurate
-- same-hue candidates are not lost before application-level ranking.
CREATE OR REPLACE FUNCTION match_palette_candidates(
  query_neutral_coverage DOUBLE PRECISION,
  query_chromatic_coverage DOUBLE PRECISION,
  query_dominant_hue DOUBLE PRECISION,
  query_embedding VECTOR(512),
  verified_embedding_version TEXT,
  exclude_collection_id BIGINT DEFAULT NULL,
  match_count INTEGER DEFAULT 400
)
RETURNS SETOF albums
LANGUAGE sql
STABLE
AS $$
  SELECT a.*
  FROM albums AS a
  CROSS JOIN LATERAL (
    SELECT
      CASE
        WHEN jsonb_typeof(a.visual_features #> '{colorProfile,neutralCoverage}') = 'number'
          THEN (a.visual_features #>> '{colorProfile,neutralCoverage}')::DOUBLE PRECISION
      END AS neutral_coverage,
      CASE
        WHEN jsonb_typeof(a.visual_features #> '{colorProfile,chromaticCoverage}') = 'number'
          THEN (a.visual_features #>> '{colorProfile,chromaticCoverage}')::DOUBLE PRECISION
      END AS chromatic_coverage,
      CASE
        WHEN jsonb_typeof(a.visual_features #> '{colorProfile,dominantHue}') = 'number'
          THEN (a.visual_features #>> '{colorProfile,dominantHue}')::DOUBLE PRECISION
      END AS dominant_hue
  ) AS profile
  WHERE a.embedding IS NOT NULL
    AND a.visual_analysis_status = 'analyzed'
    AND a.embedding_version = verified_embedding_version
    AND profile.neutral_coverage IS NOT NULL
    AND profile.chromatic_coverage IS NOT NULL
    AND profile.dominant_hue IS NOT NULL
    AND (exclude_collection_id IS NULL OR a.itunes_collection_id <> exclude_collection_id)
    AND (
      (
        query_neutral_coverage >= 0.70
        AND profile.neutral_coverage >= 0.70
      )
      OR
      (
        query_neutral_coverage < 0.70
        AND query_chromatic_coverage >= 0.28
        AND profile.neutral_coverage < 0.70
        AND profile.chromatic_coverage >= 0.28
        AND LEAST(
          ABS(profile.dominant_hue - query_dominant_hue),
          360 - ABS(profile.dominant_hue - query_dominant_hue)
        ) <= 45
      )
    )
  ORDER BY
    CASE
      WHEN query_embedding IS NOT NULL THEN a.embedding <=> query_embedding
      ELSE 2
    END,
    a.itunes_collection_id
  LIMIT LEAST(GREATEST(match_count, 1), 500);
$$;

-- Similarity Cache table for caching calculated similarity results per scoring version
CREATE TABLE IF NOT EXISTS album_similarity_cache (
  source_album_id BIGINT NOT NULL,
  candidate_album_id BIGINT NOT NULL,
  mode TEXT NOT NULL,
  visual_score REAL,
  visual_confidence REAL,
  music_score REAL,
  music_confidence REAL,
  final_score REAL,
  final_confidence REAL,
  component_scores JSONB,
  eligibility_version TEXT,
  scoring_version TEXT NOT NULL,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (source_album_id, candidate_album_id, mode, scoring_version)
);

CREATE INDEX IF NOT EXISTS idx_similarity_cache_source_version_score
ON album_similarity_cache(source_album_id, scoring_version, final_score DESC);

CREATE INDEX IF NOT EXISTS idx_similarity_cache_source_version_mode_score
ON album_similarity_cache(source_album_id, scoring_version, mode, final_score DESC);

-- Safe for installations created before recommendation confidence was audited.
ALTER TABLE album_similarity_cache ADD COLUMN IF NOT EXISTS music_confidence REAL;
ALTER TABLE album_similarity_cache ADD COLUMN IF NOT EXISTS final_confidence REAL;
ALTER TABLE album_similarity_cache ADD COLUMN IF NOT EXISTS component_scores JSONB;
ALTER TABLE album_similarity_cache ADD COLUMN IF NOT EXISTS eligibility_version TEXT;

-- Enable Row Level Security (RLS) for secure public read access
ALTER TABLE albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE album_similarity_cache ENABLE ROW LEVEL SECURITY;

-- Allow public SELECT access to catalog data for Next.js app queries.
-- The guards keep this migration safe to rerun after a partial SQL Editor run.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'albums'
      AND policyname = 'Allow public read access on albums'
  ) THEN
    CREATE POLICY "Allow public read access on albums" ON albums FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'album_similarity_cache'
      AND policyname = 'Allow public read access on similarity cache'
  ) THEN
    CREATE POLICY "Allow public read access on similarity cache" ON album_similarity_cache FOR SELECT USING (true);
  END IF;
END
$$;

-- Ask PostgREST to refresh its column cache after compatibility migrations.
NOTIFY pgrst, 'reload schema';
