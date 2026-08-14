#!/usr/bin/env node

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ALGORITHM_VERSION = 'articol-v7-verified-visual-palette10';
const DEFAULT_COUNTRY = 'PH';
const DEFAULT_BASE_URL = 'http://localhost:3000';
const DEFAULT_DISCOVERY_DELAY_MS = 3500;
const DEFAULT_REQUEST_DELAY_MS = 250;
const REQUEST_TIMEOUT_MS = 90_000;
const MAX_ALBUM_TARGET = 9000;
const DEFAULT_GENERAL_ALBUM_TARGET = 7000;
const DEFAULT_OPM_ALBUM_TARGET = 2000;
const MAX_CACHE_TARGET = 10_000;
const DEFAULT_CANDIDATE_POOL_LIMIT = 500;
const DISCOVERY_BUFFER = 1.3;
const DISCOVERY_PAGE_SIZE = 200;
const CACHE_PAGE_SIZE = 1000;
let interrupted = false;

const OPM_DISCOVERY_TERMS = [
  'opm', 'filipino music', 'pinoy music', 'tagalog music', 'philippine music',
  ...'abcdefghijklmnopqrstuvwxyz'.split('').map((letter) => `opm ${letter}`),
  ...'abcdefghijklmnopqrstuvwxyz'.split('').map((letter) => `filipino ${letter}`),
];

const GENERAL_DISCOVERY_TERMS = [
  'rock', 'pop', 'hip hop', 'jazz', 'classical', 'electronic', 'r&b',
  'soul', 'metal', 'punk', 'indie', 'alternative', 'folk', 'country',
  'reggae', 'blues', 'ambient', 'soundtrack', 'world music', 'latin',
  'k-pop', 'gospel', 'opera', 'experimental', 'singer songwriter', 'lo-fi',
  'house', 'techno', 'disco', 'funk', 'grunge', 'hardcore',
  'death metal', 'trap', 'bedroom pop', 'afrobeat', 'shoegaze', 'drum and bass',
  'dance', 'new age', 'bluegrass', 'post-rock',
  // Additional long-tail terms keep discovery useful after the broad genres
  // saturate the iTunes relevance window. They are intentionally distinct so
  // a resumed checkpoint can collect new IDs without replaying old searches.
  'alternative rock', 'indie rock', 'hard rock', 'folk rock', 'pop rock',
  'post punk', 'emo', 'metalcore', 'black metal', 'heavy metal',
  'progressive metal', 'deathcore', 'j-pop', 'mandopop', 'c-pop',
  'afro pop', 'reggaeton', 'salsa', 'bossa nova', 'americana',
  'country pop', 'blues rock', 'dubstep', 'trance', 'synth pop',
  'synthwave', 'future bass', 'garage rock', 'math rock', 'noise rock',
  'dream pop', 'chillwave', 'post hardcore', 'ska', 'ska punk',
  'musical theatre', 'film score', 'christian rock', 'spoken word',
  'acoustic', 'piano', 'guitar', 'live album', 'remix',
];

class HttpError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const [rawKey, inlineValue] = token.slice(2).split('=', 2);
    if (inlineValue !== undefined) {
      result[rawKey] = inlineValue;
      continue;
    }
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      result[rawKey] = next;
      index += 1;
    } else {
      result[rawKey] = true;
    }
  }
  return result;
}

function numberOption(args, key, fallback, minimum, maximum) {
  const candidate = Number(args[key] ?? fallback);
  if (!Number.isFinite(candidate)) return fallback;
  return Math.min(Math.max(Math.floor(candidate), minimum), maximum);
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function throwIfInterrupted() {
  if (interrupted) throw new Error('Population interrupted; the checkpoint was retained for resume.');
}

async function loadEnvFile(filePath) {
  try {
    const source = await fs.readFile(filePath, 'utf8');
    for (const line of source.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match || match[1] in process.env) continue;
      let value = match[2];
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[match[1]] = value;
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

function buildOptions(args) {
  const npmOption = (key) => process.env[`npm_config_${key.replaceAll('-', '_')}`];
  const opmOnly = args['opm-only'] === true || String(npmOption('opm-only')).toLowerCase() === 'true';
  const hasExplicitTotal = args['target-albums'] !== undefined || npmOption('target-albums') !== undefined;
  const requestedTotal = numberOption(args, 'target-albums', npmOption('target-albums') ?? MAX_ALBUM_TARGET, 1, MAX_ALBUM_TARGET);
  const targetOpm = opmOnly
    ? requestedTotal
    : numberOption(args, 'opm-albums', npmOption('opm-albums') ?? DEFAULT_OPM_ALBUM_TARGET, 0, MAX_ALBUM_TARGET);
  const targetGeneral = opmOnly
    ? 0
    : (hasExplicitTotal
      ? Math.max(0, requestedTotal - targetOpm)
      : numberOption(args, 'general-albums', npmOption('general-albums') ?? DEFAULT_GENERAL_ALBUM_TARGET, 0, MAX_ALBUM_TARGET));
  const targetAlbums = targetGeneral + targetOpm;
  if (targetAlbums < 1 || targetAlbums > MAX_ALBUM_TARGET) {
    throw new Error(`Combined general and OPM targets must total between 1 and ${MAX_ALBUM_TARGET} albums.`);
  }
  const targetCache = numberOption(args, 'target-cache', npmOption('target-cache') ?? 5000, 1, MAX_CACHE_TARGET);
  const candidatePoolLimit = numberOption(args, 'candidate-pool-limit', npmOption('candidate-pool-limit') ?? DEFAULT_CANDIDATE_POOL_LIMIT, 50, 500);
  const country = String(args.country || npmOption('country') || DEFAULT_COUNTRY).toUpperCase();
  const baseUrl = String(args['base-url'] || npmOption('base-url') || process.env.ARTICOL_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
  const defaultStatePath = path.join(os.tmpdir(), `articol-catalog-populate-${opmOnly ? 'opm-' : ''}${country}.json`);
  const statePath = path.resolve(
    String(args['state-path'] || npmOption('state-path') || process.env.ARTICOL_POPULATE_STATE || defaultStatePath),
  );

  return {
    targetAlbums,
    targetGeneral,
    targetOpm,
    targetCache,
    candidatePoolLimit,
    discoveryScope: opmOnly ? 'opm' : 'hybrid',
    country,
    baseUrl,
    statePath,
    lockPath: `${statePath}.lock`,
    discoveryDelayMs: numberOption(args, 'discovery-delay-ms', DEFAULT_DISCOVERY_DELAY_MS, 3000, 60_000),
    requestDelayMs: numberOption(args, 'request-delay-ms', DEFAULT_REQUEST_DELAY_MS, 0, 10_000),
    reset: args.reset === true || String(npmOption('reset')).toLowerCase() === 'true',
    rebuildSimilarity: args['rebuild-similarity'] === true || String(npmOption('rebuild-similarity')).toLowerCase() === 'true',
  };
}

function assertLocalBaseUrl(baseUrl) {
  const parsed = new URL(baseUrl);
  const localHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
  if (!localHosts.has(parsed.hostname)) {
    throw new Error(`Refusing remote base URL ${baseUrl}. Run the worker against local Next.js.`);
  }
}

function getSupabaseConfig() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) {
    throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) before running the worker.');
  }
  return { url, key };
}

function isReliableAlbum(album) {
  const colorProfile = album?.visualFeatures?.colorProfile;
  return Boolean(
    album &&
    album.visualAnalysisStatus === 'analyzed' &&
    album.embeddingVersion === 'visual-grid-v4-palette10' &&
    album.featureExtractionVersion === 'visual-grid-v4-palette10' &&
    typeof album.perceptualHash === 'string' &&
    album.perceptualHash.length > 0 &&
    hasReliableStoredEmbedding(album.embedding) &&
    hasReliableStoredPalette(album.dominantPalette) &&
    colorProfile &&
    ['neutralCoverage', 'chromaticCoverage', 'hueConcentration', 'meanLightness', 'lightnessSpread']
      .every((key) => Number.isFinite(Number(colorProfile[key]))) &&
    Number.isFinite(Number(colorProfile.dominantHue)) &&
    Number(colorProfile.neutralCoverage) + Number(colorProfile.chromaticCoverage) >= 0.95 &&
    Number(colorProfile.neutralCoverage) + Number(colorProfile.chromaticCoverage) <= 1.05,
  );
}

function hasReliableStoredEmbedding(value) {
  const parsed = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? (() => {
          try {
            return JSON.parse(value);
          } catch {
            return [];
          }
        })()
      : [];
  if (parsed.length !== 512 || !parsed.every((entry) => Number.isFinite(Number(entry)))) return false;
  const norm = Math.sqrt(parsed.reduce((sum, entry) => sum + Number(entry) ** 2, 0));
  return norm >= 0.98 && norm <= 1.02;
}

function hasReliableStoredPalette(value) {
  const palette = typeof value === 'string'
    ? (() => {
        try {
          return JSON.parse(value);
        } catch {
          return [];
        }
      })()
    : value;
  if (!Array.isArray(palette) || palette.length === 0) return false;
  const totalWeight = palette.reduce((sum, color) => (
    sum + (Number.isFinite(Number(color?.weight)) && Number(color.weight) > 0 ? Number(color.weight) : 0)
  ), 0);
  return totalWeight > 0 && palette.every((color) => (
    /^#[0-9a-f]{6}$/i.test(String(color?.hex || '')) &&
    Array.isArray(color?.lab) &&
    color.lab.length === 3 &&
    color.lab.every((entry) => Number.isFinite(Number(entry)))
  ));
}

function hasReliableStoredColorProfile(value) {
  const features = typeof value === 'string'
    ? (() => {
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      })()
    : value;
  const profile = features?.colorProfile;
  return Boolean(
    profile &&
    ['neutralCoverage', 'chromaticCoverage', 'hueConcentration', 'meanLightness', 'lightnessSpread']
      .every((key) => Number.isFinite(Number(profile[key]))) &&
    Number.isFinite(Number(profile.dominantHue)) &&
    Number(profile.neutralCoverage) + Number(profile.chromaticCoverage) >= 0.95 &&
    Number(profile.neutralCoverage) + Number(profile.chromaticCoverage) <= 1.05,
  );
}

function defaultState(options) {
  return {
    version: 1,
    country: options.country,
    targetAlbums: options.targetAlbums,
    targetGeneral: options.targetGeneral,
    targetOpm: options.targetOpm,
    targetCache: options.targetCache,
    discoveryScope: options.discoveryScope,
    discoveryIndex: 0,
    generalDiscoveryIndex: 0,
    opmDiscoveryIndex: 0,
    discoveredIds: [],
    discoveredGeneralIds: [],
    discoveredOpmIds: [],
    indexedIds: [],
    indexedGeneralIds: [],
    indexedOpmIds: [],
    failedIds: [],
    attempts: {},
    cacheSourceIds: [],
    similarityFailedIds: [],
    similarityRebuildPrepared: false,
    phase: 'discover',
    updatedAt: new Date().toISOString(),
  };
}

function normalizeState(state, options) {
  if (!state || state.version !== 1) return defaultState(options);
  // Older checkpoints predate quota-aware discovery. Require --reset for
  // those runs so a stale single-pool state cannot satisfy either quota.
  const checkpointScope = state.discoveryScope || 'general';
  if (state.country !== options.country || state.targetAlbums !== options.targetAlbums || state.targetGeneral !== options.targetGeneral || state.targetOpm !== options.targetOpm || state.targetCache !== options.targetCache || checkpointScope !== options.discoveryScope) {
    throw new Error(`Checkpoint ${options.statePath} belongs to different targets/country. Use --reset to start a new run.`);
  }
  return {
    ...defaultState(options),
    ...state,
    discoveryScope: checkpointScope,
    targetGeneral: Number.isFinite(Number(state.targetGeneral)) ? Number(state.targetGeneral) : options.targetGeneral,
    targetOpm: Number.isFinite(Number(state.targetOpm)) ? Number(state.targetOpm) : options.targetOpm,
    discoveredIds: Array.from(new Set((state.discoveredIds || []).map(Number).filter(Number.isFinite))),
    discoveredGeneralIds: Array.from(new Set((state.discoveredGeneralIds || []).map(Number).filter(Number.isFinite))),
    discoveredOpmIds: Array.from(new Set((state.discoveredOpmIds || []).map(Number).filter(Number.isFinite))),
    indexedIds: Array.from(new Set((state.indexedIds || []).map(Number).filter(Number.isFinite))),
    indexedGeneralIds: Array.from(new Set((state.indexedGeneralIds || []).map(Number).filter(Number.isFinite))),
    indexedOpmIds: Array.from(new Set((state.indexedOpmIds || []).map(Number).filter(Number.isFinite))),
    failedIds: Array.from(new Set((state.failedIds || []).map(Number).filter(Number.isFinite))),
    cacheSourceIds: Array.from(new Set((state.cacheSourceIds || []).map(Number).filter(Number.isFinite))),
    similarityFailedIds: Array.from(new Set((state.similarityFailedIds || []).map(Number).filter(Number.isFinite))),
    similarityRebuildPrepared: state.similarityRebuildPrepared === true,
    attempts: state.attempts && typeof state.attempts === 'object' ? state.attempts : {},
  };
}

async function readState(options) {
  if (options.reset) {
    await fs.rm(options.statePath, { force: true });
    return defaultState(options);
  }
  try {
    const state = JSON.parse(await fs.readFile(options.statePath, 'utf8'));
    return normalizeState(state, options);
  } catch (error) {
    if (error?.code === 'ENOENT') return defaultState(options);
    if (error instanceof SyntaxError) throw new Error(`Checkpoint ${options.statePath} is invalid. Use --reset to discard it.`);
    throw error;
  }
}

async function writeState(options, state) {
  state.updatedAt = new Date().toISOString();
  await fs.mkdir(path.dirname(options.statePath), { recursive: true });
  const temporaryPath = `${options.statePath}.${process.pid}.tmp`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  await fs.rename(temporaryPath, options.statePath);
}

async function acquireLock(options) {
  try {
    await fs.mkdir(path.dirname(options.lockPath), { recursive: true });
    const handle = await fs.open(options.lockPath, 'wx');
    await handle.writeFile(`${process.pid}\n`, 'utf8');
    await handle.close();
  } catch (error) {
    if (error?.code === 'EEXIST') throw new Error(`Another catalog population process is using ${options.lockPath}.`);
    throw error;
  }
}

async function releaseLock(options) {
  await fs.rm(options.lockPath, { force: true });
}

async function requestJson(url, init = {}, retries = 3) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      const text = await response.text();
      let body = {};
      try {
        body = text ? JSON.parse(text) : {};
      } catch {
        body = { raw: text.slice(0, 200) };
      }
      if (response.ok) return { body, headers: response.headers };
      const error = new HttpError(body?.error || body?.message || `HTTP ${response.status}`, response.status);
      if (attempt >= retries || (response.status !== 408 && response.status !== 425 && response.status !== 429 && (response.status < 500 || response.status >= 600))) {
        throw error;
      }
      lastError = error;
    } catch (error) {
      if (error instanceof HttpError && error.status !== 408 && error.status !== 425 && error.status !== 429 && error.status < 500) throw error;
      lastError = error;
      if (attempt >= retries) throw error;
    } finally {
      clearTimeout(timeout);
    }
    await sleep(Math.min(30_000, 1000 * 2 ** attempt));
  }
  throw lastError || new Error(`Request failed: ${url}`);
}

async function apiRequest(options, route, init = {}) {
  const headers = new Headers(init.headers || {});
  if (process.env.INDEXING_SECRET) headers.set('Authorization', `Bearer ${process.env.INDEXING_SECRET}`);
  return requestJson(`${options.baseUrl}${route}`, { ...init, headers });
}

async function supabaseRequest(config, route, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('apikey', config.key);
  headers.set('Authorization', `Bearer ${config.key}`);
  headers.set('Prefer', 'count=exact');
  return requestJson(`${config.url}${route}`, { ...init, headers });
}

async function getReliableAlbumIds(config) {
  const ids = new Set();
  for (let offset = 0; ; offset += CACHE_PAGE_SIZE) {
    const params = new URLSearchParams({
      select: 'itunes_collection_id,embedding,dominant_palette,visual_features',
      visual_analysis_status: 'eq.analyzed',
      embedding_version: 'eq.visual-grid-v4-palette10',
      feature_extraction_version: 'eq.visual-grid-v4-palette10',
      perceptual_hash: 'not.is.null',
      embedding: 'not.is.null',
      limit: String(CACHE_PAGE_SIZE),
      offset: String(offset),
    });
    const { body } = await supabaseRequest(config, `/rest/v1/albums?${params}`);
    const rows = Array.isArray(body) ? body : [];
    for (const row of rows) {
      const id = Number(row.itunes_collection_id);
      if (
        Number.isFinite(id) &&
        hasReliableStoredEmbedding(row.embedding) &&
        hasReliableStoredPalette(row.dominant_palette) &&
        hasReliableStoredColorProfile(row.visual_features)
      ) ids.add(id);
    }
    if (rows.length < CACHE_PAGE_SIZE) break;
  }
  return ids;
}

async function getCacheStats(config, reliableIds) {
  const allowedIds = new Set(reliableIds);
  if (allowedIds.size === 0) return { count: 0, sourceIds: new Set() };

  let count = 0;
  const sourceIds = new Set();
  for (let offset = 0; ; offset += CACHE_PAGE_SIZE) {
    const params = new URLSearchParams({
      select: 'source_album_id,candidate_album_id',
      scoring_version: `eq.${ALGORITHM_VERSION}`,
      limit: String(CACHE_PAGE_SIZE),
      offset: String(offset),
    });
    const { body } = await supabaseRequest(config, `/rest/v1/album_similarity_cache?${params}`);
    const rows = Array.isArray(body) ? body : [];
    for (const row of rows) {
      const sourceId = Number(row.source_album_id);
      const candidateId = Number(row.candidate_album_id);
      if (allowedIds.has(sourceId) && allowedIds.has(candidateId)) {
        count += 1;
        sourceIds.add(sourceId);
      }
    }
    if (rows.length < CACHE_PAGE_SIZE) break;
  }
  return { count, sourceIds };
}

function discoveryTarget(target, minimumFloor = 0) {
  if (target <= 0) return 0;
  return Math.min(Math.ceil(target * DISCOVERY_BUFFER), Math.max(target + 100, minimumFloor));
}

async function discoverPool(options, state, {
  label,
  terms,
  target,
  indexKey,
  idsKey,
  excludedIds = new Set(),
  minimumFloor = 0,
}) {
  const targetWithBuffer = discoveryTarget(target, minimumFloor);
  const discovered = new Set(state[idsKey] || []);
  if (target <= 0) return discovered;

  console.log(`Discovering ${targetWithBuffer} ${label} candidate IDs across ${terms.length} terms...`);
  for (let index = Number(state[indexKey] || 0); index < terms.length && discovered.size < targetWithBuffer; index += 1) {
    throwIfInterrupted();
    const term = terms[index];
    const params = new URLSearchParams({
      term,
      country: options.country,
      media: 'music',
      entity: 'album',
      limit: String(DISCOVERY_PAGE_SIZE),
    });
    try {
      const { body } = await requestJson(`https://itunes.apple.com/search?${params}`);
      throwIfInterrupted();
      for (const row of Array.isArray(body?.results) ? body.results : []) {
        const id = Number(row.collectionId);
        if (Number.isFinite(id) && !excludedIds.has(id)) discovered.add(id);
      }
      console.log(`  ${term}: ${discovered.size}/${targetWithBuffer} ${label} IDs`);
    } catch (error) {
      console.warn(`  Search failed for ${term}; continuing: ${error.message}`);
    }
    state[indexKey] = index + 1;
    state[idsKey] = Array.from(discovered);
    state.discoveredIds = Array.from(new Set([
      ...(state.discoveredOpmIds || []),
      ...(state.discoveredGeneralIds || []),
    ]));
    state.phase = 'discover';
    await writeState(options, state);
    if (discovered.size < targetWithBuffer) await sleep(options.discoveryDelayMs);
  }

  if (discovered.size < target) {
    throw new Error(`Only discovered ${discovered.size} ${label} candidates; need ${target}. Add more discovery terms before running again.`);
  }
  return discovered;
}

async function discoverAlbums(options, state) {
  const opmIds = await discoverPool(options, state, {
    label: 'OPM',
    terms: OPM_DISCOVERY_TERMS,
    target: options.targetOpm,
    indexKey: 'opmDiscoveryIndex',
    idsKey: 'discoveredOpmIds',
    minimumFloor: options.targetOpm > 0 ? 2300 : 0,
  });
  await discoverPool(options, state, {
    label: 'general',
    terms: GENERAL_DISCOVERY_TERMS,
    target: options.targetGeneral,
    indexKey: 'generalDiscoveryIndex',
    idsKey: 'discoveredGeneralIds',
    excludedIds: opmIds,
    minimumFloor: options.targetGeneral > 0 ? 3500 : 0,
  });
  state.discoveredIds = Array.from(new Set([
    ...(state.discoveredOpmIds || []),
    ...(state.discoveredGeneralIds || []),
  ]));
  await writeState(options, state);
}

async function indexAlbums(options, state, config) {
  const remoteIds = await getReliableAlbumIds(config);
  const opmDiscovered = new Set(state.discoveredOpmIds || []);
  const generalDiscovered = new Set(state.discoveredGeneralIds || []);
  // The database is authoritative. Checkpoint IDs can outlive a dropped or
  // rebuilt albums table and must never inflate either quota.
  const indexedOpm = new Set([...remoteIds].filter((id) => opmDiscovered.has(id)));
  const indexedGeneral = new Set([...remoteIds].filter((id) => generalDiscovered.has(id) && !opmDiscovered.has(id)));
  const failed = new Set(state.failedIds);
  const syncIndexedState = () => {
    state.indexedOpmIds = Array.from(indexedOpm);
    state.indexedGeneralIds = Array.from(indexedGeneral);
    state.indexedIds = Array.from(new Set([...indexedOpm, ...indexedGeneral]));
  };
  syncIndexedState();
  state.phase = 'index';
  await writeState(options, state);

  const hasAllQuotas = () => indexedOpm.size >= options.targetOpm && indexedGeneral.size >= options.targetGeneral;
  if (hasAllQuotas()) {
    console.log(`Reliable albums already available: ${indexedGeneral.size}/${options.targetGeneral} general + ${indexedOpm.size}/${options.targetOpm} OPM.`);
    return new Set([...indexedOpm, ...indexedGeneral]);
  }

  console.log(`Indexing reliable albums: ${indexedGeneral.size}/${options.targetGeneral} general + ${indexedOpm.size}/${options.targetOpm} OPM.`);
  for (const id of [...opmDiscovered, ...generalDiscovered]) {
    throwIfInterrupted();
    const isOpm = opmDiscovered.has(id);
    const indexedPool = isOpm ? indexedOpm : indexedGeneral;
    const targetPool = isOpm ? options.targetOpm : options.targetGeneral;
    if (hasAllQuotas()) break;
    if (indexedPool.size >= targetPool || failed.has(id)) continue;

    const attempts = Number(state.attempts[id] || 0);
    if (attempts >= 3) {
      failed.add(id);
      continue;
    }

    state.attempts[id] = attempts + 1;
    await writeState(options, state);
    try {
      const { body } = await apiRequest(options, `/api/albums/${id}/index`, { method: 'POST' });
      throwIfInterrupted();
      if (!isReliableAlbum(body?.album)) {
        throw new Error('Index route returned a fallback or incomplete visual analysis');
      }
      indexedPool.add(id);
      syncIndexedState();
      console.log(`  indexed ${id}: ${isOpm ? 'OPM' : 'general'} ${indexedPool.size}/${targetPool}`);
    } catch (error) {
      if (error instanceof HttpError && error.status === 401) {
        throw new Error('The local indexing route rejected INDEXING_SECRET. Check .env.local and restart Next.js.');
      }
      if (state.attempts[id] >= 3) failed.add(id);
      console.warn(`  skipped ${id} (attempt ${state.attempts[id]}/3): ${error.message}`);
    }
    state.failedIds = Array.from(failed);
    await writeState(options, state);
    await sleep(options.requestDelayMs);
  }

  const finalIds = await getReliableAlbumIds(config);
  const finalOpm = new Set([...finalIds].filter((id) => opmDiscovered.has(id)));
  const finalGeneral = new Set([...finalIds].filter((id) => generalDiscovered.has(id) && !opmDiscovered.has(id)));
  state.indexedOpmIds = Array.from(finalOpm);
  state.indexedGeneralIds = Array.from(finalGeneral);
  state.indexedIds = Array.from(new Set([...finalOpm, ...finalGeneral]));
  if (finalOpm.size < options.targetOpm || finalGeneral.size < options.targetGeneral) {
    console.warn(`Indexed ${finalGeneral.size}/${options.targetGeneral} general and ${finalOpm.size}/${options.targetOpm} OPM albums; continuing with the reliable set so similarity-cache requests can run.`);
  }
  return new Set([...finalOpm, ...finalGeneral]);
}

async function populateSimilarityCache(options, state, config, reliableIds) {
  let cacheStats = await getCacheStats(config, reliableIds);
  let cacheCount = cacheStats.count;
  console.log(`Similarity cache rows: ${cacheCount}/${options.targetCache}`);
  if (cacheCount >= options.targetCache && !options.rebuildSimilarity) return cacheCount;

  const completedSources = cacheStats.sourceIds;
  const failedSources = new Set(state.similarityFailedIds || []);
  state.phase = 'similarity';
  await writeState(options, state);

  for (const id of reliableIds) {
    throwIfInterrupted();
    if (!options.rebuildSimilarity && cacheCount >= options.targetCache) break;
    if (completedSources.has(id)) continue;
    try {
      const { body } = await apiRequest(options, `/api/albums/${id}/similar?country=${options.country}&limit=18&pool=${options.candidatePoolLimit}&rebuild=1`);
      throwIfInterrupted();
      if (body?.status !== 'indexed') {
        console.warn(`  similarity skipped ${id}: source is not indexed`);
        continue;
      }
      completedSources.add(id);
      failedSources.delete(id);
      state.cacheSourceIds = Array.from(completedSources);
      state.similarityFailedIds = Array.from(failedSources);
      const tierCount = ['art_style', 'balanced', 'music_relation']
        .map((mode) => Array.isArray(body?.tiers?.[mode]) ? body.tiers[mode].length : 0)
        .reduce((sum, count) => sum + count, 0);
      cacheStats = await getCacheStats(config, reliableIds);
      cacheCount = cacheStats.count;
      console.log(`  cached ${id}: ${tierCount} candidate rows; table total ${cacheCount}/${options.targetCache}`);
    } catch (error) {
      if (error instanceof HttpError && error.status === 401) {
        throw new Error('The local indexing route rejected INDEXING_SECRET. Check .env.local and restart Next.js.');
      }
      console.warn(`  similarity failed for ${id}; continuing: ${error.message}`);
      failedSources.add(id);
      state.similarityFailedIds = Array.from(failedSources);
    }
    await writeState(options, state);
    await sleep(options.requestDelayMs);
  }

  cacheCount = (await getCacheStats(config, reliableIds)).count;
  if (cacheCount < options.targetCache && completedSources.size < reliableIds.size) {
    throw new Error(`Generated ${cacheCount} similarity-cache rows from ${completedSources.size}/${reliableIds.size} sources; rerun to continue with the checkpoint.`);
  }
  return cacheCount;
}

function getScopedReliableIds(allReliableIds, state) {
  const opmIds = new Set(state.discoveredOpmIds || []);
  const generalIds = new Set(state.discoveredGeneralIds || []);
  return new Set([...allReliableIds].filter((id) => opmIds.has(id) || generalIds.has(id)));
}

function getQuotaCounts(reliableIds, state) {
  const opmIds = new Set(state.discoveredOpmIds || []);
  const opm = [...reliableIds].filter((id) => opmIds.has(id)).length;
  return { opm, general: reliableIds.size - opm };
}

async function clearSimilarityCache(config) {
  const params = new URLSearchParams({ select: 'source_album_id', source_album_id: 'gt.0' });
  const { response } = await supabaseDelete(config, `/rest/v1/album_similarity_cache?${params}`);
  if (!response.ok) throw new Error(`Could not clear album_similarity_cache: HTTP ${response.status}`);
  console.log('Cleared album_similarity_cache for full regeneration.');
}

async function supabaseDelete(config, route) {
  const headers = new Headers({ apikey: config.key, Authorization: `Bearer ${config.key}`, Prefer: 'return=minimal' });
  const response = await fetch(`${config.url}${route}`, { method: 'DELETE', headers });
  return { response };
}

async function main() {
  await loadEnvFile(path.join(PROJECT_ROOT, '.env.local'));
  await loadEnvFile(path.join(PROJECT_ROOT, '.env'));

  const options = buildOptions(parseArgs(process.argv.slice(2)));
  process.once('SIGINT', () => { interrupted = true; });
  process.once('SIGTERM', () => { interrupted = true; });
  assertLocalBaseUrl(options.baseUrl);
  if (!process.env.INDEXING_SECRET) {
    throw new Error('Set INDEXING_SECRET in app/.env.local. The worker refuses unauthenticated indexing requests.');
  }
  const config = getSupabaseConfig();
  const state = await readState(options);
  let completed = false;

  await acquireLock(options);
  try {
    await discoverAlbums(options, state);
    const reliableIds = await indexAlbums(options, state, config);
    const quotaCounts = getQuotaCounts(reliableIds, state);
    if (options.rebuildSimilarity && !state.similarityRebuildPrepared) {
      if (quotaCounts.general < options.targetGeneral || quotaCounts.opm < options.targetOpm) {
        throw new Error(`Refusing to clear similarity cache: only ${quotaCounts.general}/${options.targetGeneral} general and ${quotaCounts.opm}/${options.targetOpm} OPM reliable albums are available.`);
      }
      await clearSimilarityCache(config);
      state.cacheSourceIds = [];
      state.similarityFailedIds = [];
      state.similarityRebuildPrepared = true;
      await writeState(options, state);
    }
    const cacheCount = await populateSimilarityCache(options, state, config, reliableIds);
    const finalReliableIds = getScopedReliableIds(await getReliableAlbumIds(config), state);
    const finalQuotaCounts = getQuotaCounts(finalReliableIds, state);
    if (finalQuotaCounts.general < options.targetGeneral || finalQuotaCounts.opm < options.targetOpm || (options.rebuildSimilarity ? state.cacheSourceIds.length < finalReliableIds.size : cacheCount < options.targetCache)) {
      const missingAlbums = Math.max(0, options.targetAlbums - finalReliableIds.size);
      const missingCacheRows = Math.max(0, options.targetCache - cacheCount);
      throw new Error(
        `Population incomplete: ${finalQuotaCounts.general}/${options.targetGeneral} general, ${finalQuotaCounts.opm}/${options.targetOpm} OPM reliable albums and ` +
        `${cacheCount} similarity-cache rows from ${state.cacheSourceIds.length}/${finalReliableIds.size} sources. ` +
        `${missingAlbums} albums and ${missingCacheRows} cache rows remain; rerun with the checkpoint.`,
      );
    }
    completed = true;
    console.log(`Completed table-only population: ${finalQuotaCounts.general} general + ${finalQuotaCounts.opm} OPM reliable albums and ${cacheCount} similarity-cache rows.`);
  } finally {
    await releaseLock(options);
    if (completed) await fs.rm(options.statePath, { force: true });
    else console.log(`Checkpoint retained at ${options.statePath} for resume.`);
  }
}

main().catch((error) => {
  console.error(`Catalog population stopped: ${error.message}`);
  process.exitCode = 1;
});
