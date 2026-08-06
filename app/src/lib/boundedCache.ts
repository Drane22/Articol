export interface CacheOptions {
  maxEntries: number;
  ttlMs: number;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Small process-local TTL/LRU cache for API work. It is intentionally bounded:
 * automatic searches never turn into an unbounded catalog or database table.
 */
export class BoundedTtlCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();

  constructor(private readonly options: CacheOptions) {}

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }

    // Refresh insertion order so the oldest entry is also the least recently used.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T, ttlMs: number = this.options.ttlMs): void {
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: Date.now() + ttlMs });
    this.prune();
  }

  delete(key: string): void {
    this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    this.removeExpired();
    return this.entries.size;
  }

  private removeExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(key);
    }
  }

  private prune(): void {
    this.removeExpired();
    while (this.entries.size > this.options.maxEntries) {
      const oldestKey = this.entries.keys().next().value as string | undefined;
      if (!oldestKey) break;
      this.entries.delete(oldestKey);
    }
  }
}

/** Deduplicates concurrent work without retaining completed promises. */
export class InflightRequests<T> {
  private readonly requests = new Map<string, Promise<T>>();

  run(key: string, factory: () => Promise<T>): Promise<T> {
    const active = this.requests.get(key);
    if (active) return active;

    const request = factory().finally(() => this.requests.delete(key));
    this.requests.set(key, request);
    return request;
  }

  get size(): number {
    return this.requests.size;
  }
}
