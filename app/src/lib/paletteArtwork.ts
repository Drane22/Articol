import {
  circularHueStats,
  deduplicatePaletteColors,
  getDisplayColor,
  hexToOklch,
  hexToRgb,
  oklchToHex,
  rgbToHex,
  rgbToLab,
} from './colorUtils';
import type { DominantColor, VisualFeatures } from './types';

export const PALETTE_ART_STYLES = [
  {
    id: 'chromatic-bloom',
    label: 'Succulent Bloom',
    description: 'A layered rosette grown from the cover palette',
    formula: 'Leaf area maps to color coverage, reach to salience, roundness to chroma, and ordering to hue.',
  },
  {
    id: 'palette-dna',
    label: 'Cover Genome',
    description: 'Cover traits twisted into a translucent sculpture',
    formula: 'Contrast controls twist depth, symmetry controls regularity, and palette coverage controls ribbon and facet mass.',
  },
  {
    id: 'chord-map',
    label: 'Chord Loom',
    description: 'Album colors woven into a dimensional textile',
    formula: 'Coverage controls band width, contrast controls crossing depth, and edge detail controls weave density.',
  },
  {
    id: 'spectrum-code',
    label: 'Cover Pulse',
    description: 'A sculpted terrain relief shaped by the cover',
    formula: 'Contrast controls elevation, entropy shapes the terrain, and negative space carves the central basin.',
  },
  {
    id: 'orbital-weave',
    label: 'Record Atlas',
    description: 'A miniature solar system built from the album',
    formula: 'The dominant color forms the sun; coverage sizes planets while lightness, chroma, and hue place their orbits.',
  },
] as const;

export type PaletteArtStyle = (typeof PALETTE_ART_STYLES)[number]['id'];

export interface PaletteArtInputColor {
  hex: string;
  weight?: number;
  lab?: [number, number, number];
}

export interface PaletteArtColor {
  /** Faithful extracted swatch from the album cover (for legends & metadata). */
  sourceHex: string;
  /** Background-adjusted color guaranteeing visibility and balanced chroma for artwork marks. */
  displayHex: string;
  index: number;
  weight: number;
  normalizedWeight: number;
  salience: number;
  hue: number;
  chroma: number;
  lightness: number;
  luminance: number;
  warmth: number;
}

export interface PaletteArtExplanation {
  dominantSummary: string;
  accentSummary: string;
}

export interface PaletteArtTraits {
  coverageConcentration: number;
  chroma: number;
  lightness: number;
  contrast: number;
  edgeDensity: number;
  symmetry: number;
  warmth: number;
  exposure: number;
  materialRichness: number;
  depthRange: number;
  complexity: number;
  segmentation: number;
  focalX: number;
  focalY: number;
  sculptureScale: number;
  negativeSpace: number;
  cameraTilt: number;
  photography: number;
  illustration: number;
  abstraction: number;
  collage: number;
}

export type AlbumArtSignature = PaletteArtTraits;

export interface PaletteArtModel {
  colors: PaletteArtColor[];
  dominant: PaletteArtColor;
  accents: PaletteArtColor[];
  averageLightness: number;
  averageChroma: number;
  lightnessRange: number;
  hueDiversity: number;
  warmBalance: number;
  background: string;
  foreground: string;
  seed: number;
  traits: PaletteArtTraits;
  explanation: PaletteArtExplanation;
}

export const DEFAULT_PALETTE_ART_STYLE: PaletteArtStyle = 'chromatic-bloom';
export const MAX_PALETTE_ART_COLORS = 10;
export const MAX_DISPLAY_ART_COLORS = 5;
export const PALETTE_ART_FALLBACK: PaletteArtInputColor[] = [
  { hex: '#1c1e24', weight: 0.35 },
  { hex: '#484e5b', weight: 0.25 },
  { hex: '#7e8799', weight: 0.18 },
  { hex: '#c5b49d', weight: 0.13 },
  { hex: '#e8dfd2', weight: 0.09 },
];

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const LEGACY_STYLE_MAP: Record<string, PaletteArtStyle> = {
  'spectral-field': 'chromatic-bloom',
  'orbit-atlas': 'orbital-weave',
  'cut-paper-drift': 'chord-map',
  'moire-pulse': 'spectrum-code',
  'ink-bloom': 'chromatic-bloom',
};

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

function finiteOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function availableFeatureValue(value: unknown, fallback: number): number {
  if (!value || typeof value !== 'object') return fallback;
  const candidate = value as { value?: unknown; available?: unknown };
  return candidate.available !== false ? finiteOr(candidate.value, fallback) : fallback;
}

function channelLuminance(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(red: number, green: number, blue: number): number {
  return clamp(
    0.2126 * channelLuminance(red)
    + 0.7152 * channelLuminance(green)
    + 0.0722 * channelLuminance(blue),
  );
}

export function parsePaletteArtStyle(value: string | null | undefined): PaletteArtStyle | undefined {
  if (!value) return undefined;
  const current = PALETTE_ART_STYLES.find((style) => style.id === value)?.id;
  return current || LEGACY_STYLE_MAP[value];
}

export function isPaletteArtStyle(value: string | null | undefined): value is PaletteArtStyle {
  return PALETTE_ART_STYLES.some((style) => style.id === value);
}

export function getPaletteArtStyleLabel(style: PaletteArtStyle): string {
  return PALETTE_ART_STYLES.find((option) => option.id === style)?.label || 'Palette art';
}

export function getPaletteArtStyleDescription(style: PaletteArtStyle): string {
  return PALETTE_ART_STYLES.find((option) => option.id === style)?.description || 'Generative palette art';
}

export function getPaletteArtStyleFormula(style: PaletteArtStyle): string {
  return PALETTE_ART_STYLES.find((option) => option.id === style)?.formula || 'Album palette data-to-form mapping';
}

/**
 * Normalizes input colors into structured PaletteArtInputColor[], keeping legacy
 * hex strings fully backward-compatible.
 */
export function normalizePaletteArtColors(
  colors: unknown[] | null | undefined,
): string[] {
  const normalized = parsePaletteInputColors(colors);
  return normalized.map((c) => c.hex);
}

export function parsePaletteInputColors(
  input: unknown[] | null | undefined,
): PaletteArtInputColor[] {
  if (!Array.isArray(input) || input.length === 0) {
    return [...PALETTE_ART_FALLBACK];
  }

  const parsed: PaletteArtInputColor[] = [];
  for (const item of input) {
    if (typeof item === 'string') {
      const hex = item.trim().toLowerCase();
      if (HEX_COLOR.test(hex)) {
        parsed.push({ hex, weight: 1 });
      }
    } else if (item && typeof item === 'object' && 'hex' in item && typeof (item as any).hex === 'string') {
      const hex = (item as any).hex.trim().toLowerCase();
      if (HEX_COLOR.test(hex)) {
        const rawWeight = Number((item as any).weight);
        const weight = Number.isFinite(rawWeight) && rawWeight > 0 ? rawWeight : 1;
        const lab = Array.isArray((item as any).lab) && (item as any).lab.length === 3 ? (item as any).lab : undefined;
        parsed.push({ hex, weight, lab });
      }
    }
  }

  return parsed.length > 0 ? parsed.slice(0, MAX_PALETTE_ART_COLORS) : [...PALETTE_ART_FALLBACK];
}

export function colorWithAlpha(color: string, alpha: number): string {
  const [red, green, blue] = HEX_COLOR.test(color) ? hexToRgb(color) : [255, 255, 255];
  return `rgba(${red}, ${green}, ${blue}, ${clamp(alpha)})`;
}

export function mixHexColors(first: string, second: string, amount: number): string {
  const [firstRed, firstGreen, firstBlue] = HEX_COLOR.test(first) ? hexToRgb(first) : [0, 0, 0];
  const [secondRed, secondGreen, secondBlue] = HEX_COLOR.test(second) ? hexToRgb(second) : [0, 0, 0];
  const ratio = clamp(amount);
  const channels = [
    Math.round(firstRed + (secondRed - firstRed) * ratio),
    Math.round(firstGreen + (secondGreen - firstGreen) * ratio),
    Math.round(firstBlue + (secondBlue - firstBlue) * ratio),
  ];
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

export function paletteArtSeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function seededUnit(seed: number, index: number): number {
  let value = (seed + Math.imul(index + 1, 374761393)) | 0;
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  value ^= value >>> 16;
  return (value >>> 0) / 4294967295;
}

/**
 * Builds the complete generative art model from authentic palette data.
 */
export function buildPaletteArtModel(
  inputColors: unknown[] | null | undefined,
  seedSource: string,
  style: PaletteArtStyle,
  visualFeatures?: VisualFeatures | null,
): PaletteArtModel {
  const parsedInputs = parsePaletteInputColors(inputColors);

  // Perceptually deduplicate near-identical swatches while accumulating their weights
  const deduplicated = deduplicatePaletteColors(parsedInputs, 10.0);
  const validInputs = deduplicated.length > 0 ? deduplicated : parsedInputs.map((p) => ({
    hex: p.hex,
    weight: p.weight || 1,
    lab: p.lab || rgbToLab(...hexToRgb(p.hex)),
  }));

  // Analyze each color in OKLCH & perceptual spaces
  const analyzed = validInputs.map((color, index) => {
    const sourceHex = color.hex;
    const [r, g, b] = hexToRgb(sourceHex);
    const [L, C, h] = hexToOklch(sourceHex);
    const lum = relativeLuminance(r, g, b);
    const warmth = (Math.cos(((h - 35) * Math.PI) / 180) + 1) / 2;

    // Salience: accounts for vividness (chroma) and contrast from mid-gray.
    // Small vivid accents receive high salience even with low pixel weight.
    const chromaBoost = C > 0.08 ? 0.25 : 0;
    const salience = clamp(C * 2.4 + Math.abs(L - 0.45) * 0.5 + chromaBoost);

    return {
      sourceHex,
      rawWeight: color.weight,
      salience,
      hue: h,
      chroma: C,
      lightness: L,
      luminance: lum,
      warmth,
    };
  });

  // Sort by weight to identify dominant colors, but preserve salient accents
  const ranked = [...analyzed].sort((a, b) => b.rawWeight - a.rawWeight);
  const selected = ranked.slice(0, MAX_DISPLAY_ART_COLORS);

  // Normalize weights across the selected display colors
  const totalWeight = selected.reduce((sum, item) => sum + item.rawWeight, 0);
  const isUniformWeight = selected.every((item) => Math.abs(item.rawWeight - selected[0].rawWeight) < 1e-5);

  const colors: PaletteArtColor[] = selected.map((item, index) => {
    const normalizedWeight = isUniformWeight
      ? 1 / selected.length
      : totalWeight > 0
        ? item.rawWeight / totalWeight
        : 1 / selected.length;
    const displayHex = getDisplayColor(item.sourceHex, true);

    return {
      sourceHex: item.sourceHex,
      displayHex,
      index,
      weight: item.rawWeight,
      normalizedWeight: clamp(normalizedWeight),
      salience: item.salience,
      hue: item.hue,
      chroma: item.chroma,
      lightness: item.lightness,
      luminance: item.luminance,
      warmth: item.warmth,
    };
  });

  const dominant = colors[0];
  const accents = [...colors].sort((a, b) => b.salience - a.salience).slice(0, 3);

  // Global palette statistics
  const lightnesses = colors.map((c) => c.lightness);
  const averageLightness = lightnesses.reduce((sum, v) => sum + v, 0) / colors.length;
  const averageChroma = colors.reduce((sum, c) => sum + c.chroma, 0) / colors.length;
  const lightnessRange = Math.max(...lightnesses) - Math.min(...lightnesses);
  const hueStats = circularHueStats(colors.map((c) => ({ hue: c.hue, weight: c.normalizedWeight })));
  const warmBalance = colors.reduce((sum, c) => sum + c.warmth * c.normalizedWeight, 0);

  // Background tint calculation: deep obsidian tinted with dominant hue
  const bgL = 0.085;
  const bgC = Math.min(0.018, dominant.chroma * 0.15);
  const background = oklchToHex(bgL, bgC, dominant.hue);
  const foreground = averageLightness > 0.65 ? '#1a1b20' : '#f4f1ea';

  // Natural language explanations
  const dominantPct = Math.round(dominant.normalizedWeight * 100);
  const highestAccent = accents.find((a) => a.sourceHex !== dominant.sourceHex) || dominant;
  const accentPct = Math.round(highestAccent.salience * 100);

  const dominantSummary = dominantPct >= 50
    ? `Dominant swatch (${dominant.sourceHex}) represents ${dominantPct}% of the cover coverage.`
    : `Primary swatch (${dominant.sourceHex}) accounts for ${dominantPct}% of the extracted palette.`;

  const accentSummary = highestAccent.chroma > 0.08
    ? `Accent swatch (${highestAccent.sourceHex}) has high chroma (${accentPct}% salience), driving the focal marks.`
    : `Tonal swatch (${highestAccent.sourceHex}) provides the highest lightness contrast against the background.`;

  const fallbackContrast = lightnessRange;
  const fallbackEdgeDensity = 0.28 + hueStats.dispersion * 0.52;
  const complexity = visualFeatures?.complexity;
  const contrast = clamp(finiteOr(visualFeatures?.contrast, fallbackContrast));
  const edgeDensity = clamp(finiteOr(
    visualFeatures?.edgeDensity,
    availableFeatureValue(complexity?.edgeDensity, fallbackEdgeDensity),
  ));
  const entropy = clamp(finiteOr(
    visualFeatures?.visualEntropy,
    availableFeatureValue(complexity?.visualEntropy, 0.42 + hueStats.dispersion * 0.34),
  ));
  const detailDensity = clamp(availableFeatureValue(complexity?.detailDensity, edgeDensity));
  const regionCount = clamp(availableFeatureValue(complexity?.regionCount, 3 + edgeDensity * 8) / 14);
  const negativeSpace = clamp(availableFeatureValue(
    complexity?.negativeSpaceRatio,
    finiteOr(visualFeatures?.minimalismScore, 0.5),
  ));
  const lightnessSpread = clamp(finiteOr(visualFeatures?.colorProfile?.lightnessSpread, lightnessRange));
  const saturation = clamp(finiteOr(visualFeatures?.saturation, averageChroma * 4.5));
  const symmetry = clamp(finiteOr(visualFeatures?.symmetryScore, 0.58));
  const focalX = clamp(finiteOr(visualFeatures?.centroidX, 0.5));
  const focalY = clamp(finiteOr(visualFeatures?.centroidY, 0.5));
  const warmth = clamp(finiteOr(visualFeatures?.warmCool, warmBalance * 2 - 1) * 0.5 + 0.5);

  const traits: PaletteArtTraits = {
    coverageConcentration: clamp(dominant.normalizedWeight),
    chroma: saturation,
    lightness: clamp(averageLightness),
    contrast,
    edgeDensity,
    symmetry,
    warmth,
    exposure: clamp(finiteOr(visualFeatures?.luminance, averageLightness)),
    materialRichness: saturation,
    depthRange: clamp(contrast * 0.64 + lightnessSpread * 0.36),
    complexity: clamp(entropy * 0.62 + detailDensity * 0.25 + regionCount * 0.13),
    segmentation: clamp(edgeDensity * 0.7 + regionCount * 0.3),
    focalX,
    focalY,
    sculptureScale: clamp(finiteOr(visualFeatures?.foregroundRatio, 0.58)),
    negativeSpace,
    cameraTilt: clamp(
      visualFeatures?.layoutType === 'dense_pattern' ? 0.72
        : visualFeatures?.layoutType === 'grid_collage' ? 0.64
          : visualFeatures?.layoutType === 'off_center' ? 0.58
            : visualFeatures?.layoutType === 'minimal_text' ? 0.34
              : 0.48,
    ),
    photography: clamp(finiteOr(visualFeatures?.photographyProb, 0.5)),
    illustration: clamp(finiteOr(visualFeatures?.illustrationProb, 0.35)),
    abstraction: clamp(finiteOr(visualFeatures?.abstractProb, entropy)),
    collage: clamp(finiteOr(visualFeatures?.collageProb, edgeDensity * (1 - symmetry))),
  };

  return {
    colors,
    dominant,
    accents,
    averageLightness: clamp(averageLightness),
    averageChroma: clamp(averageChroma),
    lightnessRange: clamp(lightnessRange),
    hueDiversity: clamp(hueStats.dispersion),
    warmBalance: clamp(warmBalance),
    background,
    foreground,
    seed: paletteArtSeed(`${seedSource}:${style}`),
    traits,
    explanation: {
      dominantSummary,
      accentSummary,
    },
  };
}
