import { searchItunesAlbums, searchItunesArtistAlbums } from './itunes';
import type { Album, SearchScope } from './types';

const PROVIDER_FETCH_LIMIT = 50;

export interface AlbumSearchRequest {
  query: string;
  country: string;
  scope: SearchScope;
  limit: number;
}

/**
 * Keep search matching independent from the iTunes response language and
 * punctuation. This is shared by the API boundary and future search clients.
 */
export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokenize(value: string): string[] {
  return normalizeSearchText(value).split(' ').filter(Boolean);
}

/**
 * Match complete query phrases in order. Only the final query token may be a
 * prefix, which preserves useful type-ahead behaviour without accepting a
 * query token wherever it happens to occur in a field.
 */
function matchesTokenSequence(field: string, query: string): boolean {
  const fieldTokens = tokenize(field);
  const queryTokens = tokenize(query);
  if (!fieldTokens.length || !queryTokens.length || queryTokens.length > fieldTokens.length) {
    return false;
  }

  return fieldTokens.some((_, startIndex) =>
    queryTokens.every((queryToken, offset) => {
      const fieldToken = fieldTokens[startIndex + offset];
      if (!fieldToken) return false;
      if (offset < queryTokens.length - 1) return fieldToken === queryToken;
      return fieldToken === queryToken || fieldToken.startsWith(queryToken);
    }),
  );
}

export function matchesSearchScope(album: Album, query: string, scope: SearchScope): boolean {
  if (scope === 'all') return true;
  return matchesTokenSequence(scope === 'title' ? album.title : album.artistName, query);
}

function deduplicateAlbums(albums: Album[]): Album[] {
  return Array.from(
    new Map(albums.map((album) => [album.itunesCollectionId, album])).values(),
  );
}

function normalizeLimit(limit: number): number {
  return Math.max(1, Math.min(Number.isFinite(limit) ? Math.floor(limit) : 50, 50));
}

function matchesAllQueryTokens(album: Album, query: string): boolean {
  const fieldTokens = tokenize(`${album.artistName} ${album.title}`);
  return tokenize(query).every((queryToken) =>
    fieldTokens.some((fieldToken) => fieldToken === queryToken || fieldToken.startsWith(queryToken)),
  );
}

/**
 * Search is the domain seam for both the homepage and the global header.
 * Provider attributes improve recall, while local scope validation guarantees
 * precision even when iTunes returns loosely related records.
 */
export async function searchAlbums(request: AlbumSearchRequest): Promise<Album[]> {
  const query = request.query.trim();
  if (!query) return [];

  const limit = normalizeLimit(request.limit);
  const providerLimit = Math.max(PROVIDER_FETCH_LIMIT, limit);

  const sourceAlbums = request.scope === 'all'
    ? await Promise.all([
      searchItunesArtistAlbums(query, request.country),
      searchItunesAlbums(query, request.country, providerLimit, false, true),
      searchItunesAlbums(query, request.country, providerLimit),
    ]).then(([discographyAlbums, artistAlbums, broadAlbums]) => [
      ...discographyAlbums.filter((album) => matchesAllQueryTokens(album, query)),
      ...artistAlbums,
      ...broadAlbums,
    ])
    : request.scope === 'artist'
      ? await searchItunesArtistAlbums(query, request.country)
      : await searchItunesAlbums(query, request.country, providerLimit, true);

  const deduplicatedSource = deduplicateAlbums(sourceAlbums);
  const scopedAlbums = deduplicatedSource.filter((album) =>
    request.scope === 'all'
      ? matchesAllQueryTokens(album, query)
      : matchesSearchScope(album, query, request.scope),
  );

  // Preserve iTunes' fuzzy-search fallback for misspellings, but do not let
  // loosely related provider results displace genuine artist/title matches.
  if (request.scope === 'all') {
    return (scopedAlbums.length ? scopedAlbums : deduplicatedSource).slice(0, limit);
  }

  // A provider-scoped query can still omit valid records from its first page.
  // Fill the remainder from the broad query, but apply the same strict local
  // matcher before anything reaches the client.
  if (scopedAlbums.length < limit) {
    const broadAlbums = await searchItunesAlbums(query, request.country, providerLimit);
    return deduplicateAlbums([...scopedAlbums, ...broadAlbums.filter((album) =>
      matchesSearchScope(album, query, request.scope),
    )]).slice(0, limit);
  }

  return scopedAlbums.slice(0, limit);
}
