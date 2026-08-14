import {
  Album,
  SearchMode,
  SimilarityResult,
  MatchReason,
  SharedAttribute,
  RecommendationTiers,
  ComponentScores,
} from './types';
import { calculateColorSimilarity } from './colorUtils';
import { isReliableVisualAnalysis } from './visualValidation';

export const MIN_RECOMMENDATION_CONFIDENCE = 0.30;
export const RECOMMENDATION_ALGORITHM_VERSION = 'articol-v7-verified-visual-palette10';
export const RECOMMENDATION_ELIGIBILITY_VERSION = 'verified-visual-v3';
export const MIN_ART_STYLE_PALETTE_COMPATIBILITY = 0.60;
export const MIN_BALANCED_PALETTE_COMPATIBILITY = 0.48;
export const MIN_ART_STYLE_SCORE = 0.58;
export const MIN_BALANCED_SCORE = 0.54;

export function isRecommendationConfidenceEligible(confidence: number): boolean {
  return Number.isFinite(confidence) && confidence >= MIN_RECOMMENDATION_CONFIDENCE;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function hasPalette(album: Album): boolean {
  return Array.isArray(album.dominantPalette) && album.dominantPalette.length > 0;
}

function hasEmbedding(album: Album): boolean {
  return Array.isArray(album.embedding) && album.embedding.length > 0;
}

function hasReleaseYear(album: Album): boolean {
  return Number.isFinite(album.releaseYear) && album.releaseYear > 0;
}

function hasGenre(album: Album): boolean {
  return typeof album.genre === 'string' && Boolean(album.genre.trim());
}

function hasFiniteVisualValues(album: Album, keys: Array<keyof Album['visualFeatures']>): boolean {
  return keys.every((key) => Number.isFinite(album.visualFeatures?.[key] as number));
}

function hasColorProfile(album: Album): boolean {
  const profile = album.visualFeatures?.colorProfile;
  return Boolean(
    profile &&
    Number.isFinite(profile.neutralCoverage) &&
    Number.isFinite(profile.chromaticCoverage) &&
    Number.isFinite(profile.dominantHue) &&
    Number.isFinite(profile.hueConcentration) &&
    Number.isFinite(profile.meanLightness) &&
    Number.isFinite(profile.lightnessSpread)
  );
}

function hasLayoutEvidence(album: Album): boolean {
  return hasFiniteVisualValues(album, [
    'centroidX', 'centroidY', 'foregroundRatio', 'symmetryScore', 'textRatio', 'edgeDensity',
  ]);
}

function hasMediumEvidence(album: Album): boolean {
  return hasFiniteVisualValues(album, [
    'portraitProb', 'illustrationProb', 'photographyProb', 'abstractProb', 'collageProb',
    'monochromeScore', 'saturation', 'warmCool',
  ]);
}

function hasTypographyEvidence(album: Album): boolean {
  const typography = album.visualFeatures?.typography;
  return Boolean(
    (typography?.textRatio?.available && Number.isFinite(typography.textRatio.value)) ||
    hasFiniteVisualValues(album, ['textRatio', 'textRegionCount', 'centroidX', 'centroidY'])
  );
}

function hasComplexityEvidence(album: Album): boolean {
  return hasFiniteVisualValues(album, ['visualEntropy', 'edgeDensity', 'minimalismScore']);
}

function hasVisualPairEvidence(
  queryAlbum: Album,
  candidate: Album,
  predicate: (album: Album) => boolean,
): boolean {
  return predicate(queryAlbum) && predicate(candidate);
}

function weightedAvailableScore(components: Array<{ score: number | null; weight: number }>): {
  score: number;
  coverage: number;
} {
  const totalWeight = components.reduce((sum, component) => sum + component.weight, 0);
  const available = components.filter((component) => component.score !== null && Number.isFinite(component.score));
  const availableWeight = available.reduce((sum, component) => sum + component.weight, 0);
  if (availableWeight === 0 || totalWeight === 0) return { score: 0, coverage: 0 };
  return {
    score: clamp01(available.reduce((sum, component) => sum + (component.score as number) * component.weight, 0) / availableWeight),
    coverage: clamp01(availableWeight / totalWeight),
  };
}

/**
 * Confidence describes how much trustworthy evidence supports a score. It is
 * deliberately separate from similarity: a low similarity can be a valid,
 * fully-evidenced result, while a high score with missing descriptors should
 * not be presented as reliable.
 */
export function calculateVisualEvidenceConfidence(
  queryAlbum: Album,
  candidate: Album,
  mode: SearchMode,
): number {
  const quality = Number(isReliableVisualAnalysis(queryAlbum) && isReliableVisualAnalysis(candidate));
  const visual = buildVisualMeasurements(queryAlbum, candidate);
  const requiredPalette = Number(visual.palette !== null);
  const supportingSignals = [visual.embedding, visual.medium, visual.layout, visual.typographyTexture]
    .filter((value) => value !== null).length;

  if (mode === 'music_relation') return clamp01(quality * visual.coverage);
  if (!requiredPalette || supportingSignals < 2) return 0;
  return clamp01(quality * visual.coverage);
}

export function calculateMusicEvidenceConfidence(
  queryAlbum: Album,
  candidate: Album,
  lastFmSimilarScore = 0,
): number {
  return buildMusicMeasurements(queryAlbum, candidate, lastFmSimilarScore).coverage;
}

export function calculateRecommendationConfidence(
  queryAlbum: Album,
  candidate: Album,
  mode: SearchMode,
  lastFmSimilarScore = 0,
  finalScore?: number,
): { finalConfidence: number; visualConfidence: number; musicConfidence: number } {
  const visualConfidence = calculateVisualEvidenceConfidence(queryAlbum, candidate, mode);
  const musicConfidence = calculateMusicEvidenceConfidence(queryAlbum, candidate, lastFmSimilarScore);
  const visual = buildVisualMeasurements(queryAlbum, candidate);
  const music = buildMusicMeasurements(queryAlbum, candidate, lastFmSimilarScore);
  const derivedScore = finalScore ?? (
    mode === 'art_style'
      ? visual.artStyleScore
      : mode === 'balanced'
        ? clamp01(0.70 * visual.balancedVisualScore + 0.30 * music.score)
        : music.score
  );
  const decisiveAgreement = mode === 'music_relation'
    ? music.strongestEvidence
    : visual.palette ?? 0;
  const evidenceQuality = mode === 'art_style'
    ? visualConfidence
    : mode === 'balanced'
      ? clamp01(0.70 * visualConfidence + 0.30 * musicConfidence)
      : musicConfidence;
  const agreement = Math.sqrt(clamp01(derivedScore) * clamp01(decisiveAgreement));
  const finalConfidence = evidenceQuality * agreement;

  return {
    finalConfidence: clamp01(finalConfidence),
    visualConfidence: clamp01(visualConfidence),
    musicConfidence: clamp01(musicConfidence),
  };
}

// ==========================================
// 1. EMBEDDING SIMILARITY
// ==========================================

export function calculateCosineSimilarity(vecA?: number[], vecB?: number[]): number {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0 || vecA.length !== vecB.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    const a = vecA[i];
    const b = vecB[i];
    if (isNaN(a) || isNaN(b) || !isFinite(a) || !isFinite(b)) {
      return 0;
    }
    dotProduct += a * b;
    normA += a * a;
    normB += b * b;
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  const cosine = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  const clampedCosine = Math.max(-1.0, Math.min(1.0, cosine));
  return Math.max(0.0, Math.min(1.0, (1 + clampedCosine) / 2));
}

// ==========================================
// 2. LAYOUT SIMILARITY
// ==========================================

export function calculateLayoutSimilarity(
  albumA: Album,
  albumB: Album,
  layoutSigma: number = 0.4
): number {
  const fA = albumA.visualFeatures;
  const fB = albumB.visualFeatures;

  const features = [
    { key: 'centroidX', valA: fA.centroidX, valB: fB.centroidX },
    { key: 'centroidY', valA: fA.centroidY, valB: fB.centroidY },
    { key: 'foregroundRatio', valA: fA.foregroundRatio, valB: fB.foregroundRatio },
    { key: 'symmetryScore', valA: fA.symmetryScore, valB: fB.symmetryScore },
    { key: 'textRatio', valA: fA.textRatio, valB: fB.textRatio },
    { key: 'edgeDensity', valA: fA.edgeDensity, valB: fB.edgeDensity },
  ];

  let sumSq = 0;
  let count = 0;

  for (const feat of features) {
    if (feat.valA !== undefined && feat.valB !== undefined && !isNaN(feat.valA) && !isNaN(feat.valB)) {
      const diff = feat.valA - feat.valB;
      sumSq += diff * diff;
      count++;
    }
  }

  if (count === 0) return 0.5;

  const euclideanDistance = Math.sqrt(sumSq);
  return Math.max(0, Math.min(1, Math.exp(-euclideanDistance / layoutSigma)));
}

// ==========================================
// 3. TYPOGRAPHY SIMILARITY
// ==========================================

export function calculateTypographySimilarity(albumA: Album, albumB: Album): number {
  const tA = albumA.visualFeatures?.typography;
  const tB = albumB.visualFeatures?.typography;
  const fA = albumA.visualFeatures;
  const fB = albumB.visualFeatures;

  const textRatioA = tA?.textRatio?.available ? tA.textRatio.value : fA.textRatio ?? 0.1;
  const textRatioB = tB?.textRatio?.available ? tB.textRatio.value : fB.textRatio ?? 0.1;

  const textRegionCountA = tA?.textRegionCount?.available ? tA.textRegionCount.value : fA.textRegionCount ?? 1;
  const textRegionCountB = tB?.textRegionCount?.available ? tB.textRegionCount.value : fB.textRegionCount ?? 1;

  const hasTextA = textRatioA > 0.04;
  const hasTextB = textRatioB > 0.04;

  if (!hasTextA && !hasTextB) return 1.0;
  if (hasTextA !== hasTextB) return 0.0;

  const coverageSim = Math.exp(-Math.abs(textRatioA - textRatioB) / 0.18);
  const regionCountSim = Math.exp(
    -Math.abs(Math.log(1 + textRegionCountA) - Math.log(1 + textRegionCountB)) / 0.65
  );

  const posX_A = tA?.textCentroidX?.available ? tA.textCentroidX.value : fA.centroidX ?? 0.5;
  const posY_A = tA?.textCentroidY?.available ? tA.textCentroidY.value : fA.centroidY ?? 0.5;
  const posX_B = tB?.textCentroidX?.available ? tB.textCentroidX.value : fB.centroidX ?? 0.5;
  const posY_B = tB?.textCentroidY?.available ? tB.textCentroidY.value : fB.centroidY ?? 0.5;

  const posDist = Math.sqrt((posX_A - posX_B) ** 2 + (posY_A - posY_B) ** 2);
  const positionSim = Math.exp(-posDist / 0.35);

  return Math.max(0, Math.min(1, 0.40 * coverageSim + 0.30 * regionCountSim + 0.30 * positionSim));
}

// ==========================================
// 4. COMPLEXITY & TEXTURE SIMILARITY
// ==========================================

export function calculateComplexitySimilarity(albumA: Album, albumB: Album): number {
  const fA = albumA.visualFeatures;
  const fB = albumB.visualFeatures;

  const entropyDiff = Math.abs((fA.visualEntropy ?? 0.5) - (fB.visualEntropy ?? 0.5));
  const edgeDiff = Math.abs((fA.edgeDensity ?? 0.3) - (fB.edgeDensity ?? 0.3));
  const minDiff = Math.abs((fA.minimalismScore ?? 0.5) - (fB.minimalismScore ?? 0.5));

  const entropySim = Math.max(0, 1 - entropyDiff * 1.5);
  const edgeSim = Math.max(0, 1 - edgeDiff * 1.8);
  const minSim = Math.max(0, 1 - minDiff * 1.5);

  return Math.max(0, Math.min(1, 0.4 * entropySim + 0.3 * edgeSim + 0.3 * minSim));
}

function calculateMediumSimilarity(albumA: Album, albumB: Album): number {
  const a = albumA.visualFeatures;
  const b = albumB.visualFeatures;
  const probabilities = [
    [a.portraitProb, b.portraitProb],
    [a.illustrationProb, b.illustrationProb],
    [a.photographyProb, b.photographyProb],
    [a.abstractProb, b.abstractProb],
    [a.collageProb, b.collageProb],
  ];
  const typeSimilarity = probabilities.reduce(
    (sum, [valueA, valueB]) => sum + Math.max(0, 1 - Math.abs((valueA ?? 0.5) - (valueB ?? 0.5))),
    0,
  ) / probabilities.length;
  const monochromeSimilarity = 1 - Math.abs((a.monochromeScore ?? 0.5) - (b.monochromeScore ?? 0.5));
  const saturationSimilarity = 1 - Math.abs((a.saturation ?? 0.5) - (b.saturation ?? 0.5));
  const temperatureSimilarity = 1 - Math.abs((a.warmCool ?? 0) - (b.warmCool ?? 0)) / 2;

  return Math.max(0, Math.min(1,
    0.55 * typeSimilarity +
    0.20 * monochromeSimilarity +
    0.15 * saturationSimilarity +
    0.10 * temperatureSimilarity,
  ));
}

function circularHueSimilarity(firstHue: number, secondHue: number): number {
  const difference = Math.abs(((firstHue - secondHue + 540) % 360) - 180);
  return clamp01(1 - difference / 180);
}

/**
 * Palette compatibility is stricter than raw palette transport distance. It
 * explicitly models how much meaningful chromatic content each cover has, so
 * shared black or white cannot make a colorful and monochrome cover compatible.
 */
export function calculatePaletteCompatibility(albumA: Album, albumB: Album): number {
  if (!hasPalette(albumA) || !hasPalette(albumB) || !hasColorProfile(albumA) || !hasColorProfile(albumB)) {
    return 0;
  }

  const first = albumA.visualFeatures.colorProfile!;
  const second = albumB.visualFeatures.colorProfile!;
  const transportSimilarity = calculateColorSimilarity(albumA.dominantPalette, albumB.dominantPalette);
  const chromaticCoverageSimilarity = clamp01(1 - Math.abs(first.chromaticCoverage - second.chromaticCoverage));
  const lightnessSimilarity = clamp01(
    1 - 0.70 * Math.abs(first.meanLightness - second.meanLightness) -
    0.30 * Math.abs(first.lightnessSpread - second.lightnessSpread),
  );

  const bothChromatic = first.chromaticCoverage >= 0.28 && second.chromaticCoverage >= 0.28;
  const bothNeutral = first.neutralCoverage >= 0.70 && second.neutralCoverage >= 0.70;
  const hueSimilarity = bothChromatic
    ? circularHueSimilarity(first.dominantHue, second.dominantHue)
    : bothNeutral
      ? 1
      : 0;
  const concentrationSimilarity = bothChromatic
    ? clamp01(1 - Math.abs(first.hueConcentration - second.hueConcentration))
    : bothNeutral
      ? 1
      : 0;

  let compatibility = clamp01(
    0.48 * transportSimilarity +
    0.22 * hueSimilarity +
    0.14 * chromaticCoverageSimilarity +
    0.10 * lightnessSimilarity +
    0.06 * concentrationSimilarity,
  );

  const chromaticGap = Math.abs(first.chromaticCoverage - second.chromaticCoverage);
  if (chromaticGap >= 0.35) compatibility *= 0.50;
  if (bothChromatic && hueSimilarity < 0.45) compatibility *= 0.55;
  if (!bothChromatic && !bothNeutral) compatibility *= 0.45;

  return clamp01(compatibility);
}

interface VisualMeasurements {
  palette: number | null;
  embedding: number | null;
  medium: number | null;
  layout: number | null;
  typographyTexture: number | null;
  typography: number | null;
  complexity: number | null;
  artStyleScore: number;
  balancedVisualScore: number;
  coverage: number;
}

function buildVisualMeasurements(albumA: Album, albumB: Album): VisualMeasurements {
  const palette = hasVisualPairEvidence(albumA, albumB, (album) => hasPalette(album) && hasColorProfile(album))
    ? calculatePaletteCompatibility(albumA, albumB)
    : null;
  const embedding = hasVisualPairEvidence(albumA, albumB, hasEmbedding)
    ? calculateCosineSimilarity(albumA.embedding, albumB.embedding)
    : null;
  const medium = hasVisualPairEvidence(albumA, albumB, hasMediumEvidence)
    ? calculateMediumSimilarity(albumA, albumB)
    : null;
  const layout = hasVisualPairEvidence(albumA, albumB, hasLayoutEvidence)
    ? calculateLayoutSimilarity(albumA, albumB)
    : null;
  const typography = hasVisualPairEvidence(albumA, albumB, hasTypographyEvidence)
    ? calculateTypographySimilarity(albumA, albumB)
    : null;
  const complexity = hasVisualPairEvidence(albumA, albumB, hasComplexityEvidence)
    ? calculateComplexitySimilarity(albumA, albumB)
    : null;
  const typographyTexture = weightedAvailableScore([
    { score: typography, weight: 0.5 },
    { score: complexity, weight: 0.5 },
  ]).score || (typography !== null || complexity !== null ? 0 : null);

  const artStyle = weightedAvailableScore([
    { score: palette, weight: 0.48 },
    { score: embedding, weight: 0.20 },
    { score: medium, weight: 0.14 },
    { score: layout, weight: 0.10 },
    { score: typographyTexture, weight: 0.08 },
  ]);
  const balancedVisual = weightedAvailableScore([
    { score: palette, weight: 0.40 },
    { score: embedding, weight: 0.25 },
    { score: medium, weight: 0.15 },
    { score: layout, weight: 0.10 },
    { score: typographyTexture, weight: 0.10 },
  ]);

  return {
    palette,
    embedding,
    medium,
    layout,
    typographyTexture,
    typography,
    complexity,
    artStyleScore: artStyle.score,
    balancedVisualScore: balancedVisual.score,
    coverage: artStyle.coverage,
  };
}

function weightedGeometricScore(components: Array<[number, number]>): number {
  const weightedLog = components.reduce(
    (sum, [value, weight]) => sum + weight * Math.log(Math.max(0.05, Math.min(1, value))),
    0,
  );
  return Math.max(0, Math.min(1, Math.exp(weightedLog)));
}

// ==========================================
// 5. VISUAL & ART STYLE SCORES
// ==========================================

export function calculateVisualScore(albumA: Album, albumB: Album): number {
  return buildVisualMeasurements(albumA, albumB).balancedVisualScore;
}

export function calculateArtStyleScore(albumA: Album, albumB: Album): number {
  return buildVisualMeasurements(albumA, albumB).artStyleScore;
}

// ==========================================
// 6. MUSICAL RELATIONSHIP SCORE
// ==========================================

export function calculateMusicScore(
  albumA: Album,
  albumB: Album,
  lastFmSimilarScore: number = 0.0
): number {
  return buildMusicMeasurements(albumA, albumB, lastFmSimilarScore).score;
}

interface MusicMeasurements {
  score: number;
  coverage: number;
  evidenceCount: number;
  strongestEvidence: number;
  hasStrongArtistAffinity: boolean;
  artist: number | null;
  genre: number | null;
  era: number | null;
}

function buildMusicMeasurements(
  albumA: Album,
  albumB: Album,
  lastFmSimilarScore: number = 0,
): MusicMeasurements {
  const isSameArtist =
    albumA.normalizedArtistName === albumB.normalizedArtistName ||
    (albumA.itunesArtistId && albumA.itunesArtistId === albumB.itunesArtistId);

  const artist = isSameArtist
    ? 1
    : lastFmSimilarScore > 0
      ? clamp01(lastFmSimilarScore)
      : null;

  const genreTokens = (genre: string, styles: string[] = []) =>
    new Set(
      [typeof genre === 'string' ? genre : '', ...(Array.isArray(styles) ? styles : [])]
        .filter((value): value is string => typeof value === 'string')
        .join(' ')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length > 2 && !['music', 'album'].includes(token))
    );

  const hasGenreEvidence = hasGenre(albumA) && hasGenre(albumB);
  const genresA = genreTokens(albumA.genre, albumA.styles);
  const genresB = genreTokens(albumB.genre, albumB.styles);
  const intersection = [...genresA].filter((token) => genresB.has(token)).length;
  const union = new Set([...genresA, ...genresB]).size;
  const genre = hasGenreEvidence && union ? intersection / union : null;

  const hasEraEvidence = hasReleaseYear(albumA) && hasReleaseYear(albumB);
  const yearDiff = hasEraEvidence ? Math.abs(albumA.releaseYear - albumB.releaseYear) : 0;
  const era = hasEraEvidence ? Math.exp(-yearDiff / 12.0) : null;

  const measured = weightedAvailableScore([
    { score: artist, weight: 0.60 },
    { score: genre, weight: 0.25 },
    { score: era, weight: 0.15 },
  ]);
  const availableScores = [artist, genre, era].filter((value): value is number => value !== null);

  return {
    score: measured.score,
    coverage: measured.coverage,
    evidenceCount: availableScores.length,
    strongestEvidence: availableScores.length ? Math.max(...availableScores) : 0,
    hasStrongArtistAffinity: (artist ?? 0) >= 0.70,
    artist,
    genre,
    era,
  };
}

// ==========================================
// 7. PERCEPTUAL HASH & DUPLICATE CHECKS
// ==========================================

export function calculateHammingDistance(hashA?: string, hashB?: string): number {
  if (!hashA || !hashB || hashA.length !== hashB.length) return 99;
  let count = 0;
  for (let i = 0; i < hashA.length; i++) {
    if (hashA[i] !== hashB[i]) count++;
  }
  return count;
}

// ==========================================
// 8. EVIDENCE-BASED MATCH REASON GENERATION
// ==========================================

export function generateMatchExplanation(
  query: Album,
  candidate: Album,
  visualScore: number,
  musicScore: number,
  mode: SearchMode = 'art_style',
  lastFmScore: number = 0
): { reasons: MatchReason[]; explanation: string; sharedAttrs: SharedAttribute[] } {
  const reasons: MatchReason[] = [];
  const sharedAttrs: SharedAttribute[] = [];
  const fQ = query.visualFeatures;
  const fC = candidate.visualFeatures;

  if (mode === 'art_style') {
    const paletteCompatibility = calculatePaletteCompatibility(query, candidate);
    const matchType = paletteCompatibility >= 0.82 ? 'high' : paletteCompatibility >= 0.68 ? 'medium' : 'close';
    const label = paletteCompatibility >= 0.82 ? 'Very similar color language' : 'Compatible palette and visual language';
    return {
      reasons: [{ label, category: 'color' }],
      explanation: `Visual-style match: ${Math.round(paletteCompatibility * 100)}% palette compatibility, checked alongside artwork structure, medium, and typography. Music metadata does not affect this tier.`,
      sharedAttrs: [{ name: 'Palette', value: 'Compatible dominant color profile', matchType }],
    };
  }

  if (mode === 'music_relation') {
    const music = buildMusicMeasurements(query, candidate, lastFmScore);
    const sameArtist = query.normalizedArtistName === candidate.normalizedArtistName ||
      Boolean(query.itunesArtistId && query.itunesArtistId === candidate.itunesArtistId);
    if (music.artist !== null) {
      reasons.push({ label: sameArtist ? 'Another release by the same artist' : 'Related artist', category: 'music' });
      sharedAttrs.push({
        name: 'Artist affinity',
        value: sameArtist ? 'Shared artist' : 'Verified artist relationship',
        matchType: music.artist >= 0.7 ? 'high' : 'medium',
      });
    }
    if (music.genre !== null && music.genre > 0) {
      reasons.push({ label: `Shared ${query.genre} genre/style`, category: 'music' });
      sharedAttrs.push({ name: 'Genre', value: query.genre, matchType: 'high' });
    }
    const yearDistance = Math.abs((query.releaseYear || 0) - (candidate.releaseYear || 0));
    if (music.era !== null && yearDistance <= 8) {
      reasons.push({ label: 'Close release era', category: 'music' });
      sharedAttrs.push({ name: 'Era', value: `${candidate.releaseYear}`, matchType: yearDistance <= 3 ? 'high' : 'close' });
    }
    return {
      reasons: reasons.slice(0, 3),
      explanation: `${candidate.artistName} is connected through measured artist, genre/style, and release-era evidence, with a ${Math.round(
        musicScore * 100
      )}% music-relation score. Artwork is shown for context and does not affect this tier's ranking.`,
      sharedAttrs,
    };
  }

  // 1. Color check
  const colorSim = calculatePaletteCompatibility(query, candidate);
  if (colorSim > 0.72) {
    if (fQ.monochromeScore > 0.6 && fC.monochromeScore > 0.6) {
      reasons.push({ label: 'Similar monochrome treatment', category: 'color' });
      sharedAttrs.push({ name: 'Palette', value: 'Dark Monochrome', matchType: 'high' });
    } else if (fQ.warmCool > 0.3 && fC.warmCool > 0.3) {
      reasons.push({ label: 'Similar muted palette', category: 'color' });
      sharedAttrs.push({ name: 'Palette', value: 'Warm Earth Tones', matchType: 'high' });
    } else if (fQ.warmCool < -0.3 && fC.warmCool < -0.3) {
      reasons.push({ label: 'Cool blue-gray tones', category: 'color' });
      sharedAttrs.push({ name: 'Palette', value: 'Cool Oceanic', matchType: 'high' });
    } else {
      reasons.push({ label: 'Similar color palette', category: 'color' });
      sharedAttrs.push({ name: 'Palette', value: 'Harmonious Tones', matchType: 'medium' });
    }
  }

  // 2. Composition / Layout check
  const layoutSim = calculateLayoutSimilarity(query, candidate);
  if (layoutSim > 0.75) {
    if (fQ.portraitProb > 0.5 && fC.portraitProb > 0.5) {
      reasons.push({ label: 'Centered portrait composition', category: 'layout' });
      sharedAttrs.push({ name: 'Subject', value: 'Centered Human Portrait', matchType: 'high' });
    } else if (fQ.minimalismScore > 0.65 && fC.minimalismScore > 0.65) {
      reasons.push({ label: 'Comparable negative space', category: 'layout' });
      sharedAttrs.push({ name: 'Composition', value: 'Generous Negative Space', matchType: 'high' });
    } else if (fQ.symmetryScore > 0.7 && fC.symmetryScore > 0.7) {
      reasons.push({ label: 'Symmetrical alignment', category: 'layout' });
      sharedAttrs.push({ name: 'Structure', value: 'Centered Symmetry', matchType: 'medium' });
    } else {
      reasons.push({ label: 'Comparable negative space', category: 'layout' });
    }
  }

  // 3. Style / Texture check
  if (fQ.illustrationProb > 0.5 && fC.illustrationProb > 0.5) {
    reasons.push({ label: 'Hand-drawn illustration', category: 'mood' });
    sharedAttrs.push({ name: 'Medium', value: 'Graphic Illustration', matchType: 'high' });
  } else if (fQ.photographyProb > 0.5 && fC.photographyProb > 0.5) {
    reasons.push({ label: 'Comparable grain and texture', category: 'texture' });
    sharedAttrs.push({ name: 'Medium', value: 'Grainy Photography', matchType: 'medium' });
  } else if (fQ.abstractProb > 0.5 && fC.abstractProb > 0.5) {
    reasons.push({ label: 'Geometric abstraction', category: 'mood' });
    sharedAttrs.push({ name: 'Style', value: 'Abstract Form', matchType: 'high' });
  } else if (fQ.collageProb > 0.5 && fC.collageProb > 0.5) {
    reasons.push({ label: 'Collage-like composition', category: 'layout' });
    sharedAttrs.push({ name: 'Style', value: 'Layered Collage', matchType: 'high' });
  }

  // 4. Typography check
  if (fQ.textRatio > 0.20 && fC.textRatio > 0.20) {
    reasons.push({ label: 'Prominent typography', category: 'typography' });
    sharedAttrs.push({ name: 'Typography', value: 'Prominent Text Treatment', matchType: 'medium' });
  } else if (fQ.textRatio <= 0.04 && fC.textRatio <= 0.04) {
    reasons.push({ label: 'Both omit prominent typography', category: 'typography' });
    sharedAttrs.push({ name: 'Typography', value: 'Text-Free Artwork', matchType: 'high' });
  }

  if (reasons.length === 0 || sharedAttrs.length === 0) {
    return {
      reasons: [],
      explanation: 'No qualifying measured visual attributes were available for this comparison.',
      sharedAttrs: [],
    };
  }

  const topReasons = reasons.map((r) => r.label.toLowerCase());
  let explanationStr = `Both covers share a `;
  if (topReasons.length >= 2) {
    explanationStr += `${topReasons[0]} and ${topReasons[1]}, creating a cohesive visual language.`;
  } else {
    explanationStr += `${topReasons[0] || 'similar visual aesthetic'} with comparable framing and tonal balance.`;
  }

  if (query.genre === candidate.genre) {
    explanationStr += ` Connected within the ${query.genre} visual tradition.`;
  }

  return {
    reasons: reasons.slice(0, 3),
    explanation: explanationStr,
    sharedAttrs,
  };
}

// ==========================================
// 9. CANDIDATE RANKING & DIVERSITY (MMR)
// ==========================================

export function rankSimilarAlbums(
  queryAlbum: Album,
  candidates: Album[],
  mode: SearchMode = 'art_style',
  lastFmSimilarScores: Record<number, number> = {},
  limit: number = 18,
  allowMultipleArtistAlbums: boolean = false
): SimilarityResult[] {
  // Exclude source identity, duplicate artwork, and visual records that do not
  // meet the verified data contract. Music Relation deliberately keeps distinct
  // releases by the same artist because that is meaningful music evidence.
  const filteredCandidates = candidates.filter((c) => {
    if (c.itunesCollectionId === queryAlbum.itunesCollectionId) return false;
    const isSameArtist =
      c.normalizedArtistName === queryAlbum.normalizedArtistName ||
      (queryAlbum.itunesArtistId && c.itunesArtistId === queryAlbum.itunesArtistId);
    if (mode !== 'music_relation' && isSameArtist) {
      return false;
    }
    if (c.visualAnalysisStatus === 'failed') return false;
    if (mode !== 'music_relation' && (!isReliableVisualAnalysis(queryAlbum) || !isReliableVisualAnalysis(c))) return false;
    if (c.artworkUrl && c.artworkUrl === queryAlbum.artworkUrl) return false;
    const sameTitle = c.normalizedTitle === queryAlbum.normalizedTitle;
    if (sameTitle && calculateHammingDistance(c.perceptualHash, queryAlbum.perceptualHash) <= 8) return false;
    return true;
  });

  const scoredItems: SimilarityResult[] = [];

  for (const candidate of filteredCandidates) {
    const visual = buildVisualMeasurements(queryAlbum, candidate);
    const lastFmSim = lastFmSimilarScores[candidate.itunesCollectionId] || 0.0;
    const music = buildMusicMeasurements(queryAlbum, candidate, lastFmSim);
    const visualSupportingSignals = [visual.embedding, visual.medium, visual.layout, visual.typographyTexture]
      .filter((value) => value !== null).length;
    const hasRequiredVisualEvidence = visual.palette !== null && visualSupportingSignals >= 2;
    const visualScore = visual.balancedVisualScore;
    const artStyleScore = visual.artStyleScore;
    const musicScore = music.score;
    const finalScore =
      mode === 'art_style'
        ? artStyleScore
        : mode === 'balanced'
        ? 0.70 * visualScore + 0.30 * musicScore
        : musicScore;

    const passesVisualEligibility = mode === 'art_style'
      ? hasRequiredVisualEvidence &&
        (visual.palette ?? 0) >= MIN_ART_STYLE_PALETTE_COMPATIBILITY &&
        finalScore >= MIN_ART_STYLE_SCORE
      : mode === 'balanced'
        ? hasRequiredVisualEvidence &&
          (visual.palette ?? 0) >= MIN_BALANCED_PALETTE_COMPATIBILITY &&
          finalScore >= MIN_BALANCED_SCORE
        : true;
    const passesMusicEligibility = mode !== 'music_relation' ||
      music.evidenceCount >= 2 || music.hasStrongArtistAffinity;
    if (!passesVisualEligibility || !passesMusicEligibility) continue;

    const { reasons, explanation, sharedAttrs } = generateMatchExplanation(
      queryAlbum,
      candidate,
      visualScore,
      musicScore,
      mode,
      lastFmSim
    );
    if (sharedAttrs.length === 0) continue;
    const confidence = calculateRecommendationConfidence(queryAlbum, candidate, mode, lastFmSim, finalScore);
    if (!isRecommendationConfidenceEligible(confidence.finalConfidence)) continue;

    scoredItems.push({
      album: candidate,
      finalScore: Math.max(0, Math.min(1, finalScore)),
      finalConfidence: confidence.finalConfidence,
      visualScore: mode === 'art_style' ? artStyleScore : visualScore,
      visualConfidence: confidence.visualConfidence,
      musicScore,
      musicConfidence: confidence.musicConfidence,
      componentScores: {
        embedding: mode === 'music_relation' ? null : visual.embedding,
        color: mode === 'music_relation' ? null : visual.palette,
        layout: mode === 'music_relation' ? null : visual.layout,
        typography: mode === 'music_relation' ? null : visual.typography,
        complexity: mode === 'music_relation' ? null : visual.complexity,
        medium: mode === 'music_relation' ? null : visual.medium,
      },
      matchReasons: reasons,
      explanation,
      sharedAttributes: sharedAttrs,
      paletteComparison: {
        query: (queryAlbum.dominantPalette || []).map((p) => p.hex),
        candidate: (candidate.dominantPalette || []).map((p) => p.hex),
      },
    });
  }

  scoredItems.sort((a, b) => b.finalScore - a.finalScore || a.album.itunesCollectionId - b.album.itunesCollectionId);

  // Maximum Marginal Relevance (MMR)
  const selected: SimilarityResult[] = [];
  const artistCounts: Record<string, number> = {};
  const lambda = mode === 'art_style' ? 0.82 : mode === 'balanced' ? 0.80 : 0.85;
  const pool = [...scoredItems];

  const maxAllowedPerArtist = allowMultipleArtistAlbums ? 3 : mode === 'music_relation' ? 2 : 1;

  while (pool.length > 0 && selected.length < limit) {
    let bestCandidateIdx = -1;
    let maxMMRScore = -Infinity;

    for (let i = 0; i < pool.length; i++) {
      const item = pool[i];
      const artist = item.album.normalizedArtistName;

      if ((artistCounts[artist] || 0) >= maxAllowedPerArtist) {
        continue;
      }

      let maxSimToSelected = 0;
      for (const sel of selected) {
        const sim = mode === 'art_style'
          ? calculateArtStyleScore(item.album, sel.album)
          : mode === 'balanced'
            ? calculateVisualScore(item.album, sel.album)
            : calculateMusicScore(item.album, sel.album);
        if (sim > maxSimToSelected) maxSimToSelected = sim;
      }

      const mmrScore = lambda * item.finalScore - (1 - lambda) * maxSimToSelected;

      if (mmrScore > maxMMRScore) {
        maxMMRScore = mmrScore;
        bestCandidateIdx = i;
      }
    }

    if (bestCandidateIdx === -1) break;

    const chosen = pool.splice(bestCandidateIdx, 1)[0];
    const artist = chosen.album.normalizedArtistName;
    artistCounts[artist] = (artistCounts[artist] || 0) + 1;
    selected.push(chosen);
  }

  return selected;
}

export function rankDistinctRecommendationTiers(
  queryAlbum: Album,
  candidates: Album[],
  lastFmSimilarScores: Record<number, number> = {},
  limit: number = 18
): RecommendationTiers {
  return {
    art_style: rankSimilarAlbums(queryAlbum, candidates, 'art_style', lastFmSimilarScores, limit),
    balanced: rankSimilarAlbums(queryAlbum, candidates, 'balanced', lastFmSimilarScores, limit),
    music_relation: rankSimilarAlbums(queryAlbum, candidates, 'music_relation', lastFmSimilarScores, limit),
  };
}
