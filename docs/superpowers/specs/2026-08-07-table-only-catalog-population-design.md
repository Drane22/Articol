# Table-Only Catalog Population

## Objective

Populate at least 2,000 reliable album rows in Supabase `albums` and at least
5,000 recommendation rows in `album_similarity_cache` using public iTunes
search discovery across multiple genres. The batch process must run locally,
avoid Vercel request-duration limits, and never persist downloaded artwork files.

## Non-goals

- Do not upload artwork binaries to Supabase Storage.
- Do not add a permanent local artwork directory or image cache.
- Do not count synthetic fallback descriptors toward the 2,000 reliable albums.
- Do not calculate every possible album pair; cache only the bounded top results
  needed by the application.

## Data sources and rate limits

The worker uses the existing iTunes Search API integration with a fixed list of
genre and style terms. Search results are deduplicated by
`itunes_collection_id`. Requests are serialized with a configurable delay and
the worker backs off after rate-limit or transient responses. The default delay
is conservative enough for the Search API's documented approximate request
limit.

The search response supplies album metadata and artwork URLs. The worker then
uses the existing TypeScript `enrichAlbumWithArtwork` path, which downloads an
image into memory as a `Buffer`, extracts the palette/features/embedding, and
returns table-ready fields. It does not create a temporary image path.

## Worker architecture

Add `app/scripts/populate-catalog.mjs`, run locally through a package script.
The worker has four bounded phases:

1. Discover unique candidate albums from genre terms until the target pool is
   reached, respecting the request delay.
2. Enrich and upsert albums in small batches. Only records passing
   `isReliableVisualAnalysis` count toward the reliable-album target.
3. Rank bounded candidate pools for selected reliable query albums across
   `art_style`, `balanced`, and `music_relation` modes.
4. Upsert similarity-cache rows until the requested minimum row count is met.

The worker calls the existing local indexing and similarity routes rather than
duplicating the Supabase row mapping. The Next.js server remains the only code
that writes album and similarity rows. The worker uses the server-only
Supabase secret only for exact progress counts; it is read from the local
environment and is never printed.

## Checkpoint and cleanup

The worker writes only a small JSON checkpoint containing discovered IDs,
completed IDs, and phase counters. It is stored under a clearly named temporary
state path and is deleted in a successful `finally` cleanup after both targets
are met. If the process is interrupted or fails, the checkpoint remains so the
next run can resume without reprocessing completed IDs.

No image extension, image byte buffer, or artwork download path is written to
the checkpoint. Artwork buffers are scoped to one album and become eligible for
garbage collection after the album batch completes.

## Free-tier safety

- Default concurrency is one artwork analysis at a time.
- Album upserts use bounded batches rather than one request per field.
- Similarity cache writes are batched per source album.
- The worker stops at the requested targets and does not run continuously.
- No Vercel cron or long-running Vercel function is required.
- The database stores metadata, JSON visual features, vectors, and scalar cache
  rows only; it does not store artwork files.

## Failure handling

- A failed iTunes search is retried with bounded backoff and does not corrupt
  the checkpoint.
- A failed artwork download marks that album as skipped for the reliable target;
  it is not converted into a fake analyzed row.
- A failed batch upsert stops the run before advancing the checkpoint for that
  batch.
- Cache generation skips malformed or insufficient candidates and continues
  until it either meets the target or exhausts reliable sources.
- Completion prints counts for discovered albums, reliable album rows, and
  similarity-cache rows.

## Verification

Before publishing the worker:

- Run TypeScript/static checks where the local toolchain is available.
- Search the new worker for filesystem APIs and image-file extensions.
- Confirm the staged diff includes only the worker, package script/dependencies,
  tests, documentation, and the approved design spec.
- Confirm the existing Python indexer remains clearly excluded from the command
  path because it writes temporary artwork files.
