# articol — Visual Album-Search and Discovery Platform

> **Find records by the way they look.**
> 
> *Search an album, study its artwork, and discover records with a similar visual language.*

Articol is a visual album-search and discovery platform that prioritizes visual qualities—composition, illustration style, photography, typography, color palette, texture, mood, subject placement, and visual complexity—over pure genre or artist metadata matching.

---

## Key Features

- **iTunes Search & Lookup API Integration**: Live server-side iTunes album search with configurable country storefronts (`PH` default).
- **Multimodal Visual Similarity Engine**:
  - 512-dimension normalized CLIP embeddings (`clip-vit-base-patch32`).
  - Earth Mover's Distance / CIEDE2000 color similarity across 5 extracted CIELAB dominant palette colors.
  - Spatial layout similarity (subject centroid X/Y, symmetry, negative space, foreground ratio).
  - Typography coverage and scale analysis.
  - Visual complexity metrics (entropy, edge density, grain).
- **3 User-Selectable Ranking Modes**:
  - **Art Style** (`alpha = 0.92`): Visual resemblance is overwhelmingly prioritized.
  - **Balanced** (`alpha = 0.72`): Visual resemblance primary with enhanced musical relationship context.
  - **Music Relation** (`alpha = 0.40`): Musical relationship becomes stronger while preserving visual match.
- **Maximum Marginal Relevance (MMR)**: Diversity reranking (`lambda = 0.80`) preventing duplicate cover variations.
- **Explainable Matches**: Deterministic natural language explanations ("Why this match") and match reason chips.
- **Confidence-Gated Recommendations**: Results below 30% evidence confidence are withheld and replaced with clearly labeled catalog-related alternatives when available.
- **Canonical Share Cards**: Album pages expose a stable Open Graph image with the cover artwork, metadata, country context, and extracted palette so previews stay consistent across Messenger, Viber, and other platforms.
- **Palette-Aware Experience**: Dominant cover colors are surfaced throughout album cards, detail pages, copyable palette controls, and share previews.
- **Responsive Mobile UI**: Touch-safe controls, centered card actions, compact country/theme controls, bottom-sheet modals, and layouts designed for narrow screens.
- **Premium Motion and Accessibility**: Focus-visible states, keyboard-friendly dialogs, reduced-motion support, restrained hover/press transitions, and mobile-safe interaction zones.
- **Digital Cover Archive (Explore Mode)**: Dynamic color spectrum slider control, decade filters, visual attribute tags, and curated collections (Quiet Minimalism, Red and Black, Dreamlike Portraits, Hand-Drawn Worlds, Brutalist Type, Analog Grain, Soft Pastels, Dark Monochrome, Maximalist Collage).
- **Saved References**: Local storage personal cover archive.
- **PostgreSQL & pgvector Support**: Complete SQL schema migration script with ANN vector index and similarity caching (with built-in pre-seeded dataset fallback).

---

## Tech Stack

- **Framework**: Next.js 15+ (App Router with TypeScript)
- **Styling**: Tailwind CSS v4 + Vanilla CSS Custom Properties
- **Vector Database**: PostgreSQL with `pgvector` extension & Supabase integration
- **Feature Processing**: `sharp`, `@xenova/transformers` (CLIP embeddings), CIELAB color math
- **Icons & Motion**: `lucide-react` + CSS transitions

---

## Setup & Running Locally

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Environment Variables**:
   If `app/.env.local` does not exist, create it from the included template:
   ```bash
   cp .env.example .env.local
   ```

   In PowerShell, use:
   ```powershell
   Copy-Item .env.example .env.local
   ```

   Then fill in at least `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, and
   `INDEXING_SECRET`. The Supabase secret and indexing secret are server-only;
   never commit `.env.local`.

   For the production catalog, configure `NEXT_PUBLIC_SUPABASE_URL` and either
   the publishable/anon read key. Set the new `SUPABASE_SECRET_KEY` (or legacy
   `SUPABASE_SERVICE_ROLE_KEY`) only in Vercel server environment variables if
   album analysis should be written back to Supabase; never expose that key to
   the browser.

3. **Start Development Server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your browser.

4. **Run Unit Tests**:
   ```bash
   npm test
   ```

---

## Bulk Catalog Population

The repository includes a local, resumable worker for building a larger
Supabase catalog without using a long-running Vercel function:

1. Set `INDEXING_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`, and
   `SUPABASE_SECRET_KEY` in `app/.env.local`.
2. Start the local Next.js server with `npm run dev`.
3. In a second terminal, run:
   ```bash
   npm run catalog:populate -- --target-albums=2000 --target-cache=5000
   ```

The worker discovers albums across multiple genres, analyzes artwork in memory,
and writes only metadata, visual features, embeddings, and similarity rows to
Supabase. It does not save image files. A small checkpoint and lock are created
in the operating system temporary directory; the checkpoint is deleted after a
successful run and retained after an interruption so the job can resume.

The worker is deliberately restricted to a local Next.js base URL. It should
not be pointed at the Vercel deployment for bulk processing. If it stops before
the targets are reached, rerun the same command; do not use `--reset` unless a
fresh catalog population is intended.

The population is repeat-safe. Album rows are upserted by their unique iTunes
collection ID. Similarity rows are upserted by source album, candidate album,
ranking mode, and algorithm version. Re-running the command will resume or
upgrade existing rows rather than create duplicate records.

---

## API Documentation

- `GET /api/search?q={query}&country=PH&limit=25`: iTunes search proxy.
- `GET /api/albums/{collectionId}`: Album metadata & track listing.
- `GET /api/albums/{collectionId}/similar?mode=art_style&limit=18`: Visual similarity recommendation engine.
- `GET /album/{collectionId}/opengraph-image?country=PH`: Canonical album share-card image used for social previews.
- `POST /api/albums/{collectionId}/index`: Internal indexing endpoint for generating embeddings and feature extraction.
- `GET /api/discover?collection={collection}&color={hex}&filter={filter}`: Explore mode discovery feed.
- `GET /api/proxy-image?url={url}`: Safe image proxy with caching headers.
