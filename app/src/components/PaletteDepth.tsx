import React from 'react';
import type { DominantColor } from '@/lib/types';
import { getPaletteDepth, limitPalette, MAX_PALETTE_COLORS } from '@/lib/palette';

interface PaletteDepthProps {
  label: string;
  palette: DominantColor[];
  className?: string;
}

export function PaletteDepth({ label, palette, className = '' }: PaletteDepthProps) {
  const colors = limitPalette(palette);
  const depth = getPaletteDepth(colors);

  return (
    <div className={`palette-depth ${className}`.trim()}>
      <div className="palette-depth__header">
        <span>{label}</span>
        <strong><b>{depth}</b> / {MAX_PALETTE_COLORS}</strong>
      </div>
      <div className="palette-depth__rail" aria-label={`${label}: ${depth} of ${MAX_PALETTE_COLORS} palette colors available`}>
        {Array.from({ length: MAX_PALETTE_COLORS }, (_, index) => {
          const color = colors[index];
          return (
            <span
              key={`${label}-${index}`}
              className={color ? 'is-filled' : 'is-empty'}
              style={color ? { backgroundColor: color.hex } : undefined}
              title={color?.hex || `Palette slot ${index + 1} is not available`}
            />
          );
        })}
      </div>
    </div>
  );
}
