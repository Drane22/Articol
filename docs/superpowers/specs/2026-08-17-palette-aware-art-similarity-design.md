# Palette-Aware Art Similarity Coverage

## Goal

Return up to 18 accurate Art Style recommendations for an indexed album without
filling the grid with covers from an incompatible dominant hue or with
metadata-only relationships. When the verified catalog genuinely contains
fewer than 18 accurate matches, show the smaller set and explain why it is
limited.

## Current behavior and cause

The album page requests 18 recommendations and renders every result returned by
the similar-albums route. The small result count is produced before rendering:

- Art Style defaults to a verified visual-only policy and rejects legacy,
  failed, duplicate, same-artist, and insufficient-confidence records.
- It requires palette compatibility of at least `0.60` and an Art Style score
  of at least `0.58`.
- Candidate retrieval is led by vector, genre, and release-era searches rather
  than the query cover's palette family. Accurate same-palette covers outside
  those bounded pools never reach the ranker.
- Live iTunes candidates do not have verified visual analysis and therefore
  cannot enter Art Style or Balanced.
- Similarity cache reads globally order and limit rows across all modes, and a
  non-empty tier can be accepted even when another mode occupies most of the
  bounded cache result.

The fix must improve candidate coverage rather than weaken the definition of an
accurate visual match.

## Product requirements

- Art Style targets 18 recommendations.
- A different dominant hue must never be used merely to fill the grid.
- Neutral and chromatic covers are not interchangeable.
- Art Style continues to require real, current-version visual analysis.
- The existing `0.60` palette-compatibility floor remains in place.
- If fewer than 18 candidates pass all gates, return and display the smaller
  accurate set.
- Balanced and Music Relation remain independent ranking policies.

## Palette-family compatibility

Add a pure palette-family helper alongside the visual engine. It uses the
stored color profile and applies these rules:

1. A cover is strongly neutral when `neutralCoverage >= 0.70`.
2. A cover is chromatic when `chromaticCoverage >= 0.28`.
3. Two strongly neutral covers are family-compatible.
4. Two chromatic covers are family-compatible when their circular dominant-hue
   distance is at most 45 degrees.
5. A neutral/chromatic pair is incompatible.
6. Records with missing or invalid color-profile evidence are not eligible for
   palette-aware retrieval or Art Style ranking.

Circular distance must handle the red wraparound correctly, so hues near 359
and 0 degrees remain close. Palette-family compatibility is an admission and
retrieval rule, not the final similarity score. Candidates still pass through
the existing continuous palette-compatibility calculation and its `0.60`
minimum.

## Candidate retrieval

The catalog adapter adds a palette-aware Supabase retrieval path for verified
albums. It queries the existing `visual_features.colorProfile` JSONB evidence
through a database function defined in `db/schema.sql`. The function accepts
the query cover's neutral coverage, chromatic coverage, dominant hue, optional
query embedding, excluded collection ID, verified analysis version, and bounded
result count.

The database function:

- restricts records to `visual_analysis_status = 'analyzed'` and the current
  embedding version;
- requires the color-profile fields needed by the compatibility contract;
- applies the neutral or circular-hue family condition;
- excludes the source collection ID;
- returns a bounded set ordered deterministically, using vector proximity when
  the query embedding is available and collection ID as the final tie-breaker.

Candidate generation requests palette-family candidates and the existing
visual/metadata candidates in parallel. It merges them by iTunes collection ID
and keeps the strongest Last.fm evidence associated with each candidate.
Palette-aware retrieval supplements the shared pool; it does not make the three
recommendation modes artificially disjoint.

If the new database function is unavailable or fails, candidate generation logs
a concise diagnostic and continues with the existing visual candidate path. It
does not relax the palette gate.

## Art Style ranking

Art Style applies the following pipeline:

1. Exclude the source album, duplicate artwork, same-title near-duplicates, and
   same-artist releases.
2. Require current reliable visual analysis for the query and candidate.
3. Require palette-family compatibility.
4. Calculate the existing palette, embedding, medium, layout, typography, and
   complexity measurements.
5. Require palette compatibility of at least `0.60`, Art Style score of at
   least `0.58`, adequate visual evidence, and final confidence of at least
   `0.30`.
6. Apply the existing one-album-per-artist diversity rule and maximum marginal
   relevance ordering.
7. Return at most 18 results without adding lower-quality fillers.

Balanced retains its 70% visual and 30% music policy. Music Relation retains
its music-evidence policy. Metadata-only candidates can contribute to Music
Relation but cannot enter either visual mode.

## Cache correctness

Bump the recommendation algorithm version so previously calculated sparse rows
cannot satisfy the new request path.

Read similarity-cache rows independently for each mode. Each query filters by
source album, mode, and scoring version, orders by final score, and applies the
requested per-mode limit. Parallel mode queries are permitted.

Before saving a newly calculated source/version result, replace prior rows for
that source/version so candidates from older recalculations cannot accumulate.
Then upsert the new result rows. A shorter tier is valid when ranking exhausted
the accurate candidate pool; it must not be topped up with stale cache rows.

Cache read or write failure is non-fatal. The request calculates and returns
live results whenever it cannot safely reconstruct cached tiers.

## API and interface behavior

Keep the existing response fields: `mode`, `results`, `recommendations`,
`tiers`, `count`, `queryAlbum`, and `algorithmVersion`.

The album page continues to render every recommendation returned for the active
mode. When Art Style returns between 1 and 17 results, show a concise limited
state near the grid, for example:

> Showing 7 verified palette-compatible matches. No unrelated covers were
> added to fill the grid.

An empty Art Style result continues to offer other modes or the explicitly
labeled metadata-related fallback. Metadata-related results must never appear
inside the Art Style grid.

## Failure handling

- Unindexed query album: retain the existing `not_indexed` response and related
  fallback.
- Palette database function unavailable: use the existing visual candidate
  path and keep all Art Style gates.
- Malformed or legacy candidate: skip it without failing the request.
- Supabase cache unavailable: calculate live recommendations.
- Cache persistence unavailable: return the calculated response and log a
  concise server warning.
- Fewer than 18 accurate matches: return the smaller set and display the
  limited-state explanation.

## Verification

Unit tests cover:

- circular hue distance across 359 and 0 degrees;
- compatible neutral pairs;
- neutral/chromatic rejection;
- chromatic pairs beyond 45 degrees rejection;
- incompatible hue rejection even when embedding similarity is high;
- metadata-only and legacy record exclusion from visual modes;
- duplicate, same-title, and same-artist exclusion;
- exactly 18 returned results when at least 18 candidates pass every gate;
- a smaller result when fewer than 18 pass;
- stable deterministic ordering and one-album-per-artist diversity;
- independent per-mode cache limits;
- stale cache-row replacement;
- unchanged Balanced and Music Relation policy behavior.

Catalog-adapter tests mock the palette database function and prove that
palette-compatible candidates outside the original vector pool enter the
shared candidate pool. Route tests verify algorithm-version invalidation, and
the album-page test verifies the limited-state message. Run the focused unit
tests, full test suite, lint/type checks available in the repository, and a
production build.

## Acceptance criteria

- Albums with at least 18 verified, palette-compatible, sufficiently similar
  candidates display 18 Art Style cards.
- No Art Style card crosses the neutral/chromatic boundary or the 45-degree
  dominant-hue boundary.
- Every Art Style card still passes the existing palette, score, evidence, and
  confidence thresholds.
- Albums with fewer accurate candidates display the smaller set with an honest
  limited-state message.
- A mode cannot lose cache slots because another mode has higher scores.
- Recalculation cannot mix obsolete cache candidates into the current result.
- Existing unrelated worktree changes remain untouched.
