# Scroll-Safe Dual-Format Share Studio Design

## Objective

Redesign Articol's album sharing experience for reliable use on mobile and
desktop. The Share Studio must remain internally scrollable on short mobile
viewports, always restore page interaction after closing, remove confusing
store-price presentation, and produce a polished portrait image that can be
posted to Instagram while retaining a purpose-built social-link preview.

## Confirmed product decisions

- Use two canonical share assets because image posts and link previews have
  different layout constraints.
- Generate a 1080 x 1350 (4:5) portrait post image for native image sharing and
  download.
- Retain a 1200 x 630 social-link preview for Open Graph and Twitter-compatible
  link unfurls.
- Remove store price from the album detail presentation and every share asset.
  Country/storefront and release year remain useful archival metadata.
- Do not claim to open Instagram directly. Available destinations come from the
  device's native share sheet.

## Visual direction

The Share Studio uses Articol's editorial-luxury language: near-black ink
surfaces in dark mode, warm paper surfaces in light mode, a restrained display
serif, precise sans-serif supporting text, generous negative space, and
album-derived palette accents.

The portrait post image makes the square cover the dominant visual. The Articol
label, album title, artist, release year, storefront, and up to five palette
swatches form a quiet editorial caption below it. The composition maintains a
safe inset so common social-media crops do not remove identity or metadata.
Long titles and artist names use deterministic truncation or bounded type
scaling so the output remains stable.

Major surfaces use a nested double-bezel treatment: a subtle outer shell and a
concentric inner surface. Controls retain 44-pixel minimum targets. Motion uses
only opacity and transform with custom physical easing and includes a reduced-
motion path.

## Responsive Share Studio

### Desktop

The Share Studio opens as a centered dialog below the application header. Its
content is an editorial split: the portrait preview occupies the larger left
region; format details and actions occupy the right. The dialog never exceeds
the available dynamic viewport height.

### Mobile

The Share Studio becomes a bottom sheet. Rotation and overlap are removed. The
sheet has three deliberate layers:

1. a fixed backdrop that absorbs outside interaction;
2. a sticky sheet header containing the accessible title and close control;
3. exactly one vertically scrollable content viewport containing the preview,
   status, and actions.

The scroll viewport uses `overflow-y: auto`, contained overscroll, momentum
scrolling where supported, and bottom safe-area padding. Neither the preview nor
the action region introduces a competing vertical scroll container. The sheet
must work at 320, 375, and 390 CSS pixels wide and on short landscape viewports.

## Dialog Frame module

The current share and match dialogs independently mutate `document.body` and
own overlapping height, close, and focus behavior. This is a shallow interface:
the same difficult implementation details are repeated, and cleanup failures
can leave the page locked.

Introduce a deep Dialog Frame module. Its small interface accepts dialog
content, accessible labelling, open/close intent, and presentation modifiers.
Its implementation owns:

- capture and restoration of the exact pre-open body overflow value;
- a reference-counted page lock so overlapping dialogs cannot restore stale
  state;
- focus capture, initial focus, focus containment, and focus return;
- Escape, backdrop click, and explicit close-button behavior;
- exit timing and guaranteed cleanup when unmounted during an animation;
- one internal scroll viewport and sticky header structure; and
- safe-area-aware mobile layout.

The Share Studio and `WhyMatchModal` become adapters at this seam. This increases
leverage because both callers receive the complete lifecycle through one small
interface, and it improves locality because scroll-lock bugs are fixed and
tested in one place. The interface is the test surface.

## Share asset module

Create a deep share asset module around album share identity. It owns canonical
page paths, landscape-image paths, portrait-image paths, filenames, dimensions,
and user-facing share payloads.

Two adapters make this a real seam:

- the landscape adapter renders the existing 1200 x 630 social-link preview;
- the portrait adapter renders the 1080 x 1350 post image.

Both adapters consume the same normalized album share identity and palette so
metadata cannot drift. Rendering stays server-side and crawler-safe. Missing
catalog data, artwork, or palettes produces a stable neutral fallback rather
than a broken response.

## Sharing behavior

The primary action is **Share portrait card**:

1. Fetch the portrait asset.
2. Convert the response to a named PNG `File`.
3. Check file-sharing support with `navigator.canShare({ files })` when
   available.
4. If supported, call `navigator.share` with the image file and concise album
   text. A user cancellation is not an error.
5. If file sharing is unsupported or fails for a non-cancellation reason,
   download the PNG and explain that it can be posted from Photos or Gallery.

The secondary actions are **Download image** and **Copy album link**. Copying the
album URL remains the universal link-sharing path and receives the landscape
social-link preview on platforms that process page metadata.

Object URLs created for download are revoked after use. Action state prevents
duplicate requests while sharing or downloading. Errors are announced without
removing the close control or blocking other actions.

## Price removal

Remove formatted store price from the album metadata card and Share Studio.
Neither share renderer includes price. Keep price fields in the album data model,
database mapping, and catalog ingestion because presentation cleanup does not
prove that those data consumers are obsolete. The deletion test does not
justify a new pricing module.

## Accessibility and interaction

- The Dialog Frame exposes `role="dialog"`, `aria-modal="true"`, an accessible
  title, and optional description.
- Opening moves focus to the close button or the first meaningful control.
- Tab and Shift+Tab remain within the open dialog.
- Escape, the close button, and backdrop click all use the same close path.
- Closing restores focus to the share trigger when it still exists.
- The backdrop blocks page pointer events only while mounted.
- After every close path, page scrolling and controls work immediately.
- Status and errors use an appropriate live region; cancellation stays silent.
- Touch targets are at least 44 x 44 CSS pixels.

## Error handling

- A portrait preview failure shows a stable fallback while leaving download,
  link copy, and close actions available where possible.
- A network or file-conversion failure reports that image sharing was
  unavailable and preserves link copy as a fallback.
- A blocked clipboard uses the existing safe copy fallback.
- A missing artwork URL renders a branded neutral card rather than failing the
  image route.
- Unmounting during the exit transition synchronously releases focus and the
  page lock.

## Verification

### Unit and module tests

- Share paths normalize storefronts for page, landscape, and portrait assets.
- Asset dimensions and download filenames are stable.
- Capability detection selects file share or download correctly.
- `AbortError` from native sharing does not display an error.
- Fetch and file errors reach the download/link fallback state.
- The page-lock implementation preserves a pre-existing overflow value and
  handles nested acquisitions and releases.

### Dialog interaction tests

- Repeated open/close cycles restore body overflow every time.
- Close button, Escape, and backdrop paths all unlock the page.
- An interrupted exit/unmount still unlocks the page.
- Focus enters, remains within, and returns to the originating trigger.
- Content scrolls inside the sheet at 320 x 568 and 375 x 667 viewports.
- The page behind the open dialog does not scroll or receive pointer input.
- Closing the dialog restores page scrolling and button/link interaction.

### Visual and integration checks

- Check mobile widths of 320, 375, and 390 pixels; mobile landscape; tablet;
  and desktop.
- Verify dark and light themes, long metadata, missing palette, missing artwork,
  and reduced motion.
- Verify both generated PNGs have exact dimensions and safe-area composition.
- Verify Open Graph and Twitter metadata continue to use the landscape asset.
- Verify share/download behavior on iOS Safari, Android Chrome, and a desktop
  browser without file-sharing support where available.
- Run the complete Vitest suite and a production Next.js build.

## Acceptance criteria

The Share Studio is fully usable on short and narrow mobile viewports. Users can
scroll from its header through every action. Closing it through X, Escape,
backdrop, native-share completion/cancellation, or an interrupted animation
never leaves the page locked or inert. The portrait card can be shared as a file
on capable devices and downloaded everywhere else. Album links retain a polished
landscape preview. Neither the album page nor either share image displays a
store price. The experience remains accessible, visually coherent in both
themes, and functional when image generation or native sharing fails.
