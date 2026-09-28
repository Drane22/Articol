import { afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ selected: '', row: {} as Record<string, unknown> }));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      let mode = '';
      const builder: any = {
        select: (columns: string) => { if (table === 'albums') state.selected = columns; return builder; },
        eq: (column: string, value: string) => { if (column === 'mode') mode = value; return builder; },
        order: () => builder,
        limit: async () => ({ error: null, data: mode === 'art_style' ? [{
          candidate_album_id: 2, mode, visual_score: 0.9, music_score: 0.1,
          final_score: 0.9, final_confidence: 0.9, component_scores: { color: 0.95 },
        }] : [] }),
        in: async () => ({ error: null, data: [Object.fromEntries(
          state.selected.split(',').map(key => [key, state.row[key]]),
        )] }),
      };
      return builder;
    },
  }),
}));

import { getSimilarityResultsFromCache, mapSupabaseAlbumRow } from '../src/lib/db';

describe('cached recommendation display reads', () => {
  afterEach(() => vi.unstubAllEnvs());
  it('preserves palette explanations while omitting vectors from the database read', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://projection.test.invalid');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'test-key');
    state.row = {
      id: 2, itunes_collection_id: 2, title: 'Candidate', artist_name: 'Artist',
      embedding: Array(512).fill(0.05),
      dominant_palette: [{ hex: '#ff0000', lab: [53, 80, 67], weight: 1 }],
      visual_features: { colorProfile: {
        neutralCoverage: 0, chromaticCoverage: 1, dominantHue: 20,
        hueConcentration: 1, meanLightness: 0.5, lightnessSpread: 0.1,
      } },
      visual_analysis_status: 'analyzed',
    };
    const query = mapSupabaseAlbumRow({ ...state.row, itunes_collection_id: 1 });
    const tiers = await getSimilarityResultsFromCache(query, 'test-version');
    expect(state.selected.split(',')).not.toContain('embedding');
    expect(state.selected).not.toBe('*');
    expect(tiers?.art_style[0].album.embedding).toBeUndefined();
    expect(tiers?.art_style[0].explanation).toContain('100% palette compatibility');
    expect(tiers?.art_style[0].paletteComparison?.candidate).toEqual(['#ff0000']);
  });
});
