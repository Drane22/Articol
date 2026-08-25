# Loading Copy and Viewport-Safe Dialog Design

## Objective

Make recommendation loading feel alive and lightly sarcastic, make Share
Studio explain its two output formats without redundant technical cards, and
make Share Studio and Why this match remain usable across short desktop and
mobile viewports without a competing page-like scroll experience.

## Confirmed product decisions

- Loading copy rotates every few seconds and combines playful snark with
  sharper, still brand-safe sarcasm.
- The loading rotation includes the following nine lines:
  - “Pretending this is a very serious music investigation.”
  - “Making guesses with suspicious confidence.”
  - “Comparing covers like this is a peer-reviewed discipline.”
  - “Asking the algorithm to explain its taste.”
  - “Sorting vibes into categories that definitely exist.”
  - “Checking whether these covers have chemistry or just good lighting.”
  - “Doing the math. The vibes remain unverified.”
  - “Looking for a match with plausible deniability.”
  - “Curating a shortlist. Please act surprised when it gets weird.”
- The rejected loading line about an album texting at 2 a.m. is not included.
- Share Studio replaces the two large format cards with a compact “Two ways
  to share” panel:
  - `POST` — `4:5 portrait` — “For sharing the artwork itself.”
  - `LINK` — `1200 × 630` — “For album links. Applied automatically.”
- Each format row shows a small dimension badge. The panel does not repeat
  platform-specific explanations or use oversized icon cards.
- Both dialogs use the existing Dialog Frame lifecycle and one internal scroll
  viewport. The viewport scrolls only when the available dynamic height truly
  cannot contain the content.

## Components and behavior

### RecommendationLoading

Replace the staged three-message timeout sequence with a rotating message
sequence driven by one interval. The initial line renders immediately, then
advances at a consistent interval of approximately three seconds and wraps
back to the first line. The interval is cleared on unmount.

The current status region remains a live status region. The rotating phrase is
the accessible label and visible primary status, while the supporting line
remains stable so screen readers do not receive unnecessary repeated context.
The message transition uses opacity/transform only and respects reduced motion.

### ShareCardModal

Keep the portrait preview, palette, archive metadata, and existing actions.
Replace the two `.share-format-card` blocks with one semantic format panel.
The panel has an eyebrow label, two compact rows, a restrained divider, and a
right-aligned dimension badge for each row. The copy describes the job of each
asset rather than repeating where platforms consume it.

The portrait preview remains the visual anchor. On desktop it is constrained by
both the available dialog height and its 4:5 aspect ratio so the preview and
primary actions can normally be seen together. On narrow screens it remains a
single-column flow inside the dialog viewport.

### DialogFrame and dialog sizing

The panel and its scroll viewport become a flex column with explicit
`min-height: 0` boundaries. The panel uses the available dynamic viewport
height, bounded by the application header and dialog insets. The scroll
viewport owns vertical overflow and has contained overscroll; descendants do
not create another vertical scrolling region.

The sticky header remains inside that viewport so the close control stays
available while content scrolls. On mobile the panel becomes a full-width
bottom sheet with safe-area padding and the same one-viewport rule.

Share Studio uses a height-aware editorial split on larger screens. The preview
column may shrink to fit the available height, while the tools column keeps
actions reachable. Why this match uses the same available-height shell and
keeps its comparison, score, story, and evidence sections in the same single
scroll flow. Existing mobile stacking remains, with tighter spacing where
needed to avoid unnecessary scrolling.

## Accessibility and motion

- Keep `role="status"` and `aria-live="polite"` for loading updates.
- Keep dialog labelling, focus trapping, Escape, backdrop close, and focus
  restoration provided by DialogFrame.
- Preserve minimum touch target sizes for close and action controls.
- Animate loading text changes with opacity and transform only.
- Stop or minimize motion under `prefers-reduced-motion`.
- Ensure format rows remain readable when dimension badges wrap on narrow
  screens.

## Verification

- Add or update focused tests only where behavior is exposed as a testable
  module; otherwise verify the timer cleanup and rendered copy through the
  component build/type check.
- Run the existing Vitest suite.
- Run a production build.
- Manually verify Share Studio and Why this match at short desktop height,
  320px mobile width, 375px mobile width, and a normal desktop viewport.
- Verify the rejected loading line is absent and all nine approved lines are
  present in the source.
- Verify the compact POST/LINK panel replaces both old format cards and that
  only the Dialog Frame viewport scrolls.

## Acceptance criteria

Recommendations no longer display a static-looking loading message. Share
Studio presents a clear, compact two-output explanation with POST/LINK rows
and dimension badges. Both dialogs fit their available viewport whenever
possible, scroll through one contained viewport when necessary, preserve close
and action access, and remain usable on narrow mobile screens.
