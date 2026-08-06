import { describe, it, expect } from 'vitest';
import { getAllSeedAlbums } from '../src/lib/db';
import { getColorCategory } from '../src/lib/colorUtils';

describe('Discover & Archival Spotlight Filter Engine', () => {
  it('filters seed albums by visual attributes', async () => {
    const albums = await getAllSeedAlbums();
    expect(albums.length).toBeGreaterThan(0);

    const minimal = albums.filter(a => a.visualFeatures.minimalismScore > 0.4);
    expect(minimal.length).toBeGreaterThan(0);
  });

  it('filters seed albums by dominant color category', async () => {
    const albums = await getAllSeedAlbums();
    const blackOrMonochrome = albums.filter(a =>
      a.dominantPalette.some(p => ['black', 'monochrome'].includes(getColorCategory(p.hex)))
    );
    expect(blackOrMonochrome.length).toBeGreaterThan(0);
  });
});
