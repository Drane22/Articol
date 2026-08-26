import { getAlbumFromDb } from './db';
import { getItunesAlbumById } from './itunes';
import { normalizeStorefront } from './storefronts';
import type { Album, VisualFeatures } from './types';
import type { PaletteArtInputColor } from './paletteArtwork';

export interface ShareAlbumData {
  title: string;
  artistName: string;
  artworkUrl: string;
  releaseYear: number | '';
  country: string;
  palette: PaletteArtInputColor[];
  visualFeatures?: VisualFeatures;
}

export const FALLBACK_SHARE_PALETTE: PaletteArtInputColor[] = [
  { hex: '#1c1e24', weight: 0.35 },
  { hex: '#484e5b', weight: 0.25 },
  { hex: '#7e8799', weight: 0.18 },
  { hex: '#c5b49d', weight: 0.13 },
  { hex: '#e8dfd2', weight: 0.09 },
];

const HEX_WEIGHT_PATTERN = /^(#[0-9a-f]{6})(?::([0-9]*\.?[0-9]+))?$/i;

function boundedParam(searchParams: URLSearchParams, key: string, limit: number): string {
  return (searchParams.get(key) || '').trim().slice(0, limit);
}

export function parseSuppliedPaletteParam(raw: string): PaletteArtInputColor[] {
  if (!raw) return [];
  const tokens = raw.split(',').map((t) => t.trim()).filter(Boolean);
  const parsed: PaletteArtInputColor[] = [];

  for (const token of tokens) {
    const match = HEX_WEIGHT_PATTERN.exec(token);
    if (match) {
      const hex = match[1].toLowerCase();
      const rawWeight = match[2] ? Number.parseFloat(match[2]) : NaN;
      const weight = Number.isFinite(rawWeight) && rawWeight > 0 ? rawWeight : 1;
      parsed.push({ hex, weight });
    }
  }

  if (parsed.length === 0) return [];
  const capped = parsed.slice(0, 10);
  const total = capped.reduce((sum, item) => sum + item.weight, 0);

  return capped.map((item) => ({
    hex: item.hex,
    weight: total > 0 ? item.weight / total : 1 / capped.length,
  }));
}

export function getSuppliedPaletteShareAlbumData(
  searchParams: URLSearchParams,
  country: string,
): ShareAlbumData | null {
  const title = boundedParam(searchParams, 'title', 120);
  const artistName = boundedParam(searchParams, 'artist', 120);
  const rawPalette = boundedParam(searchParams, 'palette', 300);
  const palette = parseSuppliedPaletteParam(rawPalette);

  if (!title || !artistName || palette.length === 0) return null;

  const year = boundedParam(searchParams, 'year', 4);
  return {
    title,
    artistName,
    artworkUrl: '',
    releaseYear: /^\d{4}$/.test(year) ? Number.parseInt(year, 10) : '',
    country: normalizeStorefront(country),
    palette,
  };
}

function artworkUrlFor(album?: Album | null): string {
  return (album?.artworkUrl || '').replace(/\d+x\d+(bb)?\.(jpe?g|png|webp)/i, '1000x1000bb.$2');
}

export async function getShareAlbumData(id: string, country: string): Promise<ShareAlbumData> {
  const collectionId = Number.parseInt(id, 10);
  let storedAlbum: Album | null = null;
  let liveAlbum: Album | null = null;

  try {
    if (Number.isFinite(collectionId)) storedAlbum = await getAlbumFromDb(collectionId);
  } catch {
    // The public share route remains useful when storage is unavailable.
  }

  try {
    if (Number.isFinite(collectionId)) {
      const liveResult = await getItunesAlbumById(collectionId, country, false);
      liveAlbum = liveResult.album;
    }
  } catch {
    // Stored catalog metadata remains a valid fallback when iTunes is unavailable.
  }

  const album = storedAlbum || liveAlbum;
  const rawDominant = album?.dominantPalette || [];
  const palette: PaletteArtInputColor[] = rawDominant
    .filter((c) => c && typeof c.hex === 'string' && /^#[0-9a-f]{6}$/i.test(c.hex))
    .slice(0, 10)
    .map((c) => ({
      hex: c.hex.toLowerCase(),
      weight: Number.isFinite(c.weight) && c.weight > 0 ? c.weight : 0.1,
      lab: Array.isArray(c.lab) && c.lab.length === 3 ? c.lab : undefined,
    }));

  return {
    title: album?.title || 'Album artwork',
    artistName: album?.artistName || 'Visual album discovery',
    artworkUrl: artworkUrlFor(album),
    releaseYear: album?.releaseYear || '',
    country: normalizeStorefront(album?.country || country),
    palette: palette.length > 0 ? palette : FALLBACK_SHARE_PALETTE,
    visualFeatures: album?.visualFeatures,
  };
}
