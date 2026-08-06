'use client';

import React, { useState } from 'react';
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

  const handleCopyPalette = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!album.dominantPalette?.length) return;
    const hexes = album.dominantPalette.map((c) => c.hex).join(', ');
    navigator.clipboard.writeText(hexes);
    setCopiedPalette(true);
    setTimeout(() => setCopiedPalette(false), 2000);
  };

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl bg-[var(--bg-card)] ring-1 ring-[var(--border-color)] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5 hover:ring-[var(--text-muted)]/45 focus-within:ring-[var(--text-muted)]/60">
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
            className="transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-[1.03] group-focus-within:scale-[1.03]"
          />
        </Link>

        {/* Top Overlay Badges */}
        <div className="absolute top-2.5 right-2.5 flex items-center space-x-1 z-10">
          {similarity && onWhyMatchClick && (
            <button
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onWhyMatchClick(similarity);
              }}
              className="min-h-9 min-w-9 p-2 rounded bg-black/75 hover:bg-black text-white transition-colors"
              title={`Why ${album.title} is a match`}
              aria-label={`Why ${album.title} is a match`}
            >
              <Info className="w-3.5 h-3.5 theme-info" />
            </button>
          )}
          {matchPercentage !== null && (
            <span className="px-2 py-0.5 rounded bg-black/80 text-[11px] font-mono text-white">
              {matchPercentage}% match
            </span>
          )}
        </div>

        <button
          onClick={toggleSave}
          className="absolute top-2.5 left-2.5 min-h-9 min-w-9 p-2 rounded-full bg-black/60 hover:bg-black/85 text-white transition-colors z-10"
          title={isSaved ? 'Remove from saved' : 'Save cover'}
          aria-label={isSaved ? `Remove ${album.title} from saved` : `Save ${album.title}`}
        >
          {isSaved ? (
            <Check className="w-3.5 h-3.5 theme-success" />
          ) : (
            <Bookmark className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      <div className="p-3 sm:p-3.5 flex flex-col flex-1 justify-between space-y-3">
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
        <div className="flex flex-col items-stretch gap-2 pt-2 border-t border-[var(--border-color)]/30 sm:flex-row sm:items-center sm:justify-between sm:pt-1">
          {album.dominantPalette?.length ? (
            <div className="flex min-h-8 items-center space-x-1.5" aria-label="Extracted cover palette">
              <div className="flex -space-x-1.5">
                {album.dominantPalette.slice(0, 5).map((color, index) => (
                  <span
                    key={index}
                    className="w-3.5 h-3.5 rounded-full ring-1 ring-[var(--bg-card)]"
                    style={{ backgroundColor: color.hex }}
                    title={color.hex}
                  />
                ))}
              </div>
              <button
                onClick={handleCopyPalette}
                className="min-h-8 min-w-8 p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                title={copiedPalette ? 'Copied HEX codes!' : 'Copy palette HEX codes'}
                aria-label="Copy palette HEX codes"
              >
                {copiedPalette ? (
                  <Check className="w-3 h-3 theme-success" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            </div>
          ) : (
            <span />
          )}

          {showExploreButton && (
            <button
              onClick={handleExplore}
              className="min-h-9 w-full justify-center px-2.5 rounded-md bg-[var(--accent-editorial)] text-[11px] font-medium inline-flex items-center gap-1 shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:opacity-90 active:scale-[0.98] sm:min-h-7 sm:w-auto"
            >
              <span>View</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </article>
  );
};
