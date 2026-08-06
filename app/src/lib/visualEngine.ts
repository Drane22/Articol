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

  return Math.max(
    0,
    Math.min(
      1,
      0.56 * embeddingSim +
      0.16 * colorSim +
      0.11 * layoutSim +
      0.09 * typographySim +
      0.08 * complexitySim
    )
  );
}

export function calculateArtStyleScore(albumA: Album, albumB: Album): number {
  const embeddingSim = albumA.embedding && albumB.embedding
    ? calculateCosineSimilarity(albumA.embedding, albumB.embedding)
    : 0;
  const colorSim = calculateColorSimilarity(albumA.dominantPalette || [], albumB.dominantPalette || []);
  const layoutSim = calculateLayoutSimilarity(albumA, albumB);
  const typographySim = calculateTypographySimilarity(albumA, albumB);
  const complexitySim = calculateComplexitySimilarity(albumA, albumB);

  let score = (
    0.62 * embeddingSim +
    0.15 * colorSim +
    0.10 * layoutSim +
    0.07 * typographySim +
    0.06 * complexitySim
  );

  if (colorSim < 0.12 && embeddingSim < 0.45 && layoutSim < 0.40) {
    score *= 0.88;
  }

  return Math.max(0, Math.min(1, score));
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

    const finalScore =
      mode === 'art_style'
        ? artStyleScore
        : mode === 'balanced'
        ? 0.60 * visualScore + 0.40 * musicScore
        : musicScore;

    const { reasons, explanation, sharedAttrs } = generateMatchExplanation(
      queryAlbum,
      candidate,
      visualScore,
      musicScore,
      mode,
      lastFmSim
    );

    scoredItems.push({
      album: candidate,
      finalScore: Math.max(0, Math.min(1, finalScore)),
      finalConfidence: 1.0,
      visualScore,
      visualConfidence: 1.0,
      musicScore,
      musicConfidence: lastFmSim > 0 ? 0.9 : 0.5,
      componentScores: {
        embedding: calculateCosineSimilarity(queryAlbum.embedding, candidate.embedding),
        color: calculateColorSimilarity(queryAlbum.dominantPalette || [], candidate.dominantPalette || []),
        layout: calculateLayoutSimilarity(queryAlbum, candidate),
        typography: calculateTypographySimilarity(queryAlbum, candidate),
        complexity: calculateComplexitySimilarity(queryAlbum, candidate),
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

  scoredItems.sort((a, b) => b.finalScore - a.finalScore);

  // Maximum Marginal Relevance (MMR)
  const selected: SimilarityResult[] = [];
  const artistCounts: Record<string, number> = {};
  const lambda = mode === 'art_style' ? 0.86 : mode === 'balanced' ? 0.80 : 0.90;
  const pool = [...scoredItems];

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
        const sim = calculateCosineSimilarity(item.album.embedding, sel.album.embedding);
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
  const artStyle = rankSimilarAlbums(queryAlbum, candidates, 'art_style', lastFmSimilarScores, limit);
  const leadingArtIds = new Set(artStyle.map((result) => result.album.itunesCollectionId));

  const balancedCandidates = candidates.filter((candidate) => !leadingArtIds.has(candidate.itunesCollectionId));
  let balanced = rankSimilarAlbums(queryAlbum, balancedCandidates, 'balanced', lastFmSimilarScores, limit);

  if (balanced.length < limit && candidates.length > artStyle.length) {
    const balancedIds = new Set(balanced.map((r) => r.album.itunesCollectionId));
    const extraBalanced = rankSimilarAlbums(
      queryAlbum,
      candidates.filter(
        (c) => !leadingArtIds.has(c.itunesCollectionId) && !balancedIds.has(c.itunesCollectionId)
      ),
      'balanced',
      lastFmSimilarScores,
      limit - balanced.length
    );
    balanced = [...balanced, ...extraBalanced];
  }

  const leadingBalancedIds = new Set(balanced.map((result) => result.album.itunesCollectionId));

  const musicCandidates = candidates.filter(
    (candidate) =>
      !leadingArtIds.has(candidate.itunesCollectionId) &&
      !leadingBalancedIds.has(candidate.itunesCollectionId)
  );
  let musicRelation = rankSimilarAlbums(queryAlbum, musicCandidates, 'music_relation', lastFmSimilarScores, limit);

  if (musicRelation.length < limit) {
    const musicIds = new Set(musicRelation.map((r) => r.album.itunesCollectionId));
    const extraMusic = rankSimilarAlbums(
      queryAlbum,
      candidates.filter(
        (c) => !musicIds.has(c.itunesCollectionId) && !leadingArtIds.has(c.itunesCollectionId)
      ),
      'music_relation',
      lastFmSimilarScores,
      limit - musicRelation.length
    );
    musicRelation = [...musicRelation, ...extraMusic];
  }

  return { art_style: artStyle, balanced, music_relation: musicRelation };
}
