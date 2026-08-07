'use client';

import React, { useEffect, useRef } from 'react';
import { X, Sparkles, Palette } from 'lucide-react';
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
  const confidencePct = Math.round(result.finalConfidence * 100);
  const palettePct = result.componentScores.color === null || result.componentScores.color === undefined
    ? null
    : Math.round(result.componentScores.color * 100);
  const scoreLabel = isMusicRelation ? 'Music relation' : isArtStyle ? 'Visual similarity' : 'Balanced similarity';
  const explanationLead = isMusicRelation
    ? 'Music relation · artist and genre context'
    : `${isArtStyle ? 'Visual-style match' : 'Balanced visual match'}${palettePct === null ? '' : ` · ${palettePct}% palette compatibility`}`;
  const explanationBody = isArtStyle
    ? 'Palette, structure, medium, composition, and typography were compared. Music metadata is excluded.'
    : isMusicRelation
      ? 'Artist, genre, and release-era relationships were compared. Artwork is shown for context.'
      : 'Palette, structure, composition, typography, and music context were compared.';
  const reasonLabels = result.matchReasons
    .map((reason) => reason.label.trim())
    .filter(Boolean)
    .slice(0, 2);
  const reasonSentence = reasonLabels.length > 0
    ? `${reasonLabels.join(' · ')}.`
    : explanationBody;

  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
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
      if (event.key !== 'Tab') return;

      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) || []);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
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
      <div ref={dialogRef} className="share-dialog-panel why-match-dialog">
        <div className="why-match-dialog__scroll">
          <div className="why-match-dialog__content">
        
        <header className="why-match-dialog__header">
          <div className="min-w-0">
            <div className="flex items-center space-x-2 text-xs font-mono uppercase tracking-wider text-[var(--text-muted)]">
              <Sparkles className="w-4 h-4 theme-warning" />
              <span>{isMusicRelation ? 'Music Relation Explanation' : 'Visual Match Explanation'}</span>
            </div>
            <h3 id="why-match-title" className="mt-1 text-xl font-serif font-medium text-[var(--text-primary)]">
              {isMusicRelation ? 'Why these albums are related' : 'Why these covers were matched'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            ref={closeButtonRef}
            className="icon-button icon-button--quiet why-match-dialog__close"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <section className="why-match-comparison" aria-label="Album artwork comparison">
          <article className="why-match-comparison__item">
            <span className="why-match-comparison__label">Query artwork</span>
            <div className="why-match-comparison__cover">
              <CoverArtwork src={queryAlbum.artworkUrl} alt={`Query artwork for ${queryAlbum.title}`} sizes="(max-width: 640px) 38vw, 18rem" priority />
            </div>
            <div className="why-match-comparison__meta">
              <p className="text-sm font-semibold truncate text-[var(--text-primary)]">{queryAlbum.title}</p>
              <p className="text-xs truncate text-[var(--text-muted)]">{queryAlbum.artistName}</p>
            </div>
          </article>

          <div className="why-match-comparison__versus" aria-hidden="true">VS</div>

          <article className="why-match-comparison__item">
            <span className="why-match-comparison__label">Matched candidate</span>
            <div className="why-match-comparison__cover">
              <CoverArtwork src={candidate.artworkUrl} alt={`Matched artwork for ${candidate.title}`} sizes="(max-width: 640px) 38vw, 18rem" priority />
            </div>
            <div className="why-match-comparison__meta">
              <p className="text-sm font-semibold truncate text-[var(--text-primary)]">{candidate.title}</p>
              <p className="text-xs truncate text-[var(--text-muted)]">{candidate.artistName}</p>
            </div>
          </article>
        </section>

        <section className="why-match-score" aria-label="Match scores">
          <div className="why-match-score__metric why-match-score__metric--match">
            <div className="why-match-score__heading">
              <span>{scoreLabel}</span>
              <strong>{matchPct}%</strong>
            </div>
            <div className="why-match-score__bar" aria-hidden="true">
              <span style={{ width: `${matchPct}%` }} />
            </div>
          </div>
          <div className="why-match-score__metric why-match-score__metric--confidence">
            <div className="why-match-score__heading">
              <span>Evidence confidence</span>
              <strong>{confidencePct}%</strong>
            </div>
            <div className="why-match-score__bar" aria-hidden="true">
              <span style={{ width: `${confidencePct}%` }} />
            </div>
          </div>
        </section>

        <section className="why-match-explanation text-sm text-[var(--text-primary)] leading-relaxed" aria-label="Match explanation">
          <div className="why-match-explanation__lead">
            <Sparkles className="h-3.5 w-3.5 theme-warning" aria-hidden="true" />
            <strong>{explanationLead}</strong>
          </div>
          <p className="sr-only">{result.explanation}</p>
          <span className="text-xs text-[var(--text-muted)] block font-sans">
            {explanationBody}
          </span>
        </section>

        <section className="why-match-evidence" aria-label="Visual evidence">
          <div className="why-match-evidence__heading">
            <Palette className="h-3.5 w-3.5 theme-info" aria-hidden="true" />
            <span>Visual evidence</span>
          </div>
          <div className="why-match-evidence__palettes">
            <div className="why-match-evidence__palette-row">
              <span>Query</span>
              <div className="why-match-evidence__swatches">
                {queryAlbum.dominantPalette.slice(0, 5).map((p, idx) => (
                  <span key={idx} style={{ backgroundColor: p.hex }} title={p.hex} />
                ))}
              </div>
            </div>
            <div className="why-match-evidence__palette-row">
              <span>Candidate</span>
              <div className="why-match-evidence__swatches">
                {candidate.dominantPalette.slice(0, 5).map((p, idx) => (
                  <span key={idx} style={{ backgroundColor: p.hex }} title={p.hex} />
                ))}
              </div>
            </div>
          </div>
          {result.sharedAttributes.length > 0 && (
            <div className="why-match-evidence__qualities">
              {result.sharedAttributes.slice(0, 3).map((attr, idx) => (
                <span key={`${attr.name}-${idx}`}>{attr.value}</span>
              ))}
            </div>
          )}
          <div className="why-match-evidence__reason">
            <span>Why this match</span>
            <p>{reasonSentence}</p>
          </div>
        </section>

          </div>
        </div>
      </div>
    </div>
  );
};
