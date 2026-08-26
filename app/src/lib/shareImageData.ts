import { getAlbumFromDb } from './db';
import { getItunesAlbumById } from './itunes';
import { normalizeStorefront } from './storefronts';
import type { Album } from './types';

export interface ShareAlbumData {
  title: string;
  artistName: string;
  artworkUrl: string;
  releaseYear: number | '';
  country: string;
  palette: string[];
}

export const FALLBACK_SHARE_PALETTE = ['#171719', '#514748', '#8e7374', '#b99b82', '#dfd4c4'];

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

  const album = liveAlbum || storedAlbum;
  const palette = (storedAlbum?.dominantPalette || album?.dominantPalette || [])
    .slice(0, 10)
    .map((color) => color.hex)
    .filter(Boolean);

  return {
    title: album?.title || 'Album artwork',
    artistName: album?.artistName || 'Visual album discovery',
    artworkUrl: artworkUrlFor(album),
    releaseYear: album?.releaseYear || '',
    country: normalizeStorefront(album?.country || country),
    palette: palette.length > 0 ? palette : FALLBACK_SHARE_PALETTE,
  };
}
