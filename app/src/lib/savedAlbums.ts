'use client';

import { useSyncExternalStore } from 'react';
import type { Album } from './types';

export type SavedAlbum = Pick<
  Album,
  'itunesCollectionId' | 'title' | 'artistName' | 'genre' | 'releaseYear' | 'artworkUrl'
> & { dominantPalette: Array<{ hex: string }> };

const STORAGE_KEY = 'articol_saved_albums';
const EMPTY: SavedAlbum[] = [];
const listeners = new Set<() => void>();
let snapshot: SavedAlbum[] = EMPTY;
let initialized = false;
let listeningToStorage = false;

export function toSavedAlbum(album: SavedAlbum): SavedAlbum {
  return {
    itunesCollectionId: album.itunesCollectionId,
    title: album.title,
    artistName: album.artistName,
    genre: album.genre,
    releaseYear: album.releaseYear,
    artworkUrl: album.artworkUrl,
    dominantPalette: (album.dominantPalette || []).slice(0, 5).map(({ hex }) => ({ hex })),
  };
}

export function parseSavedAlbums(raw: string | null): SavedAlbum[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const albums = new Map<number, SavedAlbum>();
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const album = item as Record<string, unknown>;
      const id = Number(album.itunesCollectionId);
      if (!Number.isSafeInteger(id) || id <= 0 || typeof album.title !== 'string' ||
        typeof album.artistName !== 'string' || typeof album.artworkUrl !== 'string') continue;
      const palette = Array.isArray(album.dominantPalette)
        ? album.dominantPalette.flatMap((color: unknown) => {
            if (!color || typeof color !== 'object') return [];
            const hex = (color as { hex?: unknown }).hex;
            return typeof hex === 'string' && /^#[0-9a-f]{6}$/i.test(hex) ? [{ hex }] : [];
          })
        : [];
      albums.set(id, {
        itunesCollectionId: id,
        title: album.title,
        artistName: album.artistName,
        genre: typeof album.genre === 'string' ? album.genre : 'Music',
        releaseYear: Number.isFinite(Number(album.releaseYear)) ? Number(album.releaseYear) : 0,
        artworkUrl: album.artworkUrl,
        dominantPalette: palette.slice(0, 5),
      });
    }
    return Array.from(albums.values());
  } catch {
    return [];
  }
}

function readStorage(): SavedAlbum[] {
  try {
    return parseSavedAlbums(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

function ensureLoaded(): void {
  if (initialized || typeof window === 'undefined') return;
  snapshot = readStorage();
  initialized = true;
}

function publish(next: SavedAlbum[]): void {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function onStorage(event: StorageEvent): void {
  if (event.key === STORAGE_KEY || event.key === null) publish(readStorage());
}

export function subscribeSavedAlbums(listener: () => void): () => void {
  ensureLoaded();
  if (listeners.size === 0) {
    const latest = readStorage();
    if (JSON.stringify(latest) !== JSON.stringify(snapshot)) snapshot = latest;
  }
  listeners.add(listener);
  if (!listeningToStorage) {
    window.addEventListener('storage', onStorage);
    listeningToStorage = true;
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && listeningToStorage) {
      window.removeEventListener('storage', onStorage);
      listeningToStorage = false;
    }
  };
}

export function getSavedAlbums(): SavedAlbum[] {
  ensureLoaded();
  return snapshot;
}

export function useSavedAlbums(): SavedAlbum[] {
  return useSyncExternalStore(subscribeSavedAlbums, getSavedAlbums, () => EMPTY);
}

export function toggleSavedAlbum(album: SavedAlbum): boolean {
  ensureLoaded();
  const exists = snapshot.some((saved) => saved.itunesCollectionId === album.itunesCollectionId);
  const next = exists
    ? snapshot.filter((saved) => saved.itunesCollectionId !== album.itunesCollectionId)
    : [...snapshot, toSavedAlbum(album)];
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    publish(next);
    return true;
  } catch {
    return false;
  }
}

export function clearSavedAlbums(): boolean {
  ensureLoaded();
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    publish(EMPTY);
    return true;
  } catch {
    return false;
  }
}
