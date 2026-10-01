-- Apply explicitly after inspecting usage-diagnostics.sql.
-- Installing this function does NOT delete cache rows or schedule a job.
CREATE OR REPLACE FUNCTION public.prune_obsolete_similarity_cache(
  keep_versions text[],
  older_than timestamptz,
  batch_size integer DEFAULT 10000
) RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE deleted_count integer;
BEGIN
  IF keep_versions IS NULL OR cardinality(keep_versions) = 0
     OR array_position(keep_versions, NULL) IS NOT NULL
     OR older_than IS NULL OR older_than > now() - interval '7 days' THEN
    RAISE EXCEPTION 'Provide retained scoring versions and a cutoff at least 7 days old';
  END IF;
  WITH expired AS (
    SELECT ctid FROM public.album_similarity_cache
    WHERE NOT (scoring_version = ANY(keep_versions))
      AND calculated_at < older_than
    ORDER BY calculated_at
    LIMIT LEAST(GREATEST(COALESCE(batch_size, 10000), 1), 10000)
    FOR UPDATE SKIP LOCKED
  )
  DELETE FROM public.album_similarity_cache AS cache
  USING expired WHERE cache.ctid = expired.ctid;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.prune_obsolete_similarity_cache(text[], timestamptz, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_obsolete_similarity_cache(text[], timestamptz, integer) TO service_role;

-- Remove only the known duplicate when a valid unique index has identical keys.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_index duplicate
    JOIN pg_index original ON original.indrelid = duplicate.indrelid
      AND original.indkey = duplicate.indkey
      AND original.indclass = duplicate.indclass
      AND original.indcollation = duplicate.indcollation
      AND original.indoption = duplicate.indoption
    WHERE duplicate.indexrelid = to_regclass('public.idx_albums_itunes_collection_id')
      AND original.indexrelid <> duplicate.indexrelid
      AND original.indisunique AND original.indisvalid
      AND original.indpred IS NULL AND duplicate.indpred IS NULL
      AND original.indexprs IS NULL AND duplicate.indexprs IS NULL
      AND duplicate.indrelid = 'public.albums'::regclass
  ) THEN
    DROP INDEX public.idx_albums_itunes_collection_id;
  END IF;
END;
$$;
