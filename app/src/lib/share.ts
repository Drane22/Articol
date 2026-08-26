import { normalizeStorefront } from './storefronts';
import type { PaletteArtStyle } from './paletteArtwork';

export const SHARE_IMAGE_SIZES = {
  landscape: { width: 1200, height: 630 },
  portrait: { width: 1080, height: 1350 },
} as const;

interface FileShareNavigator {
  share?: (data?: ShareData) => Promise<void>;
  canShare?: (data?: ShareData) => boolean;
}

export function getAlbumSharePath(id: string | number, country = 'PH'): string {
  const storefront = normalizeStorefront(country);
  return `/album/${encodeURIComponent(String(id))}?country=${encodeURIComponent(storefront)}`;
}

export function getAlbumShareImagePath(id: string | number, country = 'PH'): string {
  const storefront = normalizeStorefront(country);
  return `/album/${encodeURIComponent(String(id))}/opengraph-image?country=${encodeURIComponent(storefront)}`;
}

export interface PortraitShareOptions {
  variant?: 'cover' | 'palette';
  style?: PaletteArtStyle;
  album?: {
    title: string;
    artistName: string;
    releaseYear?: number | string;
    palette: string[];
  };
}

export function getAlbumPortraitShareImagePath(
  id: string | number,
  country = 'PH',
  options?: PortraitShareOptions,
): string {
  const storefront = normalizeStorefront(country);
  const params = new URLSearchParams({ country: storefront });
  if (options?.variant === 'palette' && options.style) {
    params.set('variant', 'palette');
    params.set('style', options.style);
    if (options.album) {
      params.set('title', options.album.title.trim().slice(0, 120));
      params.set('artist', options.album.artistName.trim().slice(0, 120));
      const releaseYear = String(options.album.releaseYear || '').trim();
      if (/^\d{4}$/.test(releaseYear)) params.set('year', releaseYear);
      const palette = options.album.palette
        .filter((color) => /^#[0-9a-f]{6}$/i.test(color))
        .slice(0, 10);
      if (palette.length > 0) params.set('palette', palette.join(','));
    }
  }
  return `/album/${encodeURIComponent(String(id))}/share-image?${params.toString()}`;
}

export function getAlbumShareFilename(title: string, artistName: string, suffix?: string): string {
  const slug = `${artistName}-${title}`
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);

  const safeSuffix = suffix
    ? `-${suffix.normalize('NFKD').replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase()}`
    : '';

  return `articol-${slug || 'album-artwork'}${safeSuffix}.png`;
}

export function supportsNativeFileShare(navigatorLike: FileShareNavigator, files: File[]): boolean {
  if (!navigatorLike.share || !navigatorLike.canShare) return false;
  try {
    return navigatorLike.canShare({ files });
  } catch {
    return false;
  }
}

export function isShareCancellation(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'name' in error
    && error.name === 'AbortError';
}

export function getAbsoluteUrl(path: string, origin: string): string {
  return new URL(path, origin).toString();
}
