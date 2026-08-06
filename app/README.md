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
- **Digital Cover Archive (Explore Mode)**: Dynamic color spectrum slider control, decade filters, visual attribute tags, and curated collections (Quiet Minimalism, Red and Black, Dreamlike Portraits, Hand-Drawn Worlds, Brutalist Type, Analog Grain, Soft Pastels, Dark Monochrome, Maximalist Collage).
- **Saved References**: Local storage personal cover archive.
- **PostgreSQL & pgvector Support**: Complete SQL schema migration script with ANN vector index and similarity caching (with built-in pre-seeded dataset fallback).

---

## Tech Stack

- **Framework**: Next.js 15+ (App Router with TypeScript)
- **Styling**: Tailwind CSS v4 + Vanilla CSS Custom Properties
- **Vector Database**: PostgreSQL with `pgvector` extension & Supabase integration
- **Feature Processing**: `sharp`, `@xenova/transformers` (CLIP embeddings), CIELAB color math
- **Icons & Motion**: `lucide-react`, `framer-motion`

---

## Setup & Running Locally

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Environment Variables**:
   Copy `.env.example` to `.env.local` and add your optional database or API credentials:
   ```bash
   cp .env.example .env.local
   ```

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

## API Documentation

- `GET /api/search?q={query}&country=PH&limit=25`: iTunes search proxy.
- `GET /api/albums/{collectionId}`: Album metadata & track listing.
- `GET /api/albums/{collectionId}/similar?mode=art_style&limit=18`: Visual similarity recommendation engine.
- `POST /api/albums/{collectionId}/index`: Internal indexing endpoint for generating embeddings and feature extraction.
- `GET /api/discover?collection={collection}&color={hex}&filter={filter}`: Explore mode discovery feed.
- `GET /api/proxy-image?url={url}`: Safe image proxy with caching headers.
