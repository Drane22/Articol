'use client';

import React from 'react';

interface ColorSpectrumSliderProps {
  onColorSelect: (hex: string | null) => void;
  selectedColor: string | null;
}

const SPECTRUM_COLORS = [
  { label: 'All', hex: null },
  { label: 'Red', hex: '#dc2626' },
  { label: 'Orange', hex: '#ea580c' },
  { label: 'Amber/Yellow', hex: '#d97706' },
  { label: 'Green', hex: '#16a34a' },
  { label: 'Teal/Cyan', hex: '#0d9488' },
  { label: 'Blue', hex: '#2563eb' },
  { label: 'Indigo/Purple', hex: '#7c3aed' },
  { label: 'Pink/Magenta', hex: '#db2777' },
  { label: 'Monochrome', hex: '#18181b' },
  { label: 'Neutral/White', hex: '#f8fafc' },
];

export const ColorSpectrumSlider: React.FC<ColorSpectrumSliderProps> = ({
  onColorSelect,
  selectedColor,
}) => {
  return (
    <div className="w-full space-y-2">
      <div className="flex justify-between items-center text-xs font-mono text-[var(--text-muted)]">
        <span>Color Spectrum Filter</span>
        {selectedColor && (
          <button
            onClick={() => onColorSelect(null)}
            className="min-h-9 px-2 hover:underline text-[var(--text-primary)]"
          >
            Clear spectrum
          </button>
        )}
      </div>

      <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-none">
        {SPECTRUM_COLORS.map((c, idx) => {
          const isSelected = selectedColor === c.hex;
          return (
            <button
              key={idx}
              onClick={() => onColorSelect(c.hex)}
              className={`min-h-10 flex-shrink-0 flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs transition-all border ${
                isSelected
                  ? 'border-[var(--text-primary)] font-semibold shadow-sm bg-[var(--accent-soft)]'
                  : 'border-[var(--border-color)] hover:border-[var(--text-muted)] text-[var(--text-muted)]'
              }`}
            >
              {c.hex !== null ? (
                <span
                  className="w-3 h-3 rounded-full border border-black/20"
                  style={{ backgroundColor: c.hex }}
                />
              ) : (
                <span className="w-3 h-3 rounded-full bg-gradient-to-r from-red-500 via-green-500 to-blue-500 inline-block" />
              )}
              <span>{c.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
