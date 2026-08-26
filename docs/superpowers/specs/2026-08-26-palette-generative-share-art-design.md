# Palette-Driven Generative Share Art Design

## Objective

Rewrite Articol's generated portrait artwork so the album palette determines
the composition rather than merely coloring random shapes. Add clear loading
motion for the initial portrait generation and for switching between selected
art designs, while preserving the last successful image and the existing
1080 x 1350 share-card format.

## Confirmed product decisions

- Keep the original album-cover portrait as one sharing option.
- Replace the five current palette-art renderers with five original generative
  systems inspired by n-gen's data-to-form approach.
- Use the album palette as the sole visual-data source. Album identity supplies
  only a deterministic seed; title, artist, country, and year remain metadata.
- Use all available valid palette colors, up to ten, in every generated design.
- Generate server-side SVG primitives inside the existing `ImageResponse`
  route so preview, download, and native file sharing use one canonical PNG.
- Keep the previous successful preview visible while another style generates.
- Do not copy n-gen's artwork, names, assets, or exact layouts.

## Reference principles

n-gen exposes multiple generative templates such as DNA, Top Ten, Bloom, and
Chords. Its documented interaction maps personal music data to visual
parameters, offers per-template customization, and explains how the data
affected the result. Articol will adopt that system-level idea: palette data
must control form, hierarchy, rhythm, and density, not just fill color.

References:

- https://ngenart.com/spotify
- https://ccstartup.com/blog/2023/07/24/how-to-use-n-gen-a-tool-making-art-out-of-your-spotify-data/
- https://www.reddit.com/r/p5js/comments/130tk1l

## Palette analysis model

Introduce a normalized `PaletteArtModel` built once per request. It contains:

- ordered valid colors with stable indices;
- relative luminance for every color;
- HSL hue and saturation values;
- hue distance between neighboring colors;
- average luminance and saturation;
- luminance range as the palette's contrast score;
- circular hue spread as the palette's variety score;
- warm-versus-cool balance;
- deterministic per-color prominence inferred from source order; and
- a stable seed derived from album ID and style ID.

The source palette remains immutable. Derived values are clamped to documented
ranges so malformed or nearly monochrome palettes cannot produce invalid SVG
coordinates. Missing or invalid colors use the existing neutral fallback.

Every renderer accepts only `PaletteArtModel` and fixed canvas dimensions. This
keeps palette interpretation separate from drawing and makes each style
independently testable.

## Generative designs

### Chromatic Bloom

Create concentric petal layers around a quiet center. Each palette color owns at
least one petal. Saturation controls petal width, luminance controls radial
distance, source prominence controls petal length, and palette contrast controls
the number of visible layers. The result is botanical without reproducing
n-gen's Bloom composition.

### Palette DNA

Draw two opposing sinusoidal strands joined by colored rungs. Palette order
determines rung order, hue distance controls rung spacing, saturation controls
strand thickness, and warm/cool balance controls phase offset. All geometry is
deterministic and remains inside the square artwork safe area.

### Chord Map

Place one weighted node per palette color around a circle. Node size reflects
source prominence. Connect colors with short chords when their hues are related
and long chords when contrast is high. Luminance controls orbital radius. The
background and structural lines use derived dark neutrals so no palette color
is overwritten or hidden.

### Spectrum Code

Create one horizontal waveform band per palette color. Luminance controls
amplitude, saturation controls stroke width, hue distance controls wavelength,
and prominence controls repetition. Bands use controlled overlap and preserve a
clear outer frame so the result reads as a designed poster rather than a chart.

### Orbital Weave

Arrange palette colors as nested elliptical paths and moving-point snapshots.
Prominent colors receive larger bodies, luminance controls distance from the
center, hue spread controls orbital eccentricity, and contrast controls the
number of connecting threads. The final image is static; motion is implied by
repeated positions and trajectories.

## Renderer architecture

Split the current large renderer into focused modules:

- `paletteArtwork.ts` owns style metadata, validation, color conversion,
  deterministic seeding, and `PaletteArtModel` construction.
- `PaletteArtCanvas.tsx` owns the SVG canvas and style dispatch.
- One renderer function or component per generative design owns only its shape
  construction.
- `ShareImageArtwork.tsx` remains responsible for the 4:5 editorial share-card
  frame, metadata, palette swatches, and choosing cover versus generated art.
- The existing share-image route continues parsing `variant` and `style`, then
  supplies the normalized album data and deterministic seed.

SVG output uses explicit numeric coordinates, fills, strokes, opacity, circles,
ellipses, lines, polygons, and paths. Avoid CSS filters, runtime animation,
foreign objects, unsupported layout shorthand, and network-fetched renderer
assets. This keeps the server output compatible with Next.js `ImageResponse`.

## Selection and asset data flow

The modal distinguishes intent from completed output:

- `requestedVariant` and `requestedStyle` represent the user's current choice.
- `displayedAsset` stores the latest successfully fetched variant, style, file,
  and object URL.
- `assetState` is `idle`, `initial-loading`, `regenerating`, `ready`, or `error`.
- An incrementing `activeRequestId` and one `AbortController` prevent stale
  responses from replacing a newer selection.

When a user chooses generated art or another style:

1. Update the requested selection immediately.
2. Abort the previous pending request.
3. Enter `initial-loading` when no successful image exists, otherwise enter
   `regenerating` and retain the displayed image.
4. Fetch and validate the requested PNG.
5. Swap the displayed asset only after the new file succeeds.
6. Revoke the replaced object URL.
7. Enable share and download only when the requested selection matches the
   displayed asset.

The selected control represents the requested style. A small loading indicator
inside that control makes the pending state explicit. The caption continues to
describe the displayed image until the replacement succeeds.

## Loading experience

### Initial portrait generation

Use a skeleton matching the actual 4:5 preview frame. It contains animated
palette bands derived from the album's colors, a restrained orbiting indicator,
and rotating sarcastic copy every few seconds:

- "Teaching these colors to cooperate."
- "Making beige feel emotionally significant."
- "Asking the palette to form a personality."
- "Rearranging colors with unjustified confidence."
- "Turning color theft into visual culture."

The skeleton appears only when no usable portrait is available.

### Style regeneration

Keep the last successful image visible. Add a translucent palette veil and a
single moving scan line over the preview. The requested style button receives a
compact spinner or animated thumbnail and `aria-busy="true"`. Other style
controls remain usable so users can change their minds; each new choice aborts
the previous request. Share and download actions are disabled until the
requested image succeeds, preventing the wrong design from being exported.

### Reduced motion

Under `prefers-reduced-motion: reduce`, replace continuous motion with a static
palette skeleton and one opacity change. Rotating copy may continue without
animated transitions. No loading state depends on motion alone.

## Error handling

- If initial generation fails, show the branded fallback with a Retry action
  and preserve copy-link and close controls.
- If regeneration fails, keep the last successful preview rather than showing
  "Preview unavailable". Restore the requested controls to the displayed
  selection, re-enable sharing for that valid asset, show an inline error naming
  the failed style, and offer Retry.
- A stale or aborted request is silent and cannot change the preview or status.
- Validate `response.ok`, `Content-Type`, and non-empty blob size before marking
  an image ready.
- Share and download always operate on the successfully displayed file, never a
  requested-but-incomplete style.
- Object URLs are revoked on replacement and unmount.

## Accessibility

- The preview region uses `aria-busy` while generating.
- Loading and failure messages use a polite live region.
- The selected style remains exposed through the existing radio-group semantics.
- Busy indicators include text or an accessible label and are not color-only.
- Controls retain 44-pixel touch targets and visible focus treatment.
- Reduced-motion behavior applies to the skeleton, scan line, spinner, and
  selected-thumbnail animation.

## Testing and verification

### Palette model tests

- Invalid colors are discarded and missing palettes use the neutral fallback.
- At most ten colors are retained in stable order.
- Luminance, saturation, hue distance, contrast, temperature, and prominence
  stay within their documented ranges.
- Album/style seeds produce deterministic models.
- Monochrome, two-color, and ten-color palettes all produce finite geometry.

### Renderer tests

- Every style produces a bounded SVG tree for the same model.
- Every retained palette color appears in every design.
- Repeated rendering with the same album and style is deterministic.
- Generated paths contain no `NaN`, `Infinity`, unsupported external asset, or
  out-of-bounds coordinates.
- All five route variants return `200`, `image/png`, and non-empty output.

### Modal state tests

- Initial loading displays the palette skeleton and disables image actions.
- Style regeneration preserves the previous image and marks only the requested
  style busy.
- A later selection aborts and supersedes an earlier request.
- Failed regeneration preserves the last successful image and exposes Retry.
- Successful regeneration updates preview, caption, filename, share file, and
  download file together.
- Object URLs are revoked when replaced and when the modal unmounts.
- Reduced-motion mode removes continuous animation.

### Visual checks

- Review all five designs with monochrome, muted, highly saturated, warm, cool,
  low-contrast, and ten-color palettes.
- Check long album metadata and neutral fallbacks.
- Verify the preview and exported PNG at 1080 x 1350.
- Verify mobile widths of 320, 375, and 390 pixels plus desktop and short
  landscape viewports.
- Run the complete Vitest suite and a production Next.js build.

## Acceptance criteria

Each generated design visibly and structurally responds to the album palette,
uses every valid available color, remains deterministic, and renders through
the production share-image route without a 500 response. The initial preview
has an album-colored loading skeleton. Switching styles preserves the previous
image under a clear regeneration overlay, prevents stale requests from winning,
and never exports an incomplete or mismatched design. Failures remain retryable
without sacrificing link sharing or the last valid preview. Motion is polished,
accessible, and disabled appropriately for reduced-motion users.
