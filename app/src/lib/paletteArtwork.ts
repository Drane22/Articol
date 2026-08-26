export const PALETTE_ART_STYLES = [
  { id: 'chromatic-bloom', label: 'Chromatic Bloom', description: 'Color-grown petals' },
  { id: 'palette-dna', label: 'Palette DNA', description: 'A chromatic double helix' },
  { id: 'chord-map', label: 'Chord Map', description: 'Color relationships, connected' },
  { id: 'spectrum-code', label: 'Spectrum Code', description: 'Every color gets a frequency' },
  { id: 'orbital-weave', label: 'Orbital Weave', description: 'Weighted colors in orbit' },
] as const;

export type PaletteArtStyle = (typeof PALETTE_ART_STYLES)[number]['id'];

export interface PaletteArtColor {
  hex: string;
  index: number;
  hue: number;
  saturation: number;
  luminance: number;
  prominence: number;
  warmth: number;
}

export interface PaletteArtModel {
  colors: PaletteArtColor[];
  averageLuminance: number;
  averageSaturation: number;
  contrast: number;
  hueSpread: number;
  warmBalance: number;
  background: string;
  seed: number;
}

export const DEFAULT_PALETTE_ART_STYLE: PaletteArtStyle = 'chromatic-bloom';
export const MAX_PALETTE_ART_COLORS = 10;
export const PALETTE_ART_FALLBACK = ['#171719', '#514748', '#8e7374', '#b99b82', '#dfd4c4'];

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

function hexToRgb(color: string): [number, number, number] {
  const normalized = color.replace('#', '');
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}

function rgbToHsl(red: number, green: number, blue: number): [number, number, number] {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const lightness = (max + min) / 2;
  if (delta === 0) return [0, 0, lightness];

  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue = 0;
  if (max === r) hue = 60 * (((g - b) / delta) % 6);
  else if (max === g) hue = 60 * ((b - r) / delta + 2);
  else hue = 60 * ((r - g) / delta + 4);
  return [(hue + 360) % 360, clamp(saturation), clamp(lightness)];
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

function hueDistance(first: number, second: number): number {
  const distance = Math.abs(first - second) % 360;
  return Math.min(distance, 360 - distance) / 180;
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

export function normalizePaletteArtColors(colors: unknown[] | null | undefined): string[] {
  const normalized = (Array.isArray(colors) ? colors : [])
    .filter((color): color is string => typeof color === 'string')
    .map((color) => color.trim().toLowerCase())
    .filter((color) => HEX_COLOR.test(color))
    .slice(0, MAX_PALETTE_ART_COLORS);

  return normalized.length > 0 ? normalized : [...PALETTE_ART_FALLBACK];
}

export function getPaletteArtColor(colors: string[], index: number): string {
  if (colors.length === 0) return PALETTE_ART_FALLBACK[index % PALETTE_ART_FALLBACK.length];
  return colors[index % colors.length] || PALETTE_ART_FALLBACK[index % PALETTE_ART_FALLBACK.length];
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

export function buildPaletteArtModel(
  inputColors: unknown[] | null | undefined,
  seedSource: string,
  style: PaletteArtStyle,
): PaletteArtModel {
  const normalized = normalizePaletteArtColors(inputColors);
  const colors = normalized.map((hex, index) => {
    const [red, green, blue] = hexToRgb(hex);
    const [hue, saturation] = rgbToHsl(red, green, blue);
    const prominence = normalized.length === 1
      ? 1
      : 1 - (index / (normalized.length - 1)) * 0.55;
    const warmth = (Math.cos(((hue - 35) * Math.PI) / 180) + 1) / 2;
    return {
      hex,
      index,
      hue,
      saturation,
      luminance: relativeLuminance(red, green, blue),
      prominence: clamp(prominence),
      warmth: clamp(warmth),
    };
  });

  const luminances = colors.map((color) => color.luminance);
  const averageLuminance = luminances.reduce((sum, value) => sum + value, 0) / colors.length;
  const averageSaturation = colors.reduce((sum, color) => sum + color.saturation, 0) / colors.length;
  const pairDistances = colors.flatMap((color, index) => (
    colors.slice(index + 1).map((candidate) => hueDistance(color.hue, candidate.hue))
  ));
  const hueSpread = pairDistances.length > 0
    ? pairDistances.reduce((sum, value) => sum + value, 0) / pairDistances.length
    : 0;
  const warmBalance = colors.reduce((sum, color) => sum + color.warmth, 0) / colors.length;
  const darkest = [...colors].sort((first, second) => first.luminance - second.luminance)[0]?.hex
    || PALETTE_ART_FALLBACK[0];

  return {
    colors,
    averageLuminance: clamp(averageLuminance),
    averageSaturation: clamp(averageSaturation),
    contrast: clamp(Math.max(...luminances) - Math.min(...luminances)),
    hueSpread: clamp(hueSpread),
    warmBalance: clamp(warmBalance),
    background: mixHexColors(darkest, '#090a0d', 0.74),
    seed: paletteArtSeed(`${seedSource}:${style}`),
  };
}
