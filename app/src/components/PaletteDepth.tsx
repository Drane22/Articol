import React, { useState } from 'react';
import type { DominantColor } from '@/lib/types';
import {
  DEFAULT_PALETTE_DISPLAY_LIMIT,
  getPaletteDepth,
  limitPalette,
  MAX_PALETTE_COLORS,
  type PaletteDisplayLimit,
} from '@/lib/palette';

interface PaletteDepthProps {
  label: string;
  palette: DominantColor[];
  className?: string;
  displayLimit?: PaletteDisplayLimit;
  onDisplayLimitChange?: (limit: PaletteDisplayLimit) => void;
}

export function PaletteDepth({
  label,
  palette,
  className = '',
  displayLimit,
  onDisplayLimitChange,
}: PaletteDepthProps) {
  const [internalDisplayLimit, setInternalDisplayLimit] = useState<PaletteDisplayLimit>(DEFAULT_PALETTE_DISPLAY_LIMIT);
  const activeDisplayLimit = displayLimit ?? internalDisplayLimit;
  const colors = limitPalette(palette, activeDisplayLimit);
  const depth = getPaletteDepth(palette);
  const setDisplayLimit = (nextLimit: PaletteDisplayLimit) => {
    setInternalDisplayLimit(nextLimit);
    onDisplayLimitChange?.(nextLimit);
  };

  return (
    <div className={`palette-depth ${className}`.trim()}>
      <div className="palette-depth__header">
        <span>{label}</span>
        <div className="palette-depth__controls">
          <strong><b>{colors.length}</b> / {depth || MAX_PALETTE_COLORS}</strong>
          <span className="palette-depth__switch-label" aria-hidden="true">5</span>
          <button
            type="button"
            role="switch"
            aria-checked={activeDisplayLimit === MAX_PALETTE_COLORS}
            aria-label={`Show ${activeDisplayLimit === MAX_PALETTE_COLORS ? 5 : 10} palette colors`}
            className={`palette-depth__switch ${activeDisplayLimit === MAX_PALETTE_COLORS ? 'is-expanded' : ''}`}
            onClick={() => setDisplayLimit(activeDisplayLimit === MAX_PALETTE_COLORS ? 5 : MAX_PALETTE_COLORS)}
          >
            <span className="palette-depth__switch-knob" />
          </button>
          <span className="palette-depth__switch-label" aria-hidden="true">10</span>
        </div>
      </div>
      <div
        className="palette-depth__rail"
        data-slots={activeDisplayLimit}
        aria-label={`${label}: showing ${colors.length} of ${depth || MAX_PALETTE_COLORS} palette colors`}
      >
        {Array.from({ length: activeDisplayLimit }, (_, index) => {
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
