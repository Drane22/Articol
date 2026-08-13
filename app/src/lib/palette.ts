import type { DominantColor } from './types';

export const MAX_PALETTE_COLORS = 10;
export const DEFAULT_PALETTE_DISPLAY_LIMIT = 5;
export const PALETTE_DISPLAY_OPTIONS = [5, MAX_PALETTE_COLORS] as const;
export type PaletteDisplayLimit = (typeof PALETTE_DISPLAY_OPTIONS)[number];

export function limitPalette(
  palette: DominantColor[] | null | undefined,
  limit: PaletteDisplayLimit | number = MAX_PALETTE_COLORS,
): DominantColor[] {
  if (!Array.isArray(palette)) return [];
  return palette.slice(0, Math.min(MAX_PALETTE_COLORS, Math.max(0, limit)));
}

export function getPaletteDepth(palette: DominantColor[] | null | undefined): number {
  return limitPalette(palette).length;
}
