import { describe, it, expect } from 'vitest';
import { getItunesAlbumById } from '../src/lib/itunes';
import { getAlbumFromDb } from '../src/lib/db';

describe('Album Detail Lookup & Storefront Fallback', () => {
  it('retrieves album details for known collection ID from iTunes API', async () => {
    const { album, tracks } = await getItunesAlbumById(1440854851, 'US');
    expect(album).not.toBeNull();
    expect(album?.title).toBeDefined();
    expect(tracks.length).toBeGreaterThan(0);
  });

  it('handles storefront query with valid album payload', async () => {
    // 1440854851 (Jack Johnson - Sleep Through the Static)
    const { album, tracks } = await getItunesAlbumById(1440854851, 'PH');
    expect(album).not.toBeNull();
    expect(album?.artistName).toBeDefined();
    expect(tracks.length).toBeGreaterThan(0);
  });

  it('verifies seed catalog albums are visually analyzed', async () => {
    const album = await getAlbumFromDb(1440854851); // Abbey Road
    expect(album).not.toBeNull();
    expect(album?.visualAnalysisStatus).toBe('analyzed');
  });
});
