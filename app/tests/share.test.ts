import { describe, expect, it } from 'vitest';
import { getAbsoluteUrl, getAlbumShareImagePath, getAlbumSharePath } from '../src/lib/share';

describe('share URL contract', () => {
  it('normalizes storefronts for the album page and OG image paths', () => {
    expect(getAlbumSharePath('123', 'us')).toBe('/album/123?country=US');
    expect(getAlbumShareImagePath('123', 'us')).toBe('/album/123/opengraph-image?country=US');
  });

  it('builds crawler-safe absolute URLs from a site origin', () => {
    expect(getAbsoluteUrl('/album/123?country=PH', 'https://articol.example')).toBe(
      'https://articol.example/album/123?country=PH',
    );
  });
});
