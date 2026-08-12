'use client';

import React from 'react';
import { X, Sparkles, Palette, ArrowRight, Waves } from 'lucide-react';
import { SimilarityResult, Album, SearchMode } from '../lib/types';
import { CoverArtwork } from './CoverArtwork';
import { DialogFrame } from './DialogFrame';

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
    ? 'A palette-led reading of structure, medium, composition, and typography; music metadata stays out of scope.'
    : isMusicRelation
      ? 'A music-first connection across artist, genre, and release era; the artwork remains visual context.'
      : 'A balanced read of palette, structure, composition, typography, and music context.';
  const reasonLabels = result.matchReasons
    .map((reason) => reason.label.trim())
    .filter(Boolean)
    .slice(0, 2);
  const sharedAttributeValues = result.sharedAttributes
    .map((attribute) => attribute.value.trim())
    .filter(Boolean)
    .slice(0, 2);
  const primaryCategory = result.matchReasons[0]?.category;
  const visualOpeners: Record<string, string> = {
    color: 'The palette sets the handshake:',
    layout: 'The compositions speak the same visual dialect:',
    typography: 'The covers share a typographic voice:',
    texture: 'The surfaces carry a related tactility:',
    mood: 'The mood lands in the same register:',
    music: 'The catalogue connection starts with:',
  };
  const reasonDetails = reasonLabels.map((label) => label.toLowerCase());
  const storyOpening = isMusicRelation
    ? 'Different sleeves, one musical orbit.'
    : palettePct !== null && palettePct >= 82
      ? 'These covers found each other across the room.'
      : palettePct !== null && palettePct >= 68
        ? 'Not twins—more like visual pen pals.'
        : 'The connection lives in the details.';
  const storyBridge = isMusicRelation
    ? `${reasonDetails.join(' and ') || 'a shared musical thread'} pull both records into the same listening path.`
    : `${visualOpeners[primaryCategory || ''] || 'The visual connection starts with'} ${reasonDetails.join(' and ') || 'a shared visual language'}.`;
  const storyPayoff = sharedAttributeValues.length
    ? `${sharedAttributeValues.join(' and ')} supply the final bit of chemistry.`
    : isMusicRelation
      ? 'The evidence stays musical; the artwork is here for context.'
      : 'The resemblance is measured in the artwork, not borrowed from music metadata.';

  return (
    <DialogFrame ariaLabelledBy="why-match-title" onClose={onClose} panelClassName="why-match-dialog">
      {({ closeButtonRef, requestClose }) => (
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
            onClick={requestClose}
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

        <section className="why-match-story" aria-label="Match story">
          <p className="sr-only">{result.explanation}</p>
          <div className="why-match-story__signal">
            <span className="why-match-story__icon" aria-hidden="true">
              <Waves className="h-4 w-4" strokeWidth={1.5} />
            </span>
            <div>
              <span className="eyebrow-label">The match story</span>
              <strong>{storyOpening}</strong>
            </div>
          </div>
          <div className="why-match-story__chapters">
            <div>
              <span>01 · First impression</span>
              <p>{storyBridge}</p>
            </div>
            <ArrowRight className="why-match-story__arrow" aria-hidden="true" strokeWidth={1.25} />
            <div>
              <span>02 · The chemistry</span>
              <p>{storyPayoff}</p>
            </div>
          </div>
          <div className="why-match-story__verdict">
            <Sparkles className="h-3.5 w-3.5 theme-warning" aria-hidden="true" />
            <span>{explanationLead}</span>
            <small>{explanationBody}</small>
          </div>
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
        </section>

        </div>
      )}
    </DialogFrame>
  );
};
