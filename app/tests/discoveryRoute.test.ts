import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { Album } from '../src/lib/types';

const state = vi.hoisted(() => ({ albums: [] as Album[], save: vi.fn(), enrich: vi.fn() }));
vi.mock('../src/lib/db', () => ({
  getAllCatalogAlbums: async () => state.albums,
  saveAlbumsToDb: state.save,
}));
vi.mock('../src/lib/itunes', () => ({ enrichAlbumWithArtwork: state.enrich }));
import { GET } from '../app/api/discover/route';

async function discover(query = '') {
  const response = await GET(new NextRequest(`http://localhost/api/discover?${query}`));
  return { response, data: await response.json() };
}

describe('read-only discovery pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.albums = Array.from({ length: 125 }, (_, index) => ({
      id: String(index + 1), itunesCollectionId: index + 1,
      title: `Album ${index + 1}`, genre: 'Rock', releaseYear: 2020,
      normalizedTitle: `album ${index + 1}`, artistName: 'Artist',
      normalizedArtistName: 'artist', releaseDate: '2020-01-01',
      country: 'PH', trackCount: 10, artworkSource: 'itunes',
      artworkUrl: `https://example.com/${index}.jpg`,
      dominantPalette: [], visualFeatures: {} as Album['visualFeatures'],
      embedding: Array(512).fill(0.05), perceptualHash: 'internal',
      visualAnalysisError: 'diagnostic', artworkChecksum: 'checksum',
    } as Album));
  });

  it('returns disjoint bounded pages with display fields and shared caching', async () => {
    const first = await discover();
    const second = await discover(`offset=${first.data.nextOffset}`);
    expect(first.data.count).toBe(125);
    expect(first.data.albums).toHaveLength(48);
    expect(first.data.nextOffset).toBe(48);
    expect(second.data.albums[0].itunesCollectionId).toBe(49);
    expect(first.data.albums[0]).not.toHaveProperty('embedding');
    expect(first.data.albums[0]).not.toHaveProperty('perceptualHash');
    expect(first.data.albums[0]).not.toHaveProperty('visualAnalysisError');
    expect(first.response.headers.get('cache-control')).toContain('s-maxage=300');
    expect(state.save).not.toHaveBeenCalled();
  });

  it('bounds oversized input and handles invalid and exhausted pages', async () => {
    expect((await discover('limit=99999')).data.albums).toHaveLength(96);
    expect((await discover('limit=nope&offset=-1')).data.albums).toHaveLength(48);
    const last = (await discover('offset=96')).data;
    expect(last.albums).toHaveLength(29);
    expect(last.nextOffset).toBeNull();
    expect((await discover('offset=9999')).data.albums).toEqual([]);
  });

  it('does not analyze or persist unverified artwork when filtering colors', async () => {
    const { data } = await discover('color=%23ff0000');
    expect(data.albums).toEqual([]);
    expect(state.enrich).not.toHaveBeenCalled();
    expect(state.save).not.toHaveBeenCalled();
  });

  it('limits featured results without persisting or leaking vectors', async () => {
    const { data } = await discover('featured=true');
    expect(data.albums).toHaveLength(6);
    expect(data.albums.every((album: Album) => !album.embedding)).toBe(true);
    expect(state.save).not.toHaveBeenCalled();
  });
});
