import { describe, it, expect } from 'vitest';
import { searchItunesAlbums } from '../src/lib/itunes';

describe('Search & Autocomplete Engine', () => {
  it('returns empty array when query is blank or whitespace', async () => {
    const results = await searchItunesAlbums('   ', 'PH', 10);
    expect(results).toEqual([]);
  });

  it('fetches search results and deduplicates duplicate albums', async () => {
    const results = await searchItunesAlbums('Abbey Road', 'US', 15);
    expect(results.length).toBeGreaterThan(0);
    // Check that collection IDs are unique
    const ids = results.map(a => a.itunesCollectionId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
