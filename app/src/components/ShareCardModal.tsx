'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, ExternalLink, Share2, X } from 'lucide-react';
import { Album } from '@/lib/types';
import { formatStorePrice, getStorefront } from '@/lib/storefronts';

interface ShareCardModalProps {
  album: Album;
  shareUrl: string;
  shareImageUrl: string;
  copied: boolean;
  onCopyLink: () => Promise<boolean>;
  onClose: () => void;
}

export function ShareCardModal({
  album,
  shareUrl,
  shareImageUrl,
  copied,
  onCopyLink,
  onClose,
}: ShareCardModalProps) {
  const [isSharing, setIsSharing] = useState(false);
  const [shareError, setShareError] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const closeTimerRef = useRef<number | null>(null);
  const storefront = getStorefront(album.country);
  const formattedPrice = formatStorePrice(album.price, album.currency, album.country);

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

  useEffect(() => () => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
  }, []);

  const requestClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    closeTimerRef.current = window.setTimeout(() => onCloseRef.current(), 160);
  };

  const handleNativeShare = async () => {
    if (typeof navigator === 'undefined' || !navigator.share) {
      const copiedFallback = await onCopyLink();
      setShareError(!copiedFallback);
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

  const handleCopyLink = async () => {
    const copiedLink = await onCopyLink();
    setShareError(!copiedLink);
  };

  return (
    <div
      className={`share-dialog-backdrop${isClosing ? ' is-closing' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-card-title"
      aria-describedby="share-card-description"
      onClick={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <section className={`share-dialog-panel${isClosing ? ' is-closing' : ''}`}>
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border-color)] px-4 py-4 sm:px-6">
          <div>
            <p className="eyebrow-label">Share card</p>
            <h2 id="share-card-title" className="mt-1 font-serif text-2xl text-[var(--text-primary)]">Share this artwork</h2>
            <p id="share-card-description" className="mt-1 text-xs text-[var(--text-muted)]">The preview below is the image social platforms will receive.</p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={requestClose}
            className="icon-button icon-button--quiet shrink-0"
            aria-label="Close share card"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[calc(100dvh-5rem)] overflow-y-auto p-4 sm:p-6">
          <div className="share-preview-shell">
            {previewError ? (
              <div className="share-preview-fallback">
                <p className="eyebrow-label">Preview unavailable</p>
                <p className="mt-2 max-w-xs text-sm text-[var(--text-muted)]">The link is still ready to share. Open the page to view the artwork.</p>
              </div>
            ) : (
              <img
                src={shareImageUrl}
                alt={`Share preview for ${album.title} by ${album.artistName}`}
                className="share-preview-image"
                onError={() => setPreviewError(true)}
              />
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border-color)] bg-[var(--accent-soft)]/45 px-4 py-3">
            <div className="min-w-0">
              <p className="eyebrow-label">Extracted palette</p>
              <div className="mt-2 flex items-center gap-1.5" aria-label="Extracted cover palette">
                {(album.dominantPalette?.length ? album.dominantPalette : []).slice(0, 5).map((color, index) => (
                  <span
                    key={`${color.hex}-${index}`}
                    className="h-6 w-6 rounded-full border theme-swatch-border shadow-[inset_0_1px_1px_rgba(255,255,255,0.25)]"
                    style={{ backgroundColor: color.hex }}
                    title={color.hex}
                  />
                ))}
                {!album.dominantPalette?.length && <span className="text-xs text-[var(--text-muted)]">Palette not indexed yet</span>}
              </div>
            </div>
            <div className="text-right text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
              <span>{storefront.label}</span>
              <span className="mx-1.5 opacity-50">·</span>
              <span>{album.releaseYear}</span>
              {formattedPrice && <span className="ml-2 text-[var(--text-primary)]">{formattedPrice}</span>}
            </div>
          </div>

          <p className="mt-3 truncate text-[11px] text-[var(--text-muted)]" title={shareUrl}>{shareUrl}</p>

          <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => void handleNativeShare()}
              disabled={isSharing}
              className="premium-button premium-button--primary"
            >
              <Share2 className="h-4 w-4" />
              <span>{isSharing ? 'Opening share…' : 'Share card'}</span>
            </button>
            <button
              type="button"
              onClick={() => void handleCopyLink()}
              className="premium-button premium-button--secondary"
            >
              {copied ? <Check className="h-4 w-4 theme-success" /> : <Copy className="h-4 w-4" />}
              <span>{copied ? 'Link copied' : 'Copy link'}</span>
            </button>
          </div>
          {shareError && <p className="mt-3 text-center text-xs theme-danger" role="alert">Sharing was unavailable. You can copy the link instead.</p>}
          <a href={shareUrl} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-1 text-[11px] text-[var(--text-muted)] transition-colors duration-200 hover:text-[var(--text-primary)]" target="_blank" rel="noopener noreferrer">
            Open shared page <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </section>
    </div>
  );
}
