import { describe, expect, it, vi } from 'vitest';
import { BoundedTtlCache, InflightRequests } from '../src/lib/boundedCache';

describe('bounded API cache', () => {
  it('evicts the least recently used entry at its hard limit', () => {
    const cache = new BoundedTtlCache<number>({ maxEntries: 2, ttlMs: 60_000 });
    cache.set('first', 1);
    cache.set('second', 2);
    expect(cache.get('first')).toBe(1);
    cache.set('third', 3);
    expect(cache.get('second')).toBeUndefined();
    expect(cache.get('first')).toBe(1);
    expect(cache.size).toBe(2);
  });

  it('expires records instead of growing indefinitely', () => {
    vi.useFakeTimers();
    const cache = new BoundedTtlCache<number>({ maxEntries: 4, ttlMs: 1000 });
    cache.set('album', 1);
    vi.advanceTimersByTime(1001);
    expect(cache.get('album')).toBeUndefined();
    expect(cache.size).toBe(0);
    vi.useRealTimers();
  });

  it('deduplicates simultaneous API work', async () => {
    const inflight = new InflightRequests<number>();
    let calls = 0;
    const factory = async () => {
      calls += 1;
      await Promise.resolve();
      return 42;
    };
    const [first, second] = await Promise.all([
      inflight.run('same-album', factory),
      inflight.run('same-album', factory),
    ]);
    expect([first, second]).toEqual([42, 42]);
    expect(calls).toBe(1);
    expect(inflight.size).toBe(0);
  });
});
