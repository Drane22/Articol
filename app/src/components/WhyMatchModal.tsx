'use client';

import React from 'react';
import { X, Sparkles, Sliders, Palette, Layout } from 'lucide-react';
import { SimilarityResult, Album, SearchMode } from '../lib/types';
import { CoverArtwork } from './CoverArtwork';

interface WhyMatchModalProps {
  queryAlbum: Album;
  result: SimilarityResult;
  mode: SearchMode;
  onClose: () => void;
}

export const WhyMatchModal: React.FC<WhyMatchModalProps> = ({
  queryAlbum,
  result,
  mode,
  onClose,
}) => {
  const candidate = result.album;
  const isPaletteOnly = mode === 'art_style';
  const matchPct = Math.round(result.finalScore * 100);
  const visualPct = Math.round((result.visualScore ?? 0) * 100);
  const musicPct = Math.round((result.musicScore ?? 0) * 100);
  const rankingSummary = isPaletteOnly
    ? 'Ranked only with the full dominant-color distribution. Music, artist, layout, typography, and embeddings are excluded.'
    : mode === 'music_relation'
      ? 'Ranked using artist, genre, and release-era relationships. Artwork is shown for context.'
      : 'Ranked using visual structure, color, typography, texture, and music context.';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 theme-overlay backdrop-blur-sm animate-fade-in">
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl relative max-h-[calc(100dvh-1rem)] sm:max-h-[90vh] overflow-y-auto">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 min-h-9 min-w-9 text-[var(--text-muted)] hover:text-[var(--text-primary)] p-2 rounded-lg hover:bg-[var(--accent-soft)] transition-colors"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center space-x-2 text-xs font-mono uppercase tracking-wider text-[var(--text-muted)] mb-2">
          <Sparkles className="w-4 h-4 theme-warning" />
          <span>Visual Match Explanation</span>
        </div>

        <h3 className="text-xl font-serif font-medium text-[var(--text-primary)] mb-4">
          Why these covers were matched
        </h3>

        {/* Album Comparison Header */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 sm:p-4 rounded-lg bg-[var(--accent-soft)] border border-[var(--border-color)] mb-6">
          <div className="flex items-center space-x-3">
            <div className="relative w-14 h-14 rounded overflow-hidden flex-shrink-0">
              <CoverArtwork src={queryAlbum.artworkUrl} alt={queryAlbum.title} sizes="56px" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase block">Query Artwork</span>
              <p className="text-xs font-semibold truncate text-[var(--text-primary)]">{queryAlbum.title}</p>
              <p className="text-[11px] truncate text-[var(--text-muted)]">{queryAlbum.artistName}</p>
            </div>
          </div>

          <div className="flex items-center space-x-3 border-t sm:border-t-0 sm:border-l border-[var(--border-color)] pt-3 sm:pt-0 sm:pl-4">
            <div className="relative w-14 h-14 rounded overflow-hidden flex-shrink-0">
              <CoverArtwork src={candidate.artworkUrl} alt={candidate.title} sizes="56px" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase block">Matched Candidate</span>
              <p className="text-xs font-semibold truncate text-[var(--text-primary)]">{candidate.title}</p>
              <p className="text-[11px] truncate text-[var(--text-muted)]">{candidate.artistName}</p>
            </div>
          </div>
        </div>

        {/* Natural Language Explanation Box */}
        <div className="p-4 rounded-lg border theme-warning-surface text-sm text-[var(--text-primary)] leading-relaxed mb-6">
          <p className="font-serif italic text-base mb-1">“{result.explanation}”</p>
          <span className="text-xs text-[var(--text-muted)] block font-sans">
            {rankingSummary}
          </span>
        </div>

        {/* Score Breakdown Bar */}
        <div className="space-y-3 mb-6">
          <div>
            <div className="flex justify-between text-xs font-medium mb-1">
              <span className="flex items-center space-x-1.5">
                <Sliders className="w-3.5 h-3.5 theme-info" />
                <span>{isPaletteOnly ? 'Palette Similarity' : 'Total Combined Similarity'}</span>
              </span>
              <span className="font-mono theme-info font-bold">{matchPct}% Match</span>
            </div>
            <div className="w-full h-2 rounded-full bg-[var(--accent-soft)] overflow-hidden">
              <div className="h-full theme-info-fill rounded-full" style={{ width: `${matchPct}%` }} />
            </div>
          </div>

          {!isPaletteOnly && <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <div className="flex justify-between text-xs mb-1 text-[var(--text-muted)]">
                <span>Visual Score</span>
                <span className="font-mono font-medium">{visualPct}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-[var(--accent-soft)] overflow-hidden">
                <div className="h-full theme-success-fill rounded-full" style={{ width: `${visualPct}%` }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1 text-[var(--text-muted)]">
                <span>Music Context Score</span>
                <span className="font-mono font-medium">{musicPct}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-[var(--accent-soft)] overflow-hidden">
                <div className="h-full theme-purple-fill rounded-full" style={{ width: `${musicPct}%` }} />
              </div>
            </div>
          </div>}
        </div>

        {/* Palette Comparison Swatches */}
        <div className="space-y-3 pt-2 border-t border-[var(--border-color)]">
          <div className="flex items-center space-x-1.5 text-xs font-mono uppercase text-[var(--text-muted)]">
            <Palette className="w-3.5 h-3.5" />
            <span>Palette Comparison</span>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-[var(--text-muted)]">Query Palette</span>
              <div className="flex space-x-1">
                {queryAlbum.dominantPalette.map((p, idx) => (
                  <span
                    key={idx}
                    className="w-5 h-5 rounded-full border theme-swatch-border inline-block"
                    style={{ backgroundColor: p.hex }}
                    title={p.hex}
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-[var(--text-muted)]">Candidate Palette</span>
              <div className="flex space-x-1">
                {candidate.dominantPalette.map((p, idx) => (
                  <span
                    key={idx}
                    className="w-5 h-5 rounded-full border theme-swatch-border inline-block"
                    style={{ backgroundColor: p.hex }}
                    title={p.hex}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Shared Attributes List */}
        {result.sharedAttributes.length > 0 && (
          <div className="mt-6 pt-4 border-t border-[var(--border-color)]">
            <div className="flex items-center space-x-1.5 text-xs font-mono uppercase text-[var(--text-muted)] mb-3">
              {isPaletteOnly ? <Palette className="w-3.5 h-3.5" /> : <Layout className="w-3.5 h-3.5" />}
              <span>Shared Visual Qualities</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {result.sharedAttributes.map((attr, idx) => (
                <div key={idx} className="p-2 rounded bg-[var(--accent-soft)] text-xs flex justify-between items-center">
                  <span className="text-[var(--text-muted)]">{attr.name}:</span>
                  <span className="font-medium text-[var(--text-primary)]">{attr.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
