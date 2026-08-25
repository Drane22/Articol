# Palette Art Share Variants Design

## Objective

Add a second portrait-share mode that creates original, deterministic artwork
from an album's extracted palette instead of displaying the album cover as the
main image. The generated artwork must remain a valid 1080 x 1350 portrait
share card, preserve readable album identity, and offer five selectable visual
styles.

## Confirmed product decisions

- Generation is procedural and server-rendered; no image-generation API is
  required.
- All five styles are available:
  1. Spectral Field — layered translucent gradients and organic color pools.
  2. Orbit Atlas — concentric rings, orbit paths, dots, and radial markers.
  3. Cut-Paper Drift — overlapping geometric paper-like shapes with depth.
  4. Moiré Pulse — repeated waves and fine lines that create color interference.
  5. Ink Bloom — dark ink-like fields with radial blooms and restrained grain.
- Share Studio gets an Album cover / Palette art mode switch.
- Palette art exposes five selectable style choices and updates the portrait
  preview for the selected style.
- Share and download actions use the selected palette-art variant.
- The landscape social-link preview remains the regular album-cover asset.
- Generated artwork uses all available palette colors, up to 10. If fewer than
  10 colors exist, the renderer reuses or blends available colors rather than
  failing.
- The result is deterministic for the same album, style, and format. Preview,
  native share, and download resolve to the same image.

## Composition and safe area

Every palette-art renderer targets the existing 1080 x 1350 portrait canvas and
uses the same composition contract:

- The outer background fills the complete canvas.
- A protected artwork region is inset from the card edge.
- The generated shapes stay inside the artwork region and are clipped to its
  rounded frame.
- A quiet metadata footer sits below or over the lower edge of the artwork
  region, depending on the style, with enough contrast for title, artist,
  country, release year, and Articol branding.
- No generated shape may overlap the footer's text-safe area.
- Long titles and artist names use the existing bounded truncation rules.

The renderer uses a shared palette normalization and deterministic seed. Style
functions receive the normalized colors, seed, dimensions, and metadata rather
than reaching into album storage or browser state.

## Style recipes

### Spectral Field

Use a deep base tone, broad radial or elliptical color fields, and 6–10 softly
overlapping translucent shapes. Color order controls depth, while the seed
controls placement, scale, and rotation. The result should feel luminous but
remain calm behind the metadata.

### Orbit Atlas

Use a dark base, a central focal point, concentric rings, one or more elliptical
orbits, small palette-colored markers, and sparse radial ticks. Use the seed to
select the focal point and orbit eccentricity. Keep line weights thin so the
image reads as a designed diagram rather than a technical chart.

### Cut-Paper Drift

Use 6–10 polygons or rounded quadrilaterals, each filled by a palette color and
layered with restrained opacity and offset depth. Shapes remain within the
artwork clip and avoid the footer. The seed controls polygon points, rotation,
and overlap order. Preserve enough negative space for an editorial feel.

### Moiré Pulse

Use a dark or mid-tone base with repeated curved paths, arcs, or stepped bands.
Palette colors are assigned across the line families with low-opacity overlaps.
The seed controls wave frequency, angle, and amplitude. Avoid excessive density
near text so the footer remains legible.

### Ink Bloom

Use a dark base with several irregular radial blooms, layered soft-edged shapes,
and a small amount of deterministic grain-like detail. The seed controls bloom
centers and spread. Use the lightest palette colors sparingly as highlights so
the result feels atmospheric rather than noisy.

## Share asset architecture

Extend the share identity with an explicit portrait variant and style. The
default portrait URL remains the canonical album-cover image for compatibility.
Palette-art URLs are explicit and contain the style identifier, for example a
portrait route query such as `variant=palette&style=spectral-field`.

The share data module returns all 10 available palette colors instead of
truncating the palette to five. It continues to provide the existing neutral
fallback palette when artwork metadata is missing. The route validates the
variant and style, defaults unknown values to the canonical portrait cover, and
keeps the existing cache and image dimensions.

The client preview, fetch-for-share path, and download filename all use the
same selected variant URL. The album link and landscape image route do not
change.

## Share Studio interaction

The portrait preview remains the primary visual anchor. Below or beside it,
Share Studio adds a compact variant control:

- `Album cover` keeps the current image.
- `Palette art` reveals a horizontal or responsive list of five style chips.
- Each style chip includes a small generated thumbnail or abstract swatch,
  the style name, and a selected state.
- On narrow screens the style list can scroll horizontally without creating a
  second vertical scroll container.
- Changing the style updates the preview and resets any stale asset-loading
  status.
- The primary action label reflects the selected output, such as `Share palette
  artwork` or `Download palette artwork`.

The format explanation and dialog viewport behavior remain unchanged. The
generated image must work with the existing native file-share and download
fallbacks.

## Error handling and fallbacks

- Missing or invalid palette colors use the neutral fallback palette.
- Unknown style or variant query values render the canonical album-cover image.
- SVG/rendering failures return a stable neutral palette composition rather than
  a broken image response.
- Preview loading and share/download errors preserve the close control, style
  selection, and album-link sharing.
- The landscape social-link preview is never replaced by a palette-art variant
  through an accidental query or client state leak.

## Accessibility and motion

- Variant and style controls use semantic buttons or a radio-group pattern with
  visible selected state and keyboard support.
- Each generated preview has an accessible description naming the variant and
  style.
- Preview transitions use opacity and transform only, with a reduced-motion
  path.
- Style thumbnails remain decorative when the adjacent text already names the
  option.
- The existing DialogFrame focus, Escape, backdrop, and single-scroll behavior
  remain authoritative.

## Verification

- Unit-test palette normalization, ten-color preservation, deterministic seed
  behavior, style validation, and fallback selection.
- Verify every style returns a 1080 x 1350 portrait response.
- Verify all five styles stay inside the artwork clip and preserve the metadata
  safe area at short and long titles.
- Verify preview, native share, and download use the same selected URL.
- Verify the default portrait and landscape routes remain unchanged.
- Verify missing palettes, fewer than 10 colors, invalid style values, and
  missing artwork.
- Run the complete test suite and production build when the local JavaScript
  runtime is available.

## Acceptance criteria

Share Studio offers an Album cover / Palette art choice with five selectable
procedural styles. Each style uses the album's extracted palette, produces a
stable 1080 x 1350 share image, fits inside the existing card safe area, keeps
metadata readable, and works through the existing share/download actions.
