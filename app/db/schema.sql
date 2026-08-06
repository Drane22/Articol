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
  store_url TEXT,

  genre TEXT,
  styles JSONB NOT NULL DEFAULT '[]'::jsonb,
  release_date DATE,
  release_year INTEGER,
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

-- Indexes for fast query lookup
CREATE INDEX IF NOT EXISTS idx_albums_itunes_collection_id ON albums(itunes_collection_id);
CREATE INDEX IF NOT EXISTS idx_albums_itunes_artist_id ON albums(itunes_artist_id);
CREATE INDEX IF NOT EXISTS idx_albums_release_year ON albums(release_year);
CREATE INDEX IF NOT EXISTS idx_albums_genre ON albums(genre);
CREATE INDEX IF NOT EXISTS idx_albums_visual_status ON albums(visual_analysis_status);

-- Approximate Nearest Neighbor (ANN) index for fast vector similarity lookup using Cosine similarity
CREATE INDEX IF NOT EXISTS idx_albums_embedding_cosine ON albums 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Similarity Cache table for caching calculated similarity results per scoring version
CREATE TABLE IF NOT EXISTS album_similarity_cache (
  source_album_id BIGINT NOT NULL,
  candidate_album_id BIGINT NOT NULL,
  mode TEXT NOT NULL,
  visual_score REAL,
  visual_confidence REAL,
  music_score REAL,
  final_score REAL,
  scoring_version TEXT NOT NULL,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (source_album_id, candidate_album_id, mode, scoring_version)
);

