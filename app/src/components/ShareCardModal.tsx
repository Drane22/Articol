'use client';

import React, { useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, Share2, X } from 'lucide-react';
import { Album } from '@/lib/types';
import { formatStorePrice, getStorefront } from '@/lib/storefronts';
import { CoverArtwork } from './CoverArtwork';

interface ShareCardModalProps {
  album: Album;
  shareUrl: string;
  copied: boolean;
  onCopyLink: () => void;
  onClose: () => void;
}

export function ShareCardModal({ album, shareUrl, copied, onCopyLink, onClose }: ShareCardModalProps) {
  const [isSharing, setIsSharing] = useState(false);
  const [shareError, setShareError] = useState(false);
  const storefront = getStorefront(album.country);
  const formattedPrice = formatStorePrice(album.price, album.currency, album.country);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleNativeShare = async () => {
    if (typeof navigator === 'undefined' || !navigator.share) {
      onCopyLink();
      return;
    }

    setIsSharing(true);
    setShareError(false);
    try {
      await navigator.share({
        title: `${album.title} — ${album.artistName}`,
        text: `Explore ${album.title} by ${album.artistName} on Articol.`,
        url: shareUrl,
      });
    } catch (error) {
      if ((error as DOMException)?.name !== 'AbortError') setShareError(true);
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-card-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border-color)] px-4 py-3 sm:px-5">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-muted)]">Share card</p>
            <h2 id="share-card-title" className="mt-1 font-serif text-xl text-[var(--text-primary)]">Share this artwork</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--text-primary)]"
            aria-label="Close share card"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6">
          <div className="overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-canvas)]">
            <div className="relative aspect-[1.91/1] overflow-hidden bg-[var(--accent-soft)]">
              <CoverArtwork src={album.artworkUrl} alt="" priority sizes="(max-width: 640px) calc(100vw - 2rem), 540px" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-4 text-white sm:p-5">
                <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/70">articol · visual album discovery</p>
                <h3 className="mt-2 line-clamp-2 font-serif text-2xl leading-tight sm:text-3xl">{album.title}</h3>
                <p className="mt-1 truncate text-sm text-white/75">{album.artistName}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex shrink-0 gap-1">
                  {album.dominantPalette.slice(0, 5).map((color, index) => (
                    <span
                      key={`${color.hex}-${index}`}
                      className="h-4 w-4 rounded-full border theme-swatch-border"
                      style={{ backgroundColor: color.hex }}
                    />
                  ))}
                </div>
                <span className="truncate text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
                  {storefront.label} · {album.releaseYear}
                </span>
              </div>
              {formattedPrice && <span className="shrink-0 text-xs font-medium text-[var(--text-primary)]">{formattedPrice}</span>}
            </div>
          </div>

          <p className="mt-3 truncate text-[11px] text-[var(--text-muted)]" title={shareUrl}>{shareUrl}</p>

          <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={handleNativeShare}
              disabled={isSharing}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--accent-editorial)] px-4 text-xs font-semibold text-[var(--bg-canvas)] transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
            >
              <Share2 className="h-4 w-4" />
              <span>{isSharing ? 'Opening share…' : 'Share card'}</span>
            </button>
            <button
              type="button"
              onClick={onCopyLink}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[var(--border-color)] px-4 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--accent-soft)]"
            >
              {copied ? <Check className="h-4 w-4 theme-success" /> : <Copy className="h-4 w-4" />}
              <span>{copied ? 'Link copied' : 'Copy link'}</span>
            </button>
          </div>
          {shareError && <p className="mt-3 text-center text-xs theme-danger">Sharing was cancelled or unavailable. You can copy the link instead.</p>}
          <a href={shareUrl} className="mt-4 inline-flex w-full items-center justify-center gap-1 text-[11px] text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]" target="_blank" rel="noopener noreferrer">
            Open shared page <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
