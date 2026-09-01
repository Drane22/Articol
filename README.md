# Articol — Visual Album-Search and Discovery Platform

> **Find records by the way they look.**  
> *Search an album, study its artwork, and discover records with a similar visual language.*

Articol is a visual album discovery platform that treats album artwork as a first-class aesthetic object. Rather than relying solely on artist genre tags or textual metadata, Articol analyzes composition, color palettes, spatial layouts, illustration styles, textures, and visual complexity to surface records that share an artistic sensibility.

---

## Features

### 🎨 Multimodal Visual Similarity Engine
- **512-Dimension CLIP Embeddings**: Uses normalized `clip-vit-base-patch32` visual embeddings for deep semantic and artistic style matching.
- **CIELAB Color Palette Math**: Extracts 5 dominant colors per artwork, calculating perceptual similarity using CIEDE2000 and Earth Mover's Distance (EMD).
- **Spatial Layout & Composition**: Evaluates subject centroid (X/Y coordinates), symmetry, negative space, and foreground/background ratios.
- **Typography & Complexity**: Measures typographic coverage, edge density, image entropy, and analog grain.

### 🎚️ 3 User-Selectable Ranking Modes
- **Art Style** (`α = 0.92`): Visual resemblance is overwhelmingly prioritized.
- **Balanced** (`α = 0.72`): Visual resemblance primary with musical relationship context.
- **Music Relation** (`α = 0.40`): Musical connections balanced against visual match.
- **MMR Reranking**: Maximum Marginal Relevance (`λ = 0.80`) prevents visual duplicates and near-identical reissues.

### 🖼️ Generative Palette Art & Share Studio
- **Generative Palette Editions**: Transform album color palettes into algorithmic visual art across 5 distinct styles:
  - **Succulent Bloom**: Layered organic rosettes mapped to color salience and hue.
  - **Cover Genome**: Translucent helical structures shaped by contrast and symmetry.
  - **Chord Loom**: Dimensional woven textiles weighted by palette coverage.
  - **Cover Pulse**: Sculpted topographic terrain reliefs driven by entropy and contrast.
  - **Record Atlas**: Celestial orbital systems built from album lightness and chroma.
- **Dual Format Output**:
  - **Portrait Card** (1080 × 1350, 4:5): Optimized for Instagram and mobile image sharing with native Web Share API support and local download fallback.
  - **Social Link Preview** (1200 × 630): Open Graph and Twitter-compatible cards with embedded palette legends.

### 🌐 Live Discovery & Curated Archive
- **iTunes Search & Lookup**: Live server-side iTunes search proxy with country storefront support (`PH` default).
- **Digital Cover Archive (Explore Mode)**: Dynamic color spectrum slider, decade filters, and visual attribute tags.
- **Curated Collections**: Browse collections such as *Quiet Minimalism*, *Red and Black*, *Dreamlike Portraits*, *Hand-Drawn Worlds*, *Brutalist Type*, *Analog Grain*, *Soft Pastels*, *Dark Monochrome*, and *Maximalist Collage*.
- **Saved References**: Client-side saved albums archive stored in `localStorage`.

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Framework** | Next.js 15+ (App Router, TypeScript) |
| **Styling** | Tailwind CSS v4 + Vanilla CSS Custom Properties |
| **Database & Vectors** | PostgreSQL with `pgvector` extension via Supabase |
| **Image & Feature Processing** | `sharp`, `@xenova/transformers` (CLIP), `colorthief`, CIELAB color math |
| **Icons & UI** | `lucide-react`, Focus/Scroll management |
| **Testing** | `vitest` |

---

## Repository Structure

```text
Articol/
├── app/
│   ├── app/                    # Next.js App Router (pages, layouts, API routes)
│   │   ├── album/[id]/         # Album detail page & dynamic share routes
│   │   ├── api/                # Search, similar, discover, & proxy APIs
│   │   ├── explore/            # Explore feed & spectrum filters
│   │   └── saved/              # Saved records archive
│   ├── db/
│   │   └── schema.sql          # PostgreSQL + pgvector schema & migration
│   ├── public/                 # Static assets & icons
│   ├── scripts/
│   │   ├── populate-catalog.mjs # Resumable catalog population worker
│   │   ├── cleanup-artwork.mjs  # Local cache cleanup utility
│   │   └── index_catalog.py    # Python CLI for offline indexing
│   ├── src/
│   │   ├── components/         # React UI components & dialogs
│   │   ├── data/               # Seed catalog fallback dataset
│   │   ├── lib/                # Visual engine, palette math, iTunes client
│   │   └── styles/             # Global stylesheets & design tokens
│   └── tests/                  # Vitest unit & integration test suite
├── .gitignore
└── README.md
```

---

## Getting Started

### Prerequisites
- Node.js 18.18+ or 20+
- npm, pnpm, or yarn

### 1. Install Dependencies
```bash
cd app
npm install
```

### 2. Configure Environment Variables
Create `.env.local` inside the `app` directory by copying the example:

```bash
cp .env.example .env.local
```

*(On Windows PowerShell: `Copy-Item .env.example .env.local`)*

Set the required environment keys in `app/.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_SECRET_KEY=your-service-role-secret-key
INDEXING_SECRET=your-indexing-secret
DEFAULT_STOREFRONT=PH
```

> **Note**: If Supabase credentials are not provided, Articol automatically falls back to its built-in pre-seeded visual catalog with full offline search and similarity support.

### 3. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Run Tests
```bash
npm test
```

---

## Database Setup & Catalog Population

### Database Migration
Execute `app/db/schema.sql` in your Supabase SQL editor or PostgreSQL database. This sets up:
- The `pgvector` extension
- The `albums` table with 512-dimension vector columns (`artwork_embedding`)
- The `similarity_cache` table for precomputed nearest neighbors
- Cosine distance indexes (`ivfflat` / HNSW)

### Bulk Catalog Population
Populate the database with visual embeddings and color metadata using the resumable local worker:

```bash
cd app
npm run catalog:populate -- --target-albums=2000 --target-cache=5000
```

The worker fetches album artwork in-memory, extracts visual embeddings and palettes, and uploads the numeric vectors to Supabase without saving temporary image files to disk.

---

## API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/search` | `GET` | iTunes search proxy (`?q={query}&country={country}&limit={limit}`) |
| `/api/albums/{id}` | `GET` | Retrieve album metadata and track listing |
| `/api/albums/{id}/similar` | `GET` | Visual similarity recommendation engine (`?mode=art_style\|balanced\|music_relation`) |
| `/api/albums/{id}/related` | `GET` | Musical relationship and genre-context candidate pool |
| `/api/discover` | `GET` | Explore feed filtered by collection, color spectrum, or decade |
| `/api/proxy-image` | `GET` | Cached image proxy for CORS-safe canvas manipulation |
| `/album/{id}/share-image` | `GET` | Dynamic portrait card (1080x1350) and generative palette art endpoint |
| `/album/{id}/opengraph-image` | `GET` | Open Graph social card preview (1200x630) |

---

## License

MIT License.