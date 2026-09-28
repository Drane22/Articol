import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const lookup = vi.hoisted(() => vi.fn());
vi.mock('../src/lib/db', () => ({ getAlbumFromDb: lookup }));
import { GET } from '../app/api/albums/[id]/similar/route';

describe('forced recommendation rebuild authorization', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
  it('rejects rebuilds before lookup when the credential is missing or incorrect', async () => {
    vi.stubEnv('INDEXING_SECRET', 'test-indexing-secret');
    const response = await GET(new NextRequest('http://localhost/api/albums/123/similar?rebuild=1'), {
      params: Promise.resolve({ id: '123' }),
    });
    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(lookup).not.toHaveBeenCalled();
  });
});
