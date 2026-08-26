'use client';

import React, { useEffect, useState } from 'react';
import { Check, Copy, Download, ExternalLink, Image as ImageIcon, Share2, X } from 'lucide-react';
import { DialogFrame } from '@/components/DialogFrame';
import {
  getAlbumPortraitShareImagePath,
  getAlbumShareFilename,
  isShareCancellation,
  supportsNativeFileShare,
} from '@/lib/share';
import { Album } from '@/lib/types';
import { getStorefront } from '@/lib/storefronts';
import {
  DEFAULT_PALETTE_ART_STYLE,
  getPaletteArtStyleLabel,
  PALETTE_ART_STYLES,
  type PaletteArtStyle,
} from '@/lib/paletteArtwork';

interface ShareCardModalProps {
  album: Album;
  shareUrl: string;
  portraitImageUrl: string;
  copied: boolean;
  onCopyLink: () => Promise<boolean>;
  onClose: () => void;
}

type ShareAction = 'idle' | 'sharing';
type AssetState = 'loading' | 'ready' | 'error';

interface ShareStatus {
  message: string;
  tone: 'success' | 'error';
}

async function fetchPortraitFile(url: string, filename: string, signal?: AbortSignal): Promise<File> {
  const response = await fetch(url, { cache: 'no-store', signal });
  if (!response.ok) throw new Error(`Portrait card request failed (${response.status})`);
  const blob = await response.blob();
  return new File([blob], filename, { type: blob.type || 'image/png' });
}

function downloadFile(file: File) {
  const objectUrl = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = file.name;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

export function ShareCardModal({
  album,
  shareUrl,
  portraitImageUrl,
  copied,
  onCopyLink,
  onClose,
}: ShareCardModalProps) {
  const [action, setAction] = useState<ShareAction>('idle');
  const [assetState, setAssetState] = useState<AssetState>('loading');
  const [portraitFile, setPortraitFile] = useState<File | null>(null);
  const [status, setStatus] = useState<ShareStatus | null>(null);
  const [previewError, setPreviewError] = useState(false);
  const [portraitVariant, setPortraitVariant] = useState<'cover' | 'palette'>('cover');
  const [paletteStyle, setPaletteStyle] = useState<PaletteArtStyle>(DEFAULT_PALETTE_ART_STYLE);
  const storefront = getStorefront(album.country);
  const portraitAssetUrl = portraitVariant === 'palette'
    ? getAlbumPortraitShareImagePath(album.id, album.country, { variant: 'palette', style: paletteStyle })
    : portraitImageUrl;
  const filename = getAlbumShareFilename(
    album.title,
    album.artistName,
    portraitVariant === 'palette' ? `palette-${paletteStyle}` : undefined,
  );
  const isBusy = action !== 'idle';
  const isPaletteArtwork = portraitVariant === 'palette';
  const artworkLabel = isPaletteArtwork ? `${getPaletteArtStyleLabel(paletteStyle)} palette artwork` : 'portrait card';

  useEffect(() => {
    const controller = new AbortController();
    setAssetState('loading');
    setPortraitFile(null);
    setPreviewError(false);
    setStatus(null);
    fetchPortraitFile(portraitAssetUrl, filename, controller.signal)
      .then((file) => {
        setPortraitFile(file);
        setAssetState('ready');
      })
      .catch((error) => {
        if ((error as DOMException)?.name === 'AbortError') return;
        setAssetState('error');
        setStatus({
          tone: 'error',
          message: `The ${artworkLabel} could not be prepared. You can still copy and share the album link.`,
        });
      });

    return () => controller.abort();
  }, [filename, portraitAssetUrl]);

  const handleSharePortrait = async () => {
    if (isBusy || !portraitFile) {
      if (assetState === 'loading') {
        setStatus({ tone: 'error', message: `The ${artworkLabel} is still being prepared. Try again in a moment.` });
      }
      return;
    }
    setAction('sharing');
    setStatus(null);

    try {
      if (supportsNativeFileShare(navigator, [portraitFile])) {
        try {
          await navigator.share({
            files: [portraitFile],
            title: `${album.title} — ${album.artistName}`,
            text: `Artwork card for ${album.title} by ${album.artistName}, discovered on Articol.`,
          });
        } catch (error) {
          if (isShareCancellation(error)) return;
          downloadFile(portraitFile);
          setStatus({
            tone: 'success',
            message: `The share sheet was unavailable, so the ${artworkLabel} was downloaded for Photos or Gallery.`,
          });
        }
      } else {
        downloadFile(portraitFile);
        setStatus({
          tone: 'success',
          message: `${artworkLabel} downloaded. Post it from Photos or Gallery on Instagram or another app.`,
        });
      }
    } catch {
      setStatus({
        tone: 'error',
        message: `The ${artworkLabel} could not be prepared. You can still copy and share the album link.`,
      });
    } finally {
      setAction('idle');
    }
  };

  const handleDownload = async () => {
    if (isBusy || !portraitFile) return;
    setStatus(null);
    downloadFile(portraitFile);
    setStatus({ tone: 'success', message: `${artworkLabel} downloaded to this device.` });
  };

  const handleCopyLink = async () => {
    const copiedLink = await onCopyLink();
    setStatus(copiedLink ? null : { tone: 'error', message: 'The link could not be copied on this browser.' });
  };

  return (
    <DialogFrame
      ariaLabelledBy="share-card-title"
      ariaDescribedBy="share-card-description"
      onClose={onClose}
      panelClassName="share-studio"
    >
      {({ closeButtonRef, requestClose }) => (
        <>
          <header className="share-studio__header">
            <div className="min-w-0">
              <p className="eyebrow-label">Share studio</p>
              <h2 id="share-card-title" className="share-studio__title">Publish this artwork</h2>
              <p id="share-card-description" className="share-studio__description">
                A portrait image for social posts, plus a polished album link for everywhere else.
              </p>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={requestClose}
              className="icon-button icon-button--quiet shrink-0"
              aria-label="Close Share Studio"
            >
              <X className="h-5 w-5" strokeWidth={1.5} />
            </button>
          </header>

          <div className="share-studio__layout">
            <section className="share-studio__preview-column" aria-label="Portrait share-card preview">
              <div className="share-studio__preview-bezel">
                <div className="share-preview-shell share-preview-shell--portrait">
                  {previewError ? (
                    <div className="share-preview-fallback">
                      <ImageIcon className="h-7 w-7" strokeWidth={1.4} aria-hidden="true" />
                      <p className="eyebrow-label mt-4">Preview unavailable</p>
                      <p className="mt-2 max-w-xs text-sm text-[var(--text-muted)]">
                        The album link remains ready to share.
                      </p>
                    </div>
                  ) : (
                    <img
                      src={portraitAssetUrl}
                      alt={`${artworkLabel} for ${album.title} by ${album.artistName}`}
                      className="share-preview-image"
                      onError={() => setPreviewError(true)}
                    />
                  )}
                </div>
              </div>
              <div className="share-studio__preview-caption">
                <span>{isPaletteArtwork ? 'Palette art portrait' : 'Post-ready portrait'}</span>
                <span>1080 × 1350 · PNG</span>
              </div>
            </section>

            <aside className="share-studio__tools" aria-label="Sharing formats and actions">
              <section className="share-artwork-mode" aria-labelledby="share-artwork-mode-title">
                <div className="share-artwork-mode__heading">
                  <p id="share-artwork-mode-title" className="eyebrow-label">Portrait artwork</p>
                  <span>Choose the image, not the link.</span>
                </div>

                <div className="share-artwork-mode__options" role="radiogroup" aria-label="Portrait artwork source">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={!isPaletteArtwork}
                    disabled={isBusy}
                    className={`share-artwork-mode__option${!isPaletteArtwork ? ' is-selected' : ''}`}
                    onClick={() => setPortraitVariant('cover')}
                  >
                    <span className="share-artwork-mode__option-mark">COVER</span>
                    <span className="share-artwork-mode__option-copy">
                      <strong>Album cover</strong>
                      <small>Original artwork and metadata</small>
                    </span>
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={isPaletteArtwork}
                    disabled={isBusy}
                    className={`share-artwork-mode__option${isPaletteArtwork ? ' is-selected' : ''}`}
                    onClick={() => setPortraitVariant('palette')}
                  >
                    <span className="share-artwork-mode__option-mark">ART</span>
                    <span className="share-artwork-mode__option-copy">
                      <strong>Palette art</strong>
                      <small>Generated from all available colors</small>
                    </span>
                  </button>
                </div>

                {isPaletteArtwork && (
                  <div className="share-artwork-styles" role="radiogroup" aria-label="Palette art style">
                    {PALETTE_ART_STYLES.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        role="radio"
                        aria-checked={paletteStyle === option.id}
                        disabled={isBusy}
                        className={`share-artwork-style${paletteStyle === option.id ? ' is-selected' : ''}`}
                        onClick={() => setPaletteStyle(option.id)}
                      >
                        <span className={`share-artwork-style__preview share-artwork-style__preview--${option.id}`} aria-hidden="true" />
                        <span className="share-artwork-style__copy">
                          <strong>{option.label}</strong>
                          <small>{option.description}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </section>

              <section className="share-format-panel" aria-labelledby="share-format-title">
                <div className="share-format-panel__heading">
                  <p id="share-format-title" className="eyebrow-label">Two ways to share</p>
                  <span>One album, two useful outputs.</span>
                </div>

                <div className="share-format-panel__rows">
                  <div className="share-format-row">
                    <span className="share-format-row__kind">POST</span>
                    <div className="share-format-row__copy">
                      <strong>4:5 portrait</strong>
                      <span>For sharing the artwork itself.</span>
                    </div>
                    <span className="share-format-row__badge">1080 × 1350</span>
                  </div>

                  <div className="share-format-row">
                    <span className="share-format-row__kind">LINK</span>
                    <div className="share-format-row__copy">
                      <strong>Social preview</strong>
                      <span>For album links. Applied automatically.</span>
                    </div>
                    <span className="share-format-row__badge">1200 × 630</span>
                  </div>
                </div>
              </section>

              <div className="share-format-card share-format-card--featured">
                <span className="share-format-card__icon" aria-hidden="true">
                  <ImageIcon className="h-4 w-4" strokeWidth={1.5} />
                </span>
                <div>
                  <strong>4:5 portrait</strong>
                  <span>4:5 portrait · safe for feeds and other image-first platforms</span>
                </div>
              </div>

              <div className="share-format-card">
                <span className="share-format-card__icon" aria-hidden="true">
                  <ExternalLink className="h-4 w-4" strokeWidth={1.5} />
                </span>
                <div>
                  <strong>Social-link preview</strong>
                  <span>1200 × 630 · used automatically when this album link is posted</span>
                </div>
              </div>

              <div className="share-studio__metadata">
                <div>
                  <p className="eyebrow-label">Artwork palette</p>
                  <div className="share-studio__swatches" aria-label="Extracted cover palette">
                    {(album.dominantPalette || []).slice(0, 10).map((color, index) => (
                      <span
                        key={`${color.hex}-${index}`}
                        style={{ backgroundColor: color.hex }}
                        title={color.hex}
                      />
                    ))}
                    {!album.dominantPalette?.length && <small>Neutral fallback</small>}
                  </div>
                </div>
                <p className="share-studio__archive-line">
                  {storefront.label}<span aria-hidden="true">·</span>{album.releaseYear || 'Year unavailable'}
                </p>
              </div>

              <div className="share-studio__actions">
                <button
                  type="button"
                  onClick={() => void handleSharePortrait()}
                  disabled={isBusy || assetState !== 'ready'}
                  className="premium-button premium-button--primary share-studio__primary-action"
                >
                  <span>{assetState === 'loading' ? 'Preparing image…' : action === 'sharing' ? 'Opening share sheet…' : isPaletteArtwork ? 'Share palette artwork' : 'Share portrait card'}</span>
                  <span className="premium-button__island" aria-hidden="true">
                    <Share2 className="h-4 w-4" strokeWidth={1.5} />
                  </span>
                </button>
                <div className="share-studio__secondary-actions">
                  <button
                    type="button"
                    onClick={() => void handleDownload()}
                    disabled={isBusy || assetState !== 'ready'}
                    className="premium-button premium-button--secondary"
                  >
                    <Download className="h-4 w-4" strokeWidth={1.5} />
                    <span>{isPaletteArtwork ? 'Download palette art' : 'Download image'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCopyLink()}
                    className="premium-button premium-button--secondary"
                  >
                    {copied
                      ? <Check className="h-4 w-4 theme-success" strokeWidth={1.5} />
                      : <Copy className="h-4 w-4" strokeWidth={1.5} />}
                    <span>{copied ? 'Link copied' : 'Copy album link'}</span>
                  </button>
                </div>
              </div>

              {status && (
                <p
                  className={`share-studio__status share-studio__status--${status.tone}`}
                  role={status.tone === 'error' ? 'alert' : 'status'}
                  aria-live="polite"
                >
                  {status.message}
                </p>
              )}

              <a
                href={shareUrl}
                className="share-studio__open-link"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open shared album page <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} />
              </a>
            </aside>
          </div>
        </>
      )}
    </DialogFrame>
  );
}
