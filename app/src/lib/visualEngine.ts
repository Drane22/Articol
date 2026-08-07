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
  return Boolean(album.genre?.trim());
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
  if (mode === 'art_style') {
    return hasPalette(queryAlbum) && hasPalette(candidate) ? 1 : 0;
  }

  const signals = [
    isReliableVisualAnalysis(queryAlbum),
    isReliableVisualAnalysis(candidate),
    hasPalette(queryAlbum),
    hasPalette(candidate),
  ];

  if (mode === 'balanced') {
    signals.push(hasEmbedding(queryAlbum), hasEmbedding(candidate));
  }

  return signals.filter(Boolean).length / signals.length;
}

export function calculateMusicEvidenceConfidence(
  queryAlbum: Album,
  candidate: Album,
  lastFmSimilarScore = 0,
): number {
  const genreEvidence = hasGenre(queryAlbum) && hasGenre(candidate);
  const eraEvidence = hasReleaseYear(queryAlbum) && hasReleaseYear(candidate);
  const lastFmEvidence = clamp01(lastFmSimilarScore);

  return (Number(genreEvidence) + Number(eraEvidence) + lastFmEvidence) / 3;
}

export function calculateRecommendationConfidence(
  queryAlbum: Album,
  candidate: Album,
  mode: SearchMode,
  lastFmSimilarScore = 0,
): { finalConfidence: number; visualConfidence: number; musicConfidence: number } {
  const visualConfidence = calculateVisualEvidenceConfidence(queryAlbum, candidate, mode);
  const musicConfidence = calculateMusicEvidenceConfidence(queryAlbum, candidate, lastFmSimilarScore);
  const paletteConfidence = hasPalette(queryAlbum) && hasPalette(candidate) ? 1 : 0;

  const finalConfidence = mode === 'art_style'
    ? visualConfidence
    : mode === 'balanced'
      ? 0.70 * visualConfidence + 0.30 * musicConfidence
      : 0.75 * musicConfidence + 0.15 * visualConfidence + 0.10 * paletteConfidence;

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
  const embeddingSim = albumA.embedding && albumB.embedding
    ? calculateCosineSimilarity(albumA.embedding, albumB.embedding)
    : 0;

  const colorSim = calculateColorSimilarity(
    albumA.dominantPalette || [],
    albumB.dominantPalette || []
  );

  const layoutSim = calculateLayoutSimilarity(albumA, albumB);
  const typographySim = calculateTypographySimilarity(albumA, albumB);
  const complexitySim = calculateComplexitySimilarity(albumA, albumB);
  const mediumSim = calculateMediumSimilarity(albumA, albumB);

  return weightedGeometricScore([
    [embeddingSim, 0.38],
    [colorSim, 0.24],
    [layoutSim, 0.18],
    [mediumSim, 0.12],
    [typographySim, 0.04],
    [complexitySim, 0.04],
  ]);
}

export function calculateArtStyleScore(albumA: Album, albumB: Album): number {
  // Art Style is intentionally palette-only. Layout, embeddings, typography,
  // genre, artist, and release year belong to the other recommendation modes.
  return calculateColorSimilarity(albumA.dominantPalette || [], albumB.dominantPalette || []);
}

// ==========================================
// 6. MUSICAL RELATIONSHIP SCORE
// ==========================================

export function calculateMusicScore(
  albumA: Album,
  albumB: Album,
  lastFmSimilarScore: number = 0.0
): number {
  const isSameArtist =
    albumA.normalizedArtistName === albumB.normalizedArtistName ||
    (albumA.itunesArtistId && albumA.itunesArtistId === albumB.itunesArtistId);

  const artistSim = isSameArtist ? 1.0 : Math.max(0, Math.min(1, lastFmSimilarScore));

  const genreTokens = (genre: string, styles: string[] = []) =>
    new Set(
      [genre, ...styles]
        .join(' ')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length > 2 && !['music', 'album'].includes(token))
    );

  const genresA = genreTokens(albumA.genre, albumA.styles);
  const genresB = genreTokens(albumB.genre, albumB.styles);
  const intersection = [...genresA].filter((token) => genresB.has(token)).length;
  const union = new Set([...genresA, ...genresB]).size;
  const genreSim = union ? intersection / union : 0;

  const yearA = albumA.releaseYear || (albumA.releaseDate ? parseInt(albumA.releaseDate.slice(0, 4)) : 2000);
  const yearB = albumB.releaseYear || (albumB.releaseDate ? parseInt(albumB.releaseDate.slice(0, 4)) : 2000);
  const yearDiff = Math.abs(yearA - yearB);
  const releaseEraSim = Math.exp(-yearDiff / 12.0);

  if (artistSim > 0) {
    return Math.max(0, Math.min(1, 0.55 * artistSim + 0.30 * genreSim + 0.15 * releaseEraSim));
  }
  return Math.max(0, Math.min(1, (0.70 * genreSim + 0.30 * releaseEraSim) * 0.72));
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
    const colorSim = calculateColorSimilarity(query.dominantPalette || [], candidate.dominantPalette || []);
    const matchType = colorSim >= 0.78 ? 'high' : colorSim >= 0.58 ? 'medium' : 'close';
    const label = colorSim >= 0.78 ? 'Very similar palette' : 'Related color palette';
    return {
      reasons: [{ label, category: 'color' }],
      explanation: `Palette-only match: ${Math.round(colorSim * 100)}% color similarity. Music and composition do not affect Art Style ranking.`,
      sharedAttrs: [{ name: 'Palette', value: 'Dominant color distribution', matchType }],
    };
  }

  if (mode === 'music_relation') {
    if (lastFmScore > 0) {
      reasons.push({ label: 'Related artist', category: 'music' });
      sharedAttrs.push({
        name: 'Artist affinity',
        value: 'Last.fm relationship',
        matchType: lastFmScore >= 0.7 ? 'high' : 'medium',
      });
    }
    if (query.genre.toLowerCase() === candidate.genre.toLowerCase()) {
      reasons.push({ label: `Shared ${query.genre} genre`, category: 'music' });
      sharedAttrs.push({ name: 'Genre', value: query.genre, matchType: 'high' });
    }
    const yearDistance = Math.abs((query.releaseYear || 2000) - (candidate.releaseYear || 2000));
    if (yearDistance <= 8) {
      reasons.push({ label: 'Close release era', category: 'music' });
      sharedAttrs.push({ name: 'Era', value: `${candidate.releaseYear}`, matchType: yearDistance <= 3 ? 'high' : 'close' });
    }
    if (!reasons.length) reasons.push({ label: 'Metadata music relation', category: 'music' });
    return {
      reasons: reasons.slice(0, 3),
      explanation: `${candidate.artistName} is connected through musical metadata and artist affinity, with a ${Math.round(
        musicScore * 100
      )}% music-relation score. Artwork is shown for context but does not affect this tier's ranking.`,
      sharedAttrs,
    };
  }

  // 1. Color check
  const colorSim = calculateColorSimilarity(query.dominantPalette || [], candidate.dominantPalette || []);
  if (colorSim > 0.78) {
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

  if (reasons.length === 0) {
    reasons.push({ label: 'Comparable overall visual mood', category: 'mood' });
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
  // Exclude duplicate album collection ID, identical artist name/id, failed analysis status, identical artwork URL/perceptual hash
  const filteredCandidates = candidates.filter((c) => {
    if (c.itunesCollectionId === queryAlbum.itunesCollectionId) return false;
    if (
      c.normalizedArtistName === queryAlbum.normalizedArtistName ||
      (queryAlbum.itunesArtistId && c.itunesArtistId === queryAlbum.itunesArtistId)
    ) {
      return false;
    }
    if (c.visualAnalysisStatus === 'failed') return false;
    if (mode !== 'music_relation' && !isReliableVisualAnalysis(c)) return false;
    if (c.artworkUrl && c.artworkUrl === queryAlbum.artworkUrl) return false;
    const sameTitle = c.normalizedTitle === queryAlbum.normalizedTitle;
    if (sameTitle && calculateHammingDistance(c.perceptualHash, queryAlbum.perceptualHash) <= 8) return false;
    return true;
  });

  const scoredItems: SimilarityResult[] = [];

  for (const candidate of filteredCandidates) {
    const visualScore = calculateVisualScore(queryAlbum, candidate);
    const artStyleScore = calculateArtStyleScore(queryAlbum, candidate);
    const lastFmSim = lastFmSimilarScores[candidate.itunesCollectionId] || 0.0;
    const musicScore = calculateMusicScore(queryAlbum, candidate, lastFmSim);

    const colorScore = calculateColorSimilarity(queryAlbum.dominantPalette || [], candidate.dominantPalette || []);
    const finalScore =
      mode === 'art_style'
        ? artStyleScore
        : mode === 'balanced'
        ? 0.70 * visualScore + 0.30 * musicScore
        : 0.75 * musicScore + 0.15 * visualScore + 0.10 * colorScore;

    const { reasons, explanation, sharedAttrs } = generateMatchExplanation(
      queryAlbum,
      candidate,
      visualScore,
      musicScore,
      mode,
      lastFmSim
    );
    const confidence = calculateRecommendationConfidence(queryAlbum, candidate, mode, lastFmSim);

    scoredItems.push({
      album: candidate,
      finalScore: Math.max(0, Math.min(1, finalScore)),
      finalConfidence: confidence.finalConfidence,
      visualScore: mode === 'art_style' ? artStyleScore : visualScore,
      visualConfidence: confidence.visualConfidence,
      musicScore,
      musicConfidence: confidence.musicConfidence,
      componentScores: {
        embedding: mode === 'art_style' ? null : calculateCosineSimilarity(queryAlbum.embedding, candidate.embedding),
        color: colorScore,
        layout: mode === 'art_style' ? null : calculateLayoutSimilarity(queryAlbum, candidate),
        typography: mode === 'art_style' ? null : calculateTypographySimilarity(queryAlbum, candidate),
        complexity: mode === 'art_style' ? null : calculateComplexitySimilarity(queryAlbum, candidate),
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
  const lambda = mode === 'art_style' ? 0.86 : mode === 'balanced' ? 0.80 : 0.90;
  const pool = scoredItems.filter((item) => isRecommendationConfidenceEligible(item.finalConfidence));

  const maxAllowedPerArtist = allowMultipleArtistAlbums ? 3 : 1;

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
          ? calculateColorSimilarity(item.album.dominantPalette || [], sel.album.dominantPalette || [])
          : calculateCosineSimilarity(item.album.embedding, sel.album.embedding);
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
