# Visual Recommendation Integrity and Card Layout Design

## Objective

Make Articol's three recommendation modes honest, selective, and visually
useful after the catalog is cleared and rebuilt. Visually unrelated albums must
not be presented as trusted cover matches; confidence must represent both data
quality and match agreement; and dense recommendation cards must never clip or
overlap their controls.

## Current failures

1. `art_style` is implemented as palette similarity only, although the product
   describes a broader visual relationship. It has no palette compatibility
   rejection, so shared black, white, or gray swatches can make incompatible
   colorful covers appear related.
2. Missing visual inputs are silently replaced with neutral defaults in several
   component scorers. This permits weak or incomplete analyses to receive a
   plausible visual score.
3. Confidence currently measures presence of fields. A pair of fully populated
   albums can therefore receive 100% confidence even when its visual score is
   poor. The existing 30% threshold is applied before MMR, but it is ineffective
   because confidence is inflated.
4. Candidate retrieval is dominated by the spatial descriptor nearest-neighbor
   set. A palette-compatible candidate outside that set may not be considered.
5. The album card footer uses a viewport breakpoint. In the six-column desktop
   grid, an individual card can be much narrower than the breakpoint assumes,
   leaving insufficient space for palette actions and the View button.

## Data contract and collection rules

### Verified visual records

The next catalog generation uses a new `visual-grid-v3` analysis contract.
Visual-mode candidates must satisfy all of the following:

- `visual_analysis_status = 'analyzed'`;
- `embedding_version = 'visual-grid-v3'`;
- a finite, normalized 512-value artwork descriptor;
- a real perceptual hash; and
- a valid weighted palette plus a persisted visual profile.

Synthetic seed data, download failures, legacy `v1`, and `fallback-v1` records
are not visual evidence. They remain usable for search and music metadata but
are excluded from Art Style and Balanced ranking. This is intentionally a clean
data boundary: the user will clear and repopulate the catalog rather than blend
old descriptors with the new contract.

### Visual profile

Artwork extraction derives and persists a `colorProfile` inside
`visual_features`. It contains neutral coverage, chromatic coverage, weighted
dominant hue and hue concentration, mean lightness, and lightness spread.
This profile is calculated from real decoded pixels alongside the existing
palette, spatial grid descriptor, perceptual hash, and scalar visual features.

The profile lets ranking distinguish a genuinely monochrome cover from a
colorful cover that merely includes a dark background. Existing scalar feature
values remain available only when extracted; scorers do not substitute neutral
defaults for missing values.

### Similarity cache

`album_similarity_cache` gains `final_confidence`, `music_confidence`,
`component_scores`, and `eligibility_version`. Cache rows retain the ranking
score and evidence values that produced them so population output is auditable.
The application scoring version and catalog population worker version change
together; old cache rows are not reused.

## Candidate selection

For visual modes, build a bounded union of:

1. nearest artwork-descriptor candidates from the existing vector RPC;
2. the strongest palette-profile candidates from the verified catalog; and
3. explicitly resolved, verified candidates from the current catalog pool.

Deduplicate by collection ID before detailed ranking. This two-stage process
preserves fast vector recall while preventing a visually appropriate palette
candidate from being omitted solely because its spatial arrangement differs.
Music Relation retains its metadata/artist candidate sources and does not claim
that those results are visual matches.

## Ranking model

Every component scorer returns either a finite measured value or `unavailable`.
Mode-specific required evidence is checked before any score is calculated; any
optional available weights are renormalized rather than filled with 0.5.

### Palette compatibility

Palette compatibility combines weighted CIEDE2000 transport, dominant-rank
agreement, dominant-color agreement, chromatic hue agreement, chromatic
coverage agreement, and lightness agreement. A neutral-aware penalty applies
when two covers share mostly neutral colors but their meaningful chromatic color
masses or dominant hues materially disagree.

Art Style requires strong palette compatibility. Balanced requires moderate
compatibility. This is an eligibility gate, not merely another weighted score;
a pink/green neon cover and a black-and-white cover cannot remain a visual match
because both happen to contain black.

### Art Style

Art Style answers: *does this cover share a visual language?* It requires two
verified visual records, palette compatibility, and the palette plus at least
two additional measured visual components.

`artStyle = 0.48 palette + 0.20 spatial descriptor + 0.14 medium +
0.10 composition + 0.08 typography/texture`

Only available optional components contribute, after renormalization. The score
must meet the Art Style acceptance floor in addition to palette eligibility.

### Balanced

Balanced answers: *is this visually compatible with a meaningful musical
connection?* It has the same verified visual requirements as Art Style with a
less strict palette floor.

`balanced = 0.70 visual + 0.30 music`

where the visual score is palette-led:

`visual = 0.40 palette + 0.25 spatial descriptor + 0.15 medium +
0.10 composition + 0.10 typography/texture`

The music score uses only measured artist affinity, shared genre/style tokens,
and release-era proximity. Its weights are renormalized across available music
evidence rather than inventing default artist similarity.

### Music Relation

Music Relation answers: *is this album musically related?* It does not rank a
cover as visually similar and the UI says so.

`music = 0.60 artist affinity + 0.25 genre/style overlap + 0.15 release era`

It requires at least two evidence sources, except a strong verified artist
affinity may qualify alone. Distinct releases by the same artist are allowed in
this mode (with a small per-artist cap); the source album, duplicate artwork,
and near-identical release variants remain excluded. Visual data may be shown
for context but never boosts this mode's score or explanation.

## Confidence, eligibility, and diversity

Confidence has two inputs:

- **Evidence quality**: coverage of the mode's required and optional measured
  signals, adjusted by the verified-analysis contract; and
- **Agreement**: the final mode score and its decisive component (palette for
  visual modes, artist/genre evidence for Music Relation).

`finalConfidence = evidenceQuality x agreement`

This prevents complete-but-incompatible records from displaying 100% trusted.
The user-facing label is `confidence`, not an unconditional claim of trust.

Candidates must pass all filters in this order before MMR:

1. identity, duplicate-artwork, and record-quality exclusions;
2. mode-specific required evidence;
3. palette compatibility and mode acceptance floor for visual modes;
4. `finalConfidence >= 0.30`; and
5. valid, evidence-backed explanation attributes.

MMR then selects the diverse result set using the full appropriate signature:
visual signature similarity for Art Style and Balanced, and music relationship
similarity for Music Relation. Artist caps preserve variety without suppressing
valid same-artist Music Relation releases.

If a visual tier has too few eligible results, the page shows a limited state
and offers another mode. Metadata fallback remains explicitly labeled as
catalog-related, never as a visual match.

## Presentation and explanation

- Cards show the meaningful mode score and calibrated confidence. Music
  Relation displays `music relation`, not `match` or a visual-match claim.
- The information action is not placed inside a non-interactive artwork overlay.
  Each recommendation card has a dedicated `Why this match` button outside the
  artwork link, with a 44px minimum touch target, an information icon, visible
  text, and `aria-haspopup="dialog"`. In narrow card containers it occupies its
  own full-width row; in wider cards it can share an action row without reducing
  its hit area. Save remains the only interactive artwork-corner control, and
  the match score is display-only. This prevents the info action from competing
  with the artwork link, score badge, or footer controls on mobile and dense
  desktop grids.
- Match explanations expose only components that were actually measured and
  explicitly describe palette, composition, medium, typography, or music
  evidence. No generic visual-mood explanation is fabricated when the signals
  did not qualify.
- The explanation dialog reserves header space for its close control, uses
  safe-area-aware mobile padding and internal scrolling, and presents score,
  confidence, palette, and evidence blocks with non-overlapping spacing. The
  trigger and dialog both support pointer, keyboard, Escape, focus return, and
  outside-click close behavior.
- The card footer is based on the card's available inline width, using a
  container-aware grid. At narrow card widths it stacks a palette/copy row over
  a full-width View button. At wider widths it can place both regions side by
  side. Palette content has `min-width: 0`; controls retain their own minimum
  target and never overflow the card.

## Error handling

- An analysis download or decode failure stores only fallback metadata and is
  excluded from visual modes.
- Invalid palette/profile/descriptor values are rejected during row mapping and
  scoring, not treated as neutral visual attributes.
- A missing candidate pool or insufficient high-quality results produces a
  clear limited state; it does not fill visible slots with weak records.
- Cache writes remain best-effort and only contain already eligible results.

## Verification

Unit tests cover:

- colorful-versus-neutral and opposing-hue palette rejection;
- component unavailability, strict visual-contract exclusion, and fresh v3
  record acceptance;
- all mode formulas, weights, and mode-specific candidate rules;
- confidence changing with agreement and evidence, including exact 30%
  eligibility boundaries;
- filtering before MMR, artist diversity, same-artist Music Relation rules,
  and honest limited/fallback state selection; and
- cache serialization of confidence and component scores.

UI checks cover card widths corresponding to the two-, three-, four-, and
six-column grids, plus 320px and 375px mobile widths. The palette/copy controls
and View action must remain visible, keyboard reachable, and non-overlapping.
At every width, the `Why this match` control must have a visible 44px target,
remain outside the artwork navigation target, open its explanation through
pointer and keyboard activation, and return focus when the dialog closes.
Run the existing test suite and production build after implementation.

## Acceptance criteria

Freshly populated visual tiers contain only `visual-grid-v3` records. A severe
palette conflict cannot appear in Art Style or Balanced even when it shares a
neutral swatch or spatial layout. A card never reports 100% confidence merely
because fields exist. Results below 30% calculated confidence are excluded
before diversity selection, weak tiers are shown honestly, and card controls do
not clip in dense grids. The match-information action remains clearly spaced
and interactable in desktop and mobile card layouts.
