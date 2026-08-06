import { describe, it, expect } from 'vitest';
import { getItunesAlbumById } from '../src/lib/itunes';

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
});
