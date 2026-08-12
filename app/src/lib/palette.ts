import type { DominantColor } from './types';

export const MAX_PALETTE_COLORS = 10;

export function limitPalette(palette: DominantColor[] | null | undefined): DominantColor[] {
  if (!Array.isArray(palette)) return [];
  return palette.slice(0, MAX_PALETTE_COLORS);
}

export function getPaletteDepth(palette: DominantColor[] | null | undefined): number {
  return limitPalette(palette).length;
}
