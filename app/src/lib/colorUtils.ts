import { DominantColor } from './types';
import { MAX_PALETTE_COLORS } from './palette';

// Convert HEX string to RGB [r, g, b]
export function hexToRgb(hex: string): [number, number, number] {
  let cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map(c => c + c).join('');
  }
  const num = parseInt(cleanHex, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

// Convert RGB to CIELAB [L*, a*, b*]
export function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  let rNorm = r / 255;
  let gNorm = g / 255;
  let bNorm = b / 255;

  rNorm = rNorm > 0.04045 ? Math.pow((rNorm + 0.055) / 1.055, 2.4) : rNorm / 12.92;
  gNorm = gNorm > 0.04045 ? Math.pow((gNorm + 0.055) / 1.055, 2.4) : gNorm / 12.92;
  bNorm = bNorm > 0.04045 ? Math.pow((bNorm + 0.055) / 1.055, 2.4) : bNorm / 12.92;

  // D65 Standard Illuminant
  let x = (rNorm * 0.4124 + gNorm * 0.3576 + bNorm * 0.1805) / 0.95047;
  let y = (rNorm * 0.2126 + gNorm * 0.7152 + bNorm * 0.0722) / 1.00000;
  let z = (rNorm * 0.0193 + gNorm * 0.1192 + bNorm * 0.9505) / 1.08883;

  x = x > 0.008856 ? Math.pow(x, 1 / 3) : 7.787 * x + 16 / 116;
  y = y > 0.008856 ? Math.pow(y, 1 / 3) : 7.787 * y + 16 / 116;
  z = z > 0.008856 ? Math.pow(z, 1 / 3) : 7.787 * z + 16 / 116;

  const L = 116 * y - 16;
  const a = 500 * (x - y);
  const bVal = 200 * (y - z);

  return [L, a, bVal];
}

// Convert RGB to HEX
export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = Math.round(Math.max(0, Math.min(255, x))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

// CIEDE2000 Perceptual Color Difference calculation
export function ciede2000(lab1: [number, number, number], lab2: [number, number, number]): number {
  const [L1, a1, b1] = lab1;
  const [L2, a2, b2] = lab2;

  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const Cbar = (C1 + C2) / 2;

  const G = 0.5 * (1 - Math.sqrt(Math.pow(Cbar, 7) / (Math.pow(Cbar, 7) + Math.pow(25, 7))));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;

  const C1p = Math.sqrt(a1p * a1p + b1 * b1);
  const C2p = Math.sqrt(a2p * a2p + b2 * b2);

  const h1p = Math.atan2(b1, a1p) >= 0 ? Math.atan2(b1, a1p) * (180 / Math.PI) : Math.atan2(b1, a1p) * (180 / Math.PI) + 360;
  const h2p = Math.atan2(b2, a2p) >= 0 ? Math.atan2(b2, a2p) * (180 / Math.PI) : Math.atan2(b2, a2p) * (180 / Math.PI) + 360;

  const dLp = L2 - L1;
  const dCp = C2p - C1p;

  let dhp = 0;
  if (C1p * C2p !== 0) {
    if (Math.abs(h2p - h1p) <= 180) {
      dhp = h2p - h1p;
    } else if (h2p - h1p > 180) {
      dhp = h2p - h1p - 360;
    } else {
      dhp = h2p - h1p + 360;
    }
  }

  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * (Math.PI / 180));

  const Lbarp = (L1 + L2) / 2;
  const Cbarp = (C1p + C2p) / 2;

  let hbarp = 0;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) <= 180) {
      hbarp = (h1p + h2p) / 2;
    } else if (h1p + h2p < 360) {
      hbarp = (h1p + h2p + 360) / 2;
    } else {
      hbarp = (h1p + h2p - 360) / 2;
    }
  }

  const T = 1 - 0.17 * Math.cos((hbarp - 30) * (Math.PI / 180)) +
    0.24 * Math.cos((2 * hbarp) * (Math.PI / 180)) +
    0.32 * Math.cos((3 * hbarp + 6) * (Math.PI / 180)) -
    0.20 * Math.cos((4 * hbarp - 63) * (Math.PI / 180));

  const dTheta = 30 * Math.exp(-Math.pow((hbarp - 275) / 25, 2));
  const RC = 2 * Math.sqrt(Math.pow(Cbarp, 7) / (Math.pow(Cbarp, 7) + Math.pow(25, 7)));
  const SL = 1 + (0.015 * Math.pow(Lbarp - 50, 2)) / Math.sqrt(20 + Math.pow(Lbarp - 50, 2));
  const SC = 1 + 0.045 * Cbarp;
  const SH = 1 + 0.015 * Cbarp * T;
  const RT = -Math.sin((2 * dTheta) * (Math.PI / 180)) * RC;

  const dE = Math.sqrt(
    Math.pow(dLp / SL, 2) +
    Math.pow(dCp / SC, 2) +
    Math.pow(dHp / SH, 2) +
    RT * (dCp / SC) * (dHp / SH)
  );

  return dE;
}

// Calculate CIELAB distance using CIEDE2000
export function cielabDistance(lab1: [number, number, number], lab2: [number, number, number]): number {
  return ciede2000(lab1, lab2);
}

type WeightedPaletteColor = {
  color: DominantColor;
  weight: number;
};

function normalizePalette(palette: DominantColor[]): WeightedPaletteColor[] {
  const validColors = palette.filter((color) => (
    Array.isArray(color.lab) &&
    color.lab.length === 3 &&
    color.lab.every((value) => Number.isFinite(value))
  ));

  if (!validColors.length) return [];

  const rawWeights = validColors.map((color) => (
    Number.isFinite(color.weight) && color.weight > 0 ? color.weight : 1
  ));
  const totalWeight = rawWeights.reduce((sum, weight) => sum + weight, 0);

  return validColors.map((color, index) => ({
    color,
    weight: rawWeights[index] / totalWeight,
  }));
}

/**
 * Compare the full weighted palettes rather than matching each swatch to its
 * nearest neighbour. The old directional-nearest metric double-counted easy
 * matches (especially black) and ignored the cost of transporting the rest
 * of the palette. This greedy transport keeps every swatch's weight in play.
 */
function calculatePaletteTransportDistance(
  palette1: WeightedPaletteColor[],
  palette2: WeightedPaletteColor[],
): number {
  const source = palette1.map(({ color, weight }) => ({ lab: color.lab, remaining: weight }));
  const target = palette2.map(({ color, weight }) => ({ lab: color.lab, remaining: weight }));
  let totalDistance = 0;
  let transportedWeight = 0;

  while (transportedWeight < 1 - 1e-9) {
    let bestSource = -1;
    let bestTarget = -1;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let sourceIndex = 0; sourceIndex < source.length; sourceIndex += 1) {
      if (source[sourceIndex].remaining <= 1e-9) continue;
      for (let targetIndex = 0; targetIndex < target.length; targetIndex += 1) {
        if (target[targetIndex].remaining <= 1e-9) continue;
        const distance = cielabDistance(source[sourceIndex].lab, target[targetIndex].lab);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestSource = sourceIndex;
          bestTarget = targetIndex;
        }
      }
    }

    if (bestSource === -1 || bestTarget === -1) break;

    const flow = Math.min(source[bestSource].remaining, target[bestTarget].remaining);
    totalDistance += bestDistance * flow;
    source[bestSource].remaining -= flow;
    target[bestTarget].remaining -= flow;
    transportedWeight += flow;
  }

  return transportedWeight > 0 ? totalDistance / transportedWeight : 50;
}

// Earth Mover's Distance calculation between two dominant palettes.
export function calculatePaletteDistance(palette1: DominantColor[], palette2: DominantColor[]): number {
  const normalizedPalette1 = normalizePalette(palette1);
  const normalizedPalette2 = normalizePalette(palette2);
  if (!normalizedPalette1.length || !normalizedPalette2.length) return 50.0;

  return calculatePaletteTransportDistance(normalizedPalette1, normalizedPalette2);
}

function calculateRankDistance(
  palette1: WeightedPaletteColor[],
  palette2: WeightedPaletteColor[],
  rankCount: number = MAX_PALETTE_COLORS,
): number {
  const ranked1 = [...palette1].sort((a, b) => b.weight - a.weight).slice(0, rankCount);
  const ranked2 = [...palette2].sort((a, b) => b.weight - a.weight).slice(0, rankCount);
  const count = Math.min(ranked1.length, ranked2.length);
  if (!count) return 50;

  let weightedDistance = 0;
  let totalWeight = 0;
  for (let index = 0; index < count; index += 1) {
    const rankWeight = (ranked1[index].weight + ranked2[index].weight) / 2;
    weightedDistance += cielabDistance(ranked1[index].color.lab, ranked2[index].color.lab) * rankWeight;
    totalWeight += rankWeight;
  }

  return totalWeight > 0 ? weightedDistance / totalWeight : 50;
}

// Calculate color similarity score normalized from 0 to 1.
export function calculateColorSimilarity(palette1: DominantColor[], palette2: DominantColor[], sigma: number = 16.0): number {
  const normalizedPalette1 = normalizePalette(palette1);
  const normalizedPalette2 = normalizePalette(palette2);
  if (!normalizedPalette1.length || !normalizedPalette2.length) return 0;

  const distance = calculatePaletteTransportDistance(normalizedPalette1, normalizedPalette2);
  const rankDistance = calculateRankDistance(normalizedPalette1, normalizedPalette2);
  const dominant1 = [...normalizedPalette1].sort((a, b) => b.weight - a.weight)[0];
  const dominant2 = [...normalizedPalette2].sort((a, b) => b.weight - a.weight)[0];
  const dominantDistance = cielabDistance(dominant1.color.lab, dominant2.color.lab);

  const distributionSimilarity = Math.exp(-distance / Math.max(10, sigma));
  const rankSimilarity = Math.exp(-rankDistance / Math.max(12, sigma * 0.9));
  const dominantSimilarity = Math.exp(-dominantDistance / Math.max(14, sigma));

  // Full-distribution agreement is the primary signal. Rank and dominant
  // checks stop a shared neutral swatch from hiding a different hue structure.
  let similarity = (
    distributionSimilarity * 0.60 +
    rankSimilarity * 0.22 +
    dominantSimilarity * 0.18
  );

  if (dominantDistance > 32) similarity *= 0.72;
  if (dominantDistance > 50) similarity *= 0.55;
  if (rankDistance > 38) similarity *= 0.82;

  return Math.min(1.0, Math.max(0.0, similarity));
}

// Helper to categorize dominant color family for filter exploration
export function getColorCategory(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  const [L, a, bVal] = rgbToLab(r, g, b);

  if (L < 18) return 'black';
  if (L > 88 && Math.abs(a) < 8 && Math.abs(bVal) < 8) return 'white';
  if (Math.abs(a) < 10 && Math.abs(bVal) < 10) return 'monochrome';

  // Calculate HSL Hue (0..360)
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;

  let hue = 0;
  if (delta > 0) {
    if (max === rNorm) {
      hue = ((gNorm - bNorm) / delta) % 6;
    } else if (max === gNorm) {
      hue = (bNorm - rNorm) / delta + 2;
    } else {
      hue = (rNorm - gNorm) / delta + 4;
    }
    hue = Math.round(hue * 60);
    if (hue < 0) hue += 360;
  }

  if (hue >= 345 || hue < 15) return 'red';
  if (hue >= 15 && hue < 45) return 'orange';
  if (hue >= 45 && hue < 75) return 'yellow';
  if (hue >= 75 && hue < 165) return 'green';
  if (hue >= 165 && hue < 255) return 'blue';
  if (hue >= 255 && hue < 325) return 'purple';

  return 'red';
}

type ExploreColorFamily = 'red' | 'orange' | 'amber' | 'green' | 'teal' | 'blue' | 'purple' | 'pink' | 'monochrome' | 'neutral';

const EXPLORE_FILTER_FAMILIES: Record<string, ExploreColorFamily> = {
  '#dc2626': 'red',
  '#ea580c': 'orange',
  '#d97706': 'amber',
  '#16a34a': 'green',
  '#0d9488': 'teal',
  '#2563eb': 'blue',
  '#7c3aed': 'purple',
  '#db2777': 'pink',
  '#18181b': 'monochrome',
  '#f8fafc': 'neutral',
};

function exploreColorFamily(hex: string): ExploreColorFamily {
  const [r, g, b] = hexToRgb(hex);
  const [lightness, a, bValue] = rgbToLab(r, g, b);
  const chroma = Math.sqrt(a * a + bValue * bValue);

  if (chroma < 12) return lightness >= 75 ? 'neutral' : 'monochrome';

  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;
  let hue = 0;
  if (delta > 0) {
    if (max === rNorm) hue = ((gNorm - bNorm) / delta) % 6;
    else if (max === gNorm) hue = (bNorm - rNorm) / delta + 2;
    else hue = (rNorm - gNorm) / delta + 4;
    hue = (hue * 60 + 360) % 360;
  }

  if (hue >= 345 || hue < 15) return 'red';
  if (hue < 35) return 'orange';
  if (hue < 70) return 'amber';
  if (hue < 165) return 'green';
  if (hue < 195) return 'teal';
  if (hue < 255) return 'blue';
  if (hue < 315) return 'purple';
  return 'pink';
}

/** Match a selected Explore color against any dominant palette swatch. */
export function matchesColorFilter(targetHex: string, palette: DominantColor[]): boolean {
  if (!targetHex || !palette.length) return false;
  const normalizedTarget = targetHex.toLowerCase();
  const targetFamily = EXPLORE_FILTER_FAMILIES[normalizedTarget] || exploreColorFamily(normalizedTarget);
  const targetLab = rgbToLab(...hexToRgb(normalizedTarget));

  const rankedPalette = palette
    .filter((color) => /^#[0-9a-f]{6}$/i.test(color.hex))
    .sort((left, right) => (right.weight || 0) - (left.weight || 0));

  return rankedPalette.some((color, index) => {
    // A tiny accent should not make a predominantly blue cover appear in the
    // red collection. Only the dominant two swatches or meaningful weights
    // can satisfy an Explore color filter.
    if (index > 1 && (color.weight || 0) < 0.18) return false;
    const family = exploreColorFamily(color.hex);
    if (family !== targetFamily) return false;
    return ciede2000(targetLab, rgbToLab(...hexToRgb(color.hex))) <= 24;
  });
}
