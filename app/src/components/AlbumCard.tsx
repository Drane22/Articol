'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Info, ArrowRight, Bookmark, Check, Copy } from 'lucide-react';
import { Album, SimilarityResult } from '../lib/types';
import { CoverArtwork } from './CoverArtwork';

interface AlbumCardProps {
  album: Album;
  similarity?: SimilarityResult;
  onWhyMatchClick?: (result: SimilarityResult) => void;
  showExploreButton?: boolean;
}

export const AlbumCard: React.FC<AlbumCardProps> = ({
  album,
  similarity,
  onWhyMatchClick,
  showExploreButton = true,
}) => {
  const router = useRouter();
  const [isSaved, setIsSaved] = useState(false);
  const [copiedPalette, setCopiedPalette] = useState(false);
  const matchPercentage = similarity ? Math.round(similarity.finalScore * 100) : null;
  const confidencePercentage = similarity ? Math.round(similarity.finalConfidence * 100) : null;

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('articol_saved_albums') || '[]');
      setIsSaved(saved.some((item: Album) => item.itunesCollectionId === album.itunesCollectionId));
    } catch (error) {
      console.warn('Saved album state could not be restored:', error);
    }
  }, [album.itunesCollectionId]);

  const toggleSave = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    try {
      const saved = JSON.parse(localStorage.getItem('articol_saved_albums') || '[]');
      const next = isSaved
        ? saved.filter((item: Album) => item.itunesCollectionId !== album.itunesCollectionId)
        : [...saved, album];
      localStorage.setItem('articol_saved_albums', JSON.stringify(next));
      setIsSaved(!isSaved);
    } catch (error) {
      console.warn('LocalStorage save failed:', error);
    }
  };

  const handleExplore = (event: React.MouseEvent) => {
    event.preventDefault();
    router.push(`/album/${album.itunesCollectionId}`);
  };

  const handleCopyPalette = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!album.dominantPalette?.length) return;
    const hexes = album.dominantPalette.map((c) => c.hex).join(', ');
    try {
      if (!navigator.clipboard?.writeText) return;
      await navigator.clipboard.writeText(hexes);
      setCopiedPalette(true);
      window.setTimeout(() => setCopiedPalette(false), 2000);
    } catch (error) {
      console.warn('Palette copy failed:', error);
    }
  };

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl bg-[var(--bg-card)] ring-1 ring-[var(--border-color)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 focus-within:ring-[var(--text-muted)]/60">
      <div className="relative aspect-square w-full overflow-hidden bg-[var(--accent-soft)]">
        <Link
          href={`/album/${album.itunesCollectionId}`}
          className="absolute inset-0 z-0"
          aria-label={`Open ${album.title} by ${album.artistName}`}
        >
          <CoverArtwork
            src={album.artworkUrl}
            alt={`Cover artwork for ${album.title} by ${album.artistName}`}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            className="transition-transform duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03] group-focus-within:scale-[1.03]"
          />
        </Link>

        {/* Overlay Actions and Match Score */}
        <div className="pointer-events-none absolute inset-0 z-20">
          {similarity && onWhyMatchClick && (
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onWhyMatchClick(similarity);
              }}
              className="card-icon-button pointer-events-auto absolute right-3 top-3 bg-black/70 text-white hover:bg-black/90"
              title={`Why ${album.title} is a match`}
              aria-label={`Why ${album.title} is a match`}
            >
              <Info className="h-4 w-4 theme-info" strokeWidth={1.6} />
            </button>
          )}
          {matchPercentage !== null && (
            <span className="absolute bottom-3 left-3 max-w-[calc(100%-1.5rem)] truncate rounded-full bg-black/75 px-2.5 py-1 text-[10px] font-mono text-white">
              {matchPercentage}% match{confidencePercentage !== null && <span className="text-white/55"> · {confidencePercentage}% trusted</span>}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={toggleSave}
          className="card-icon-button absolute left-3 top-3 z-20 bg-black/70 text-white hover:bg-black/90"
          title={isSaved ? 'Remove from saved' : 'Save cover'}
          aria-label={isSaved ? `Remove ${album.title} from saved` : `Save ${album.title}`}
        >
          {isSaved ? (
            <Check className="h-4 w-4 theme-success" strokeWidth={1.8} />
          ) : (
            <Bookmark className="h-4 w-4" strokeWidth={1.6} />
          )}
        </button>
      </div>

      <div className="flex flex-1 flex-col justify-between space-y-3 p-3 sm:p-3.5">
        <div>
          <Link
            href={`/album/${album.itunesCollectionId}`}
            className="block hover:text-[var(--accent-info)] transition-colors"
          >
            <h4 className="text-sm font-serif font-semibold truncate leading-tight text-[var(--text-primary)]">
              {album.title}
            </h4>
          </Link>
          <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">{album.artistName}</p>
          <p className="text-[10px] uppercase font-mono tracking-wider text-[var(--text-muted)] mt-2">
            {album.genre} · {album.releaseYear}
          </p>
        </div>

        {similarity?.matchReasons?.length ? (
          <div className="flex flex-wrap gap-1">
            {similarity.matchReasons.slice(0, 2).map((reason, index) => (
              <span
                key={index}
                className="text-[10px] px-2 py-0.5 rounded bg-[var(--tag-bg)] text-[var(--text-muted)] font-mono truncate max-w-full"
              >
                {reason.label}
              </span>
            ))}
          </div>
        ) : null}

        {/* Clean Non-Overlapping Footer */}
        <div className="flex flex-col gap-2 border-t border-[var(--border-color)]/30 pt-3 sm:flex-row sm:items-center sm:justify-between">
          {album.dominantPalette?.length ? (
            <div className="flex min-h-11 items-center justify-between gap-2" aria-label="Extracted cover palette">
              <div className="flex items-center gap-1.5">
                {album.dominantPalette.slice(0, 5).map((color, index) => (
                  <span
                    key={index}
                    className="h-4 w-4 rounded-full ring-1 ring-[var(--bg-card)]"
                    style={{ backgroundColor: color.hex }}
                    title={color.hex}
                  />
                ))}
              </div>
            <button
              type="button"
              onClick={(event) => void handleCopyPalette(event)}
                className="card-icon-button card-icon-button--light"
                title={copiedPalette ? 'Copied HEX codes!' : 'Copy palette HEX codes'}
                aria-label="Copy palette HEX codes"
              >
                {copiedPalette ? (
                  <Check className="h-3.5 w-3.5 theme-success" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          ) : (
            <span />
          )}

          {showExploreButton && (
            <button
              type="button"
              onClick={handleExplore}
              className="card-view-button"
            >
              <span>View</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </article>
  );
};
