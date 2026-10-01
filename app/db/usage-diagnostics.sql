-- Read-only. Run in the Supabase SQL editor before choosing a cleanup policy.
SELECT pg_size_pretty(pg_database_size(current_database())) AS database_size;

SELECT relname AS table_name,
       pg_size_pretty(pg_relation_size(relid)) AS table_size,
       pg_size_pretty(pg_indexes_size(relid)) AS index_size,
       pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
       n_live_tup AS estimated_live_rows, n_dead_tup AS estimated_dead_rows,
       last_autovacuum, last_autoanalyze
FROM pg_stat_user_tables
WHERE schemaname = 'public' AND relname IN ('albums', 'album_similarity_cache');

SELECT scoring_version, count(*) AS rows,
       min(calculated_at) AS oldest, max(calculated_at) AS newest
FROM public.album_similarity_cache
GROUP BY scoring_version ORDER BY max(calculated_at) DESC;

SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename IN ('albums', 'album_similarity_cache');
