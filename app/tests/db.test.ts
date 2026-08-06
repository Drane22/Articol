import { describe, it, expect } from 'vitest';
import { getAlbumFromDb, saveAlbumToDb, getAllSeedAlbums } from '../src/lib/db';
import { Album } from '../src/lib/types';

describe('Database & Catalog Persistence', () => {
  it('loads seed catalog albums into memory store', async () => {
    const seeds = await getAllSeedAlbums();
    expect(seeds.length).toBeGreaterThanOrEqual(18);
    const abbeyRoad = seeds.find(s => s.itunesCollectionId === 1474815798 || s.title === 'Abbey Road');
    expect(abbeyRoad).toBeDefined();
    expect(abbeyRoad?.title).toBe('Abbey Road');
  });

  it('saves custom album to store and retrieves it', async () => {
    const customAlbum: Album = {
      id: 'itunes-999999',
      itunesCollectionId: 999999,
      itunesArtistId: 8888,
      title: 'Custom Test Album',
      normalizedTitle: 'custom test album',
      artistName: 'Test Artist',
      normalizedArtistName: 'test artist',
      genre: 'Rock',
      releaseDate: '2022-01-01',
      releaseYear: 2022,
      country: 'PH',
      trackCount: 10,
      artworkUrl: 'https://example.com/custom.jpg',
      artworkSource: 'itunes',
      dominantPalette: [{ hex: '#333333', lab: [20, 0, 0], weight: 1 }],
      visualFeatures: {} as any,
      visualAnalysisStatus: 'analyzed',
    };

    await saveAlbumToDb(customAlbum);
    const retrieved = await getAlbumFromDb(999999);
    expect(retrieved).toBeDefined();
    expect(retrieved?.title).toBe('Custom Test Album');
    expect(retrieved?.visualAnalysisStatus).toBe('analyzed');
  });
});
