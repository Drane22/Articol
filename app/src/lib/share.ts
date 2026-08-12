import { normalizeStorefront } from './storefronts';

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

export function getAlbumPortraitShareImagePath(id: string | number, country = 'PH'): string {
  const storefront = normalizeStorefront(country);
  return `/album/${encodeURIComponent(String(id))}/share-image?country=${encodeURIComponent(storefront)}`;
}

export function getAlbumShareFilename(title: string, artistName: string): string {
  const slug = `${artistName}-${title}`
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);

  return `articol-${slug || 'album-artwork'}.png`;
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
