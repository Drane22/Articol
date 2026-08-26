export const PALETTE_ART_STYLES = [
  { id: 'spectral-field', label: 'Spectral Field', description: 'Soft light pools' },
  { id: 'orbit-atlas', label: 'Orbit Atlas', description: 'A visual star chart' },
  { id: 'cut-paper-drift', label: 'Cut-Paper Drift', description: 'Layered editorial shapes' },
  { id: 'moire-pulse', label: 'Moiré Pulse', description: 'Color in motion' },
  { id: 'ink-bloom', label: 'Ink Bloom', description: 'Atmospheric color blooms' },
] as const;

export type PaletteArtStyle = (typeof PALETTE_ART_STYLES)[number]['id'];

export const DEFAULT_PALETTE_ART_STYLE: PaletteArtStyle = 'spectral-field';
export const MAX_PALETTE_ART_COLORS = 10;
export const PALETTE_ART_FALLBACK = ['#171719', '#514748', '#8e7374', '#b99b82', '#dfd4c4'];

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function isPaletteArtStyle(value: string | null | undefined): value is PaletteArtStyle {
  return PALETTE_ART_STYLES.some((style) => style.id === value);
}

export function getPaletteArtStyleLabel(style: PaletteArtStyle): string {
  return PALETTE_ART_STYLES.find((option) => option.id === style)?.label || 'Palette art';
}

export function normalizePaletteArtColors(colors: string[] | null | undefined): string[] {
  const normalized = (Array.isArray(colors) ? colors : [])
    .map((color) => color.trim().toLowerCase())
    .filter((color) => HEX_COLOR.test(color))
    .slice(0, MAX_PALETTE_ART_COLORS);

  return normalized.length > 0 ? normalized : [...PALETTE_ART_FALLBACK];
}

export function getPaletteArtColor(colors: string[], index: number): string {
  return colors[index % colors.length] || PALETTE_ART_FALLBACK[index % PALETTE_ART_FALLBACK.length];
}

export function colorWithAlpha(color: string, alpha: number): string {
  const normalized = color.replace('#', '');
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  const safeAlpha = Math.max(0, Math.min(1, alpha));
  if (![red, green, blue].every(Number.isFinite)) return `rgba(255,255,255,${safeAlpha})`;
  return `rgba(${red}, ${green}, ${blue}, ${safeAlpha})`;
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
