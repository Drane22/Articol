'use client';

import React, { useEffect, useRef } from 'react';
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
  const isArtStyle = mode === 'art_style';
  const isMusicRelation = mode === 'music_relation';
  const matchPct = Math.round(result.finalScore * 100);
  const visualPct = Math.round((result.visualScore ?? 0) * 100);
  const musicPct = Math.round((result.musicScore ?? 0) * 100);
  const confidencePct = Math.round(result.finalConfidence * 100);
  const rankingSummary = isArtStyle
    ? 'Ranked from verified palette compatibility, artwork structure, medium, composition, and typography. Music metadata is excluded.'
    : isMusicRelation
      ? 'Ranked using artist, genre, and release-era relationships. Artwork is shown for context.'
      : 'Ranked using visual structure, color, typography, texture, and music context.';

  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
      previousFocusRef.current?.focus?.();
    };
  }, []);

  return (
    <div
      className="share-dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="why-match-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCloseRef.current();
      }}
    >
      <div className="share-dialog-panel why-match-dialog">
        <div className="why-match-dialog__scroll">
          <div className="why-match-dialog__content">
        
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          ref={closeButtonRef}
          className="icon-button icon-button--quiet why-match-dialog__close"
          aria-label="Close modal"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center space-x-2 pr-12 text-xs font-mono uppercase tracking-wider text-[var(--text-muted)] mb-2">
          <Sparkles className="w-4 h-4 theme-warning" />
          <span>{isMusicRelation ? 'Music Relation Explanation' : 'Visual Match Explanation'}</span>
        </div>

        <h3 id="why-match-title" className="pr-12 text-xl font-serif font-medium text-[var(--text-primary)] mb-4">
          {isMusicRelation ? 'Why these albums are related' : 'Why these covers were matched'}
        </h3>

        {/* Album Comparison Header */}
        <div className="why-match-comparison">
          <div className="why-match-comparison__item">
            <div className="why-match-comparison__cover">
              <CoverArtwork src={queryAlbum.artworkUrl} alt={queryAlbum.title} sizes="(max-width: 640px) 42vw, 12rem" />
            </div>
            <div className="why-match-comparison__meta">
              <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Query artwork</span>
              <p className="text-sm font-semibold truncate text-[var(--text-primary)]">{queryAlbum.title}</p>
              <p className="text-xs truncate text-[var(--text-muted)]">{queryAlbum.artistName}</p>
            </div>
          </div>

          <div className="why-match-comparison__item">
            <div className="why-match-comparison__cover">
              <CoverArtwork src={candidate.artworkUrl} alt={candidate.title} sizes="(max-width: 640px) 42vw, 12rem" />
            </div>
            <div className="why-match-comparison__meta">
              <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Matched candidate</span>
              <p className="text-sm font-semibold truncate text-[var(--text-primary)]">{candidate.title}</p>
              <p className="text-xs truncate text-[var(--text-muted)]">{candidate.artistName}</p>
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
                <span>{isMusicRelation ? 'Music relationship' : isArtStyle ? 'Visual-style similarity' : 'Balanced relationship'}</span>
              </span>
              <span className="font-mono theme-info font-bold">{matchPct}% Match</span>
            </div>
            <div className="w-full h-2 rounded-full bg-[var(--accent-soft)] overflow-hidden">
              <div className="h-full theme-info-fill rounded-full" style={{ width: `${matchPct}%` }} />
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-1 flex justify-between text-xs font-medium">
              <span>Evidence confidence</span>
              <span className="font-mono theme-success">{confidencePct}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--accent-soft)]">
              <div className="h-full rounded-full theme-success-fill" style={{ width: `${confidencePct}%` }} />
            </div>
          </div>

          {mode === 'balanced' && <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
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
            <span>{isMusicRelation ? 'Artwork palettes (context)' : 'Palette comparison'}</span>
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
              {isArtStyle ? <Palette className="w-3.5 h-3.5" /> : <Layout className="w-3.5 h-3.5" />}
              <span>{isMusicRelation ? 'Shared Music Evidence' : 'Shared Visual Qualities'}</span>
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
      </div>
    </div>
  );
};
