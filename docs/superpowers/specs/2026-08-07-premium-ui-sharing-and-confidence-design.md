# Premium Album Sharing, Mobile UI, and Confidence-Gated Recommendations

## Goal

Make the active Next.js Articol experience feel intentional and premium across desktop, mobile, and link-sharing surfaces. The redesign must make the album share preview consistent across the in-app modal and social platforms, fix mobile touch/click reliability, make extracted palettes useful, add restrained purposeful motion, and prevent weak recommendations from being presented as trustworthy matches.

## Scope and cleanup boundary

The active product is the Next.js route tree under `app/app` with shared UI and domain code under `app/src`. The older standalone React/Vite flow is not part of the product surface. Before deletion, verify imports and route usage; then remove only legacy files that have no Next.js consumers, including the old `src/App.jsx` entry flow, its `main.jsx` bootstrap, legacy `index.css`, legacy album details/search/service modules, and exclusive Vite demo assets. Keep catalog data, current API routes, shared types, tests, and any module still imported by the Next.js app.

Existing unrelated worktree changes must be preserved.

## Visual system

Use an editorial-luxury direction: warm paper and ink surfaces, a restrained serif display face paired with a clean sans-serif body face, nested card surfaces, generous spacing, and album-derived color as the accent rather than a global rainbow treatment.

The extracted palette is a first-class product signal:

- Shared images include a compact five-swatch strip beneath the album metadata.
- The share modal displays the exact same palette-bearing image used by social crawlers.
- Album cards use centered palette swatches in a dedicated footer row without competing with Save or View actions.
- The album detail hero uses the first few palette colors only as a low-opacity ambient wash behind readable surfaces.
- Match explanations show query and candidate palettes as aligned labeled rows.

All palette-driven accents must preserve readable text contrast and remain useful when a palette is missing or incomplete.

## Canonical sharing contract

The server-rendered `/album/[id]/opengraph-image` becomes the single visual source of truth for sharing. It renders a fixed 1200x630 composition with a safe crop area, cover artwork, Articol label, album title, artist, release year/storefront, and palette swatches. Because the current edge route only reads iTunes metadata, the implementation must add a server-safe catalog lookup for stored palette data (or move the image route to the compatible server runtime); if no analyzed palette is available, it renders a neutral swatch treatment. It must remain useful when the external catalog or artwork is unavailable by rendering a stable fallback treatment.

The album page and metadata layer use one shared URL contract for the absolute page URL and absolute image URL. The client share URL preserves the selected storefront. The crawler-safe metadata path retains the existing stable PH default because the current Next layout metadata boundary cannot read page search params; the album identity, artwork, and composition remain the same across storefronts. `generateMetadata` publishes the page title, description, `og:url`, `og:image` with dimensions and alt text, and a Twitter `summary_large_image` card. The image route must be publicly fetchable by crawlers and must not depend on client state.

`ShareCardModal` receives the canonical image URL and displays it directly rather than rebuilding a second HTML version of the card. Native share shares the album page URL; copy-link is the universal fallback. The modal reports copy/share failures without treating user cancellation as an error.

## Responsive interaction design

All controls that can be tapped receive a minimum 44px target. The mobile header keeps navigation, search, country, and theme controls in non-overlapping regions. The storefront control remains a native `<select>` inside a styled, full-size wrapper so the OS picker stays reliable while the visible field has adequate space, contrast, and a clear chevron.

Album cards separate artwork navigation from overlay actions. The artwork link owns the cover surface; Info and Save controls sit above it with centered `inline-flex` icons, explicit z-order, and event propagation guards. The footer gives palette/copy and View their own stable row or stack, with no controls relying on baseline alignment or incidental padding.

The share dialog is a centered desktop dialog and a mobile bottom sheet. It supports `role="dialog"`, `aria-modal`, an accessible title, Escape close, outside-click close, focus return, body-scroll locking, internal scrolling, safe-area padding, and a clear stacked mobile action layout. The existing match explanation modal follows the same reliable overlay and control conventions.

## Motion design

Motion is used for feedback, orientation, continuity, and occasional delight:

- Modal overlay and panel enter/exit as a paired transition using opacity and transform, with a 220–300ms custom enter curve and a faster exit.
- Buttons provide subtle press scale and color/opacity feedback; image hover scale is limited to fine pointers.
- Search and dropdown surfaces emerge from their trigger with short opacity/transform transitions.
- Search/recommendation results may reveal on viewport entry through `IntersectionObserver` with a small, bounded stagger.
- Palette and copied states transition in place so the user can see continuity.

Use CSS transitions before JavaScript animation. Do not use `transition: all`, animate layout properties, attach scroll listeners for reveals, or permanently promote elements with `will-change`. Every motion path has a `prefers-reduced-motion: reduce` fallback that keeps state changes immediate or opacity-only.

## Confidence-gated recommendations

Add a single domain constant `MIN_RECOMMENDATION_CONFIDENCE = 0.30`. Confidence is not the same as similarity score. The ranking engine calculates evidence coverage from signals actually available for the active mode, then derives `finalConfidence` from similarity and evidence coverage. `finalConfidence` and `visualConfidence` must no longer be hardcoded to `1.0`.

Filter candidates below the threshold before MMR selection so weak candidates cannot consume visible result slots. The active tier displays only eligible results. The client does not receive low-confidence explanation payloads for rendering.

If a mode has too few eligible matches, show a clear empty/limited state that offers another ranking mode. If no visual tier has enough eligible results, request the existing metadata-related endpoint and label those results explicitly as related by catalog metadata, not visual matches. Never present a metadata fallback as if it passed the visual confidence gate.

The card and match explanation use the meaningful match score for ranking context and expose confidence only where it helps explain trust. They omit unavailable component scores, reasons, and attributes instead of filling the interface with guessed data.

## Component and data boundaries

- `ShareCardModal`: canonical image preview, native share, copy-link status, close/focus behavior.
- Shared share URL/metadata helper: absolute page/image URL construction and storefront normalization used by page and metadata code.
- Ranking confidence helpers: pure calculations and threshold filtering alongside the visual engine, covered by unit tests.
- Album page recommendation section: owns loading, error, empty, limited, mode-switch, and metadata-fallback states.
- `AlbumCard`: saved-state initialization, action event isolation, responsive action layout, palette footer, and similarity display.
- Shared overlay/modal styles: consistent responsive behavior for share and match explanation surfaces.

## Failure handling

- Missing artwork in the OG route produces a stable placeholder while preserving the title, artist, and palette metadata that is available.
- Native share unavailability falls back to copy-link; user cancellation is silent.
- Clipboard failure shows a concise actionable status and leaves the modal usable.
- Recommendation failure preserves the album page and offers retry; no partial low-confidence tier is silently displayed.
- A missing palette falls back to neutral swatches/surfaces without breaking card layout.
- Legacy cleanup is recoverable through version control and must not remove any module proven to be used by Next routes.

## Verification and acceptance criteria

Unit tests cover confidence calculation, missing evidence, exactly-30% boundary behavior, pre-MMR filtering, and alternative-state selection. Existing tests remain green.

Static checks confirm there are no live imports of deleted legacy files, no `transition: all`, no layout-property animation, and no modal/card click target overlap. Run the production build.

Responsive checks cover 320px, 375px, 768px, and desktop widths. Verify country selection, card Info/Save/View, copy palette, modal close/focus, native share fallback, reduced motion, and keyboard activation. Verify metadata exposes an absolute 1200x630 OG image URL and the image route renders with both successful and unavailable external artwork.

Success means the modal preview and platform preview use the same image, controls are reliably clickable on touch and keyboard, palette information is visually coherent across surfaces, no result below 30% confidence is shown, alternatives are honestly labeled, and the active Next.js app builds without the obsolete legacy flow.
