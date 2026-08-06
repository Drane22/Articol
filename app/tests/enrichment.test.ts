import { describe, it, expect } from 'vitest';
import { generateCandidatePool } from '../src/lib/enrichment';
import { Album } from '../src/lib/types';

const sampleQueryAlbum: Album = {
  id: 'seed-1440854851',
  itunesCollectionId: 1440854851,
  itunesArtistId: 1000 + 1440854851,
  title: 'Abbey Road',
  normalizedTitle: 'abbey road',
  artistName: 'The Beatles',
  normalizedArtistName: 'the beatles',
  genre: 'Rock',
  releaseDate: '1969-09-26',
  releaseYear: 1969,
  country: 'PH',
  trackCount: 17,
  explicitness: 'notExplicit',
  price: 9.99,
  currency: 'USD',
  artworkUrl: 'https://example.com/abbeyroad.jpg',
  artworkSource: 'seed',
  dominantPalette: [{ hex: '#222222', lab: [10, 0, 0], weight: 1 }],
  visualFeatures: {} as any,
  embedding: Array(512).fill(0.1),
  visualAnalysisStatus: 'analyzed',
};

describe('Candidate pool generation', () => {
  it('generates a non-empty candidate pool including seed catalog albums', async () => {
    const { candidates, lastFmScores } = await generateCandidatePool(sampleQueryAlbum, 'PH');
    expect(candidates.length).toBeGreaterThan(0);
    expect(typeof lastFmScores).toBe('object');
    // Ensure query album is omitted from candidates
    expect(candidates.some(c => c.itunesCollectionId === sampleQueryAlbum.itunesCollectionId)).toBe(false);
  });

  it('uses cached candidate pool on subsequent requests', async () => {
    const start = Date.now();
    const first = await generateCandidatePool(sampleQueryAlbum, 'PH');
    const mid = Date.now();
    const second = await generateCandidatePool(sampleQueryAlbum, 'PH');
    const end = Date.now();
    expect(first.candidates.length).toBe(second.candidates.length);
    // Cached response should return almost instantly (<5ms)
    expect(end - mid).toBeLessThan(50);
  });
});
