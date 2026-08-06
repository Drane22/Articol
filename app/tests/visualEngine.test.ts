import { describe, it, expect } from 'vitest';
import { calculateCosineSimilarity, calculateHammingDistance, calculateMusicScore, rankDistinctRecommendationTiers, rankSimilarAlbums } from '../src/lib/visualEngine';
import { calculateColorSimilarity, hexToRgb, rgbToLab } from '../src/lib/colorUtils';
import { buildVisualDescriptor } from '../src/lib/featureExtractor';
import { isSameAlbumIdentity } from '../src/lib/itunes';
import { Album, DominantColor, VisualFeatures } from '../src/lib/types';

const features: VisualFeatures = {
  luminance: 0.5, contrast: 0.55, saturation: 0.65, warmCool: 0.2,
  monochromeScore: 0.1, edgeDensity: 0.3, visualEntropy: 0.45,
  symmetryScore: 0.6, centroidX: 0.5, centroidY: 0.5,
  foregroundRatio: 0.55, textRatio: 0.12, textRegionCount: 2,
  portraitProb: 0.2, illustrationProb: 0.4, photographyProb: 0.6,
  abstractProb: 0.3, collageProb: 0.2, minimalismScore: 0.5,
};

function palette(hex: string): DominantColor[] {
  const [r, g, b] = hexToRgb(hex);
  return [{ hex, lab: rgbToLab(r, g, b), weight: 1 }];
}

function album(id: number, artist: string, color: string, embedding: number[], overrides: Partial<Album> = {}): Album {
  return {
    id: `album-${id}`, itunesCollectionId: id, itunesArtistId: id,
    title: `Album ${id}`, normalizedTitle: `album ${id}`,
    artistName: artist, normalizedArtistName: artist.toLowerCase(),
    genre: 'Rock', releaseDate: '2000-01-01', releaseYear: 2000,
    country: 'PH', trackCount: 10, artworkUrl: `https://example.com/${id}.jpg`,
    artworkSource: 'itunes', dominantPalette: palette(color), visualFeatures: { ...features },
    embedding, perceptualHash: (id % 2 ? '1' : '0').repeat(64),
    visualAnalysisStatus: 'analyzed', embeddingVersion: 'visual-grid-v2',
    ...overrides,
  };
}

describe('Visual similarity engine', () => {
  it('calculates normalized cosine similarity', () => {
    expect(calculateCosineSimilarity([1, 0], [1, 0])).toBe(1);
    expect(calculateCosineSimilarity([1, 0], [-1, 0])).toBe(0);
  });

  it('builds visual descriptors independently of album metadata', () => {
    const first = buildVisualDescriptor(palette('#d02020'), features, [0.2, -0.1, 0.4]);
    const second = buildVisualDescriptor(palette('#d02020'), { ...features }, [0.2, -0.1, 0.4]);
    expect(first).toEqual(second);
    expect(first).toHaveLength(512);
  });

  it('scores close palettes above severe mismatches', () => {
    const close = calculateColorSimilarity(palette('#d02020'), palette('#c92525'));
    const mismatch = calculateColorSimilarity(palette('#d02020'), palette('#164bd8'));
    expect(close).toBeGreaterThan(mismatch);
    expect(mismatch).toBeLessThan(0.42);
  });

  it('uses genuinely different policies for all three modes', () => {
    const query = album(100, 'Query Artist', '#d02020', [1, 0]);
    const visual = album(1, 'Visual Artist', '#ce2020', [1, 0], { genre: 'Jazz', releaseYear: 1970 });
    const balanced = album(2, 'Balanced Artist', '#df2929', [0.8, 0.2], { releaseYear: 2001 });
    const musical = album(3, 'Music Artist', '#5b2abf', [0, 1]);
    const candidates = [visual, balanced, musical];
    const musicScores = { 1: 0, 2: 0.25, 3: 0.95 };

    const artTop = rankSimilarAlbums(query, candidates, 'art_style', musicScores)[0]?.album.itunesCollectionId;
    const balancedTop = rankSimilarAlbums(query, candidates, 'balanced', musicScores)[0]?.album.itunesCollectionId;
    const musicTop = rankSimilarAlbums(query, candidates, 'music_relation', musicScores)[0]?.album.itunesCollectionId;
    expect(new Set([artTop, balancedTop, musicTop]).size).toBe(3);
  });

  it('keeps Art Style 100% visual and Music Relation 100% musical', () => {
    const query = album(100, 'Query Artist', '#d02020', [1, 0]);
    const visualMatch = album(1, 'Visual Artist', '#d02020', [1, 0], { genre: 'Classical', releaseYear: 1950 });
    const musicMatch = album(2, 'Music Artist', '#164bd8', [0, 1], { genre: query.genre, releaseYear: query.releaseYear });

    const artWithoutMusic = rankSimilarAlbums(query, [visualMatch], 'art_style', { 1: 0 })[0];
    const artWithMusic = rankSimilarAlbums(query, [visualMatch], 'art_style', { 1: 1 })[0];
    expect(artWithoutMusic.finalScore).toBe(artWithMusic.finalScore);

    const musicResult = rankSimilarAlbums(query, [visualMatch, musicMatch], 'music_relation', { 1: 0, 2: 0.95 })[0];
    expect(musicResult.album.itunesCollectionId).toBe(2);
    expect(musicResult.finalScore).toBe(musicResult.musicScore);
  });

  it('does not invent strong artist affinity when Last.fm evidence is missing', () => {
    const query = album(100, 'Query Artist', '#d02020', [1, 0]);
    const sameMetadata = album(1, 'Other Artist', '#d02020', [1, 0]);
    const withoutApiEvidence = calculateMusicScore(query, sameMetadata, 0);
    const withApiEvidence = calculateMusicScore(query, sameMetadata, 0.9);
    expect(withApiEvidence).toBeGreaterThan(withoutApiEvidence);
    expect(withoutApiEvidence).toBeLessThanOrEqual(0.72);
  });

  it('ranks close palette above severe mismatch in Art Style mode without hard exclusion', () => {
    const query = album(100, 'Query Artist', '#d02020', [1, 0]);
    const close = album(1, 'Close Artist', '#c92525', [1, 0]);
    const mismatch = album(2, 'Mismatch Artist', '#164bd8', [1, 0]);
    const results = rankSimilarAlbums(query, [mismatch, close], 'art_style');
    const ids = results.map(result => result.album.itunesCollectionId);
    expect(ids[0]).toBe(1); // Close palette ranks first
    expect(results[0].finalScore).toBeGreaterThan(results[1].finalScore);
  });

  it('filters selected artists and same-title near-identical covers in every mode', () => {
    const query = album(100, 'Query Artist', '#d02020', [1, 0], { normalizedTitle: 'same title' });
    const sameArtist = album(1, 'Query Artist', '#d02020', [1, 0]);
    const duplicate = album(2, 'Other Artist', '#d02020', [1, 0], { normalizedTitle: 'same title', perceptualHash: query.perceptualHash });
    const valid = album(3, 'Valid Artist', '#d02020', [1, 0]);
    for (const mode of ['art_style', 'balanced', 'music_relation'] as const) {
      expect(rankSimilarAlbums(query, [sameArtist, duplicate, valid], mode, { 3: 0.8 }).map(result => result.album.itunesCollectionId)).toEqual([3]);
    }
  });

  it('keeps at most one recommendation per artist', () => {
    const query = album(100, 'Query Artist', '#d02020', [1, 0]);
    const results = rankSimilarAlbums(query, [
      album(1, 'Repeat Artist', '#d02020', [1, 0]),
      album(2, 'Repeat Artist', '#d02020', [1, 0]),
      album(3, 'Second Artist', '#d02020', [1, 0]),
    ], 'balanced', { 1: 0.5, 2: 0.5, 3: 0.5 });
    expect(results.filter(result => result.album.normalizedArtistName === 'repeat artist')).toHaveLength(1);
    expect(results).toHaveLength(2);
  });

  it('keeps the leading suggestions distinct across tiers', () => {
    const query = album(100, 'Query Artist', '#d02020', [1, 0]);
    const candidates = Array.from({ length: 20 }, (_, index) => album(
      index + 1,
      `Artist ${index}`,
      index < 8 ? '#cf2222' : index < 14 ? '#a94332' : '#6b339d',
      index < 10 ? [1, 0] : [0.4, 0.6],
      { releaseYear: 1985 + index },
    ));
    const musicScores = Object.fromEntries(candidates.map((candidate, index) => [candidate.itunesCollectionId, index / 20]));
    const tiers = rankDistinctRecommendationTiers(query, candidates, musicScores, 6);
    const artIds = new Set(tiers.art_style.map(result => result.album.itunesCollectionId));
    const balancedIds = new Set(tiers.balanced.map(result => result.album.itunesCollectionId));
    const musicIds = new Set(tiers.music_relation.map(result => result.album.itunesCollectionId));
    expect(artIds.size).toBeGreaterThan(0);
    expect(balancedIds.size).toBeGreaterThan(0);
    expect(musicIds.size).toBeGreaterThan(0);
    expect([...artIds].some(id => balancedIds.has(id) || musicIds.has(id))).toBe(false);
    expect([...balancedIds].some(id => musicIds.has(id))).toBe(false);
  });

  it('calculates perceptual hash Hamming distance', () => {
    expect(calculateHammingDistance('1010', '1010')).toBe(0);
    expect(calculateHammingDistance('1010', '0101')).toBe(4);
  });

  it('rejects a stale collection ID that resolves to a different album', () => {
    const expected = album(100, 'The Beatles', '#d02020', [1, 0], { title: 'Abbey Road', normalizedTitle: 'abbey road' });
    const wrong = album(100, 'Jack Johnson', '#d02020', [1, 0], { title: 'Sleep Through the Static', normalizedTitle: 'sleep through the static' });
    expect(isSameAlbumIdentity(expected, wrong)).toBe(false);
    const remaster = album(101, 'The Beatles', '#d02020', [1, 0], { title: 'Abbey Road (2019 Mix)', normalizedTitle: 'abbey road (2019 mix)' });
    expect(isSameAlbumIdentity(expected, remaster)).toBe(true);
  });
});
