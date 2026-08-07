import { normalizeStorefront } from './storefronts';

export function getAlbumSharePath(id: string | number, country = 'PH'): string {
  const storefront = normalizeStorefront(country);
  return `/album/${encodeURIComponent(String(id))}?country=${encodeURIComponent(storefront)}`;
}

export function getAlbumShareImagePath(id: string | number, country = 'PH'): string {
  const storefront = normalizeStorefront(country);
  return `/album/${encodeURIComponent(String(id))}/opengraph-image?country=${encodeURIComponent(storefront)}`;
}

export function getAbsoluteUrl(path: string, origin: string): string {
  return new URL(path, origin).toString();
}
