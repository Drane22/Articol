import { BoundedTtlCache } from './boundedCache';

// Six variants, at most 8 MiB each, for five minutes. Store Files, never object
// URLs: the mounted editor owns (and revokes) its displayed preview URL.
const completedPosters = new BoundedTtlCache<File>({ maxEntries: 6, ttlMs: 5 * 60 * 1000 });

export async function fetchPosterFile(url: string, filename: string, signal?: AbortSignal): Promise<File> {
  const key = JSON.stringify([url, filename]);
  const cached = completedPosters.get(key);
  if (cached) return cached;

  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Portrait card request failed (${response.status})`);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().startsWith('image/')) {
    throw new Error(`Portrait card returned ${contentType || 'an unknown file type'}`);
  }
  const blob = await response.blob();
  if (blob.size === 0) throw new Error('Portrait card returned an empty image');
  const file = new File([blob], filename, { type: blob.type || 'image/png' });
  if (!signal?.aborted && file.size <= 8 * 1024 * 1024) completedPosters.set(key, file);
  return file;
}
