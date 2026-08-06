# Distinct Album Recommendation Tiers and Reliable Homepage Covers

## Goal

Make artwork similarity reflect the pixels of each cover, ensure Art Style, Balanced, and Music Relation produce meaningfully different recommendations, and make homepage cover artwork load reliably.

## Recommendation Design

Replace the current album-identity-seeded visual embedding with an image-only descriptor derived from the analyzed cover. The descriptor will combine spatial color samples, dominant palette distribution, luminance, saturation, contrast, composition, and texture. Album ID, title, and artist must not affect this descriptor.

Each mode uses the same duplicate, selected-artist, analysis-confidence, and one-result-per-artist admission rules, then applies a distinct policy:

- **Art Style:** require strong palette compatibility, rank primarily by palette and image structure, and ignore music affinity. Reject visibly incompatible palettes even when other visual metrics are close.
- **Balanced:** require moderate palette compatibility and combine visual and musical signals at comparable strength.
- **Music Relation:** rank primarily by Last.fm/genre/era affinity, using visual quality as a light guard instead of a dominant signal.

Candidate generation will retain a shared enriched pool so requests remain cacheable, while mode-specific scoring thresholds and diversity penalties produce genuinely distinct ordered results. The API must return the active mode and its recommendations without changing the existing response shape.

## Homepage Artwork Design

The homepage must not depend on stale hardcoded Apple artwork URLs. Resolve curated album IDs through the live iTunes lookup path, cache successful albums, and omit unresolved records. Search and featured covers use the shared resilient artwork component.

The artwork component first attempts the configured optimized image. If optimization fails, it retries the same approved remote URL as a direct unoptimized image before showing the existing stable fallback. Loading, failure, and retry states preserve the square layout and accessible alternative text.

## Failure Handling

- Albums whose artwork cannot be downloaded remain usable but cannot enter visual recommendation tiers as analyzed matches.
- A failed curated homepage lookup does not blank the section; other successful covers render, and the page exposes a retryable error state if none resolve.
- Failed image optimization must not cause an infinite retry loop.

## Verification

- Unit tests prove that album metadata does not change an analyzed visual descriptor.
- Art Style rejects a severe palette mismatch and favors a close-palette cover.
- Identical candidates produce different orderings across the three modes when their visual and music strengths differ.
- Existing selected-artist, duplicate-cover, and per-artist diversity tests remain green.
- Homepage API/component tests cover successful live resolution, partial failure, optimized-image failure, direct-image fallback, and total failure.
- Run the complete test suite and a production build when a Node runtime is available.

## Assumptions

- The existing iTunes and optional Last.fm integrations remain the only external metadata sources.
- No autoplay audio is introduced.
- Existing public Album and SimilarityResult fields remain backward-compatible; internal descriptor/version metadata may change.
