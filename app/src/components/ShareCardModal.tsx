'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Image as ImageIcon,
  LoaderCircle,
  RefreshCw,
  Share2,
  X,
} from 'lucide-react';
import { DialogFrame } from '@/components/DialogFrame';
import { PaletteArtCanvas } from '@/components/PaletteArtCanvas';
import {
  getAlbumPortraitShareImagePath,
  getAlbumShareFilename,
  isShareCancellation,
  supportsNativeFileShare,
} from '@/lib/share';
import { Album } from '@/lib/types';
import {
  buildPaletteArtModel,
  DEFAULT_PALETTE_ART_STYLE,
  getPaletteArtStyleLabel,
  MAX_DISPLAY_ART_COLORS,
  PALETTE_ART_STYLES,
  parsePaletteInputColors,
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
type AssetState = 'initial-loading' | 'regenerating' | 'ready' | 'error';
type PortraitVariant = 'cover' | 'palette';

interface ShareStatus {
  message: string;
  tone: 'success' | 'error';
}

interface DisplayedAsset {
  file: File;
  previewUrl: string;
  selectionKey: string;
  variant: PortraitVariant;
  style?: PaletteArtStyle;
}

interface RequestedAsset {
  variant: PortraitVariant;
  style: PaletteArtStyle;
}

const GENERATION_MESSAGES = [
  'Teaching these colors to cooperate.',
  'Measuring coverage and chroma across the palette.',
  'Calibrating perceptual lightness and contrast.',
  'Synthesizing generative geometry from cover data.',
  'Rendering full-resolution 1080x1350 artwork.',
];

function selectionKey(variant: PortraitVariant, style: PaletteArtStyle): string {
  return variant === 'palette' ? `palette:${style}` : 'cover';
}

function artworkLabel(variant: PortraitVariant, style?: PaletteArtStyle): string {
  return variant === 'palette' && style
    ? `${getPaletteArtStyleLabel(style)} palette artwork`
    : 'portrait card';
}

async function fetchPortraitFile(url: string, filename: string, signal?: AbortSignal): Promise<File> {
  const response = await fetch(url, { cache: 'no-store', signal });
  if (!response.ok) throw new Error(`Portrait card request failed (${response.status})`);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().startsWith('image/')) {
    throw new Error(`Portrait card returned ${contentType || 'an unknown file type'}`);
  }
  const blob = await response.blob();
  if (blob.size === 0) throw new Error('Portrait card returned an empty image');
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
  const [assetState, setAssetState] = useState<AssetState>('initial-loading');
  const [displayedAsset, setDisplayedAsset] = useState<DisplayedAsset | null>(null);
  const [failedAsset, setFailedAsset] = useState<RequestedAsset | null>(null);
  const [status, setStatus] = useState<ShareStatus | null>(null);
  const [requestedVariant, setRequestedVariant] = useState<PortraitVariant>('cover');
  const [requestedStyle, setRequestedStyle] = useState<PaletteArtStyle>(DEFAULT_PALETTE_ART_STYLE);
  const [retryNonce, setRetryNonce] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);
  const activeRequestId = useRef(0);
  const previewUrlRef = useRef<string | null>(null);
  const displayedAssetRef = useRef<DisplayedAsset | null>(null);

  const albumColors = useMemo(() => {
    return parsePaletteInputColors(album.dominantPalette);
  }, [album.dominantPalette]);

  const activeModel = useMemo(() => {
    return buildPaletteArtModel(albumColors, album.id || 'seed', requestedStyle, album.visualFeatures);
  }, [albumColors, album.id, requestedStyle, album.visualFeatures]);

  const requestedSelectionKey = selectionKey(requestedVariant, requestedStyle);
  const requestedAssetUrl = requestedVariant === 'palette'
    ? getAlbumPortraitShareImagePath(album.id, album.country, {
      variant: 'palette',
      style: requestedStyle,
      album: {
        title: album.title,
        artistName: album.artistName,
        releaseYear: album.releaseYear,
        palette: albumColors,
      },
    })
    : portraitImageUrl;
  const requestedFilename = getAlbumShareFilename(
    album.title,
    album.artistName,
    requestedVariant === 'palette' ? `palette-${requestedStyle}` : undefined,
  );
  const requestedLabel = artworkLabel(requestedVariant, requestedStyle);
  const displayedLabel = displayedAsset
    ? artworkLabel(displayedAsset.variant, displayedAsset.style)
    : requestedLabel;
  const displayedIsPalette = displayedAsset?.variant === 'palette';
  const isSharing = action !== 'idle';
  const isAssetPending = assetState === 'initial-loading' || assetState === 'regenerating';
  const imageActionsDisabled = isSharing || isAssetPending || !displayedAsset;

  useEffect(() => {
    const requestId = activeRequestId.current + 1;
    activeRequestId.current = requestId;
    const currentAsset = displayedAssetRef.current;
    if (currentAsset?.selectionKey === requestedSelectionKey) {
      setAssetState('ready');
      return undefined;
    }

    const controller = new AbortController();
    const previousAsset = currentAsset;
    setAssetState(previousAsset ? 'regenerating' : 'initial-loading');
    setMessageIndex(0);
    setStatus(null);
    setFailedAsset(null);

    fetchPortraitFile(requestedAssetUrl, requestedFilename, controller.signal)
      .then((file) => {
        if (activeRequestId.current !== requestId) return;
        const previewUrl = URL.createObjectURL(file);
        const previousPreviewUrl = previewUrlRef.current;
        previewUrlRef.current = previewUrl;
        if (previousPreviewUrl) URL.revokeObjectURL(previousPreviewUrl);
        const nextAsset: DisplayedAsset = {
          file,
          previewUrl,
          selectionKey: requestedSelectionKey,
          variant: requestedVariant,
          style: requestedVariant === 'palette' ? requestedStyle : undefined,
        };
        displayedAssetRef.current = nextAsset;
        setDisplayedAsset(nextAsset);
        setAssetState('ready');
        setStatus(null);
      })
      .catch((error) => {
        if ((error as DOMException)?.name === 'AbortError' || activeRequestId.current !== requestId) return;
        setAssetState('error');
        setFailedAsset({ variant: requestedVariant, style: requestedStyle });
        if (previousAsset) {
          setRequestedVariant(previousAsset.variant);
          if (previousAsset.style) setRequestedStyle(previousAsset.style);
          setStatus({
            tone: 'error',
            message: `${requestedLabel} could not be generated. The last finished design is still ready to share.`,
          });
        } else {
          setStatus({
            tone: 'error',
            message: `${requestedLabel} could not be generated. The album link remains ready to share.`,
          });
        }
      });

    return () => controller.abort();
  }, [requestedAssetUrl, requestedFilename, requestedSelectionKey, retryNonce]);

  useEffect(() => {
    if (!isAssetPending) return undefined;
    const interval = window.setInterval(() => {
      setMessageIndex((current) => (current + 1) % GENERATION_MESSAGES.length);
    }, 2800);
    return () => window.clearInterval(interval);
  }, [isAssetPending]);

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    displayedAssetRef.current = null;
  }, []);

  const handleSharePortrait = async () => {
    if (imageActionsDisabled || !displayedAsset) return;
    setAction('sharing');
    setStatus(null);

    try {
      if (supportsNativeFileShare(navigator, [displayedAsset.file])) {
        try {
          await navigator.share({
            files: [displayedAsset.file],
            title: `${album.title} - ${album.artistName}`,
            text: `Artwork card for ${album.title} by ${album.artistName}, discovered on Articol.`,
          });
        } catch (error) {
          if (isShareCancellation(error)) return;
          downloadFile(displayedAsset.file);
          setStatus({
            tone: 'success',
            message: `The share sheet was unavailable, so the ${displayedLabel} was downloaded for Photos or Gallery.`,
          });
        }
      } else {
        downloadFile(displayedAsset.file);
        setStatus({
          tone: 'success',
          message: `${displayedLabel} downloaded. Post it from Photos or Gallery on Instagram or another app.`,
        });
      }
    } catch {
      setStatus({
        tone: 'error',
        message: `The ${displayedLabel} could not be shared. You can still copy the album link.`,
      });
    } finally {
      setAction('idle');
    }
  };

  const handleDownload = () => {
    if (imageActionsDisabled || !displayedAsset) return;
    setStatus(null);
    downloadFile(displayedAsset.file);
    setStatus({ tone: 'success', message: `${displayedLabel} downloaded to this device.` });
  };

  const handleCopyLink = async () => {
    const copiedLink = await onCopyLink();
    setStatus(copiedLink ? null : { tone: 'error', message: 'The link could not be copied on this browser.' });
  };

  const retryGeneration = () => {
    setStatus(null);
    if (failedAsset) {
      setRequestedVariant(failedAsset.variant);
      setRequestedStyle(failedAsset.style);
    }
    setRetryNonce((current) => current + 1);
  };

  return (
    <DialogFrame
      ariaLabelledBy="share-card-title"
      onClose={onClose}
      panelClassName="share-studio"
    >
      {({ closeButtonRef, requestClose }) => (
        <>
          <header className="share-studio__header">
            <div className="min-w-0">
              <h2 id="share-card-title" className="share-studio__title">Share artwork</h2>
              <p className="share-studio__description">{album.title} by {album.artistName}</p>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={requestClose}
              className="icon-button icon-button--quiet shrink-0"
              aria-label="Close share artwork"
            >
              <X className="h-5 w-5" strokeWidth={1.5} />
            </button>
          </header>

          <div className="share-studio__layout">
            <section
              className="share-studio__preview-column"
              aria-label="Portrait share-card preview"
              aria-busy={isAssetPending}
            >
              <div className="share-studio__preview-bezel">
                <div className="share-preview-shell share-preview-shell--portrait">
                  {!displayedAsset && assetState === 'initial-loading' && (
                    <div className="share-preview-loading" role="status" aria-live="polite">
                      <div className="share-preview-loading__art" aria-hidden="true">
                        <div className="share-preview-loading__orbit" />
                        {albumColors.slice(0, MAX_DISPLAY_ART_COLORS).map((color, index) => (
                          <span
                            key={`${color.hex}-${index}`}
                            className="share-preview-loading__color"
                            style={{
                              backgroundColor: color.hex,
                              width: `${24 + (index % 4) * 9}%`,
                              height: `${24 + ((index + 2) % 4) * 8}%`,
                              left: `${8 + (index * 17) % 70}%`,
                              top: `${8 + (index * 23) % 68}%`,
                              animationDelay: `${index * -120}ms`,
                            }}
                          />
                        ))}
                      </div>
                      <div className="share-preview-loading__meta" aria-hidden="true">
                        <span />
                        <span />
                        <div>
                          {albumColors.slice(0, MAX_DISPLAY_ART_COLORS).map((color) => (
                            <i key={color.hex} style={{ backgroundColor: color.hex }} />
                          ))}
                        </div>
                      </div>
                      <p>{GENERATION_MESSAGES[messageIndex]}</p>
                    </div>
                  )}

                  {!displayedAsset && assetState === 'error' && (
                    <div className="share-preview-fallback">
                      <ImageIcon className="h-7 w-7" strokeWidth={1.4} aria-hidden="true" />
                      <p className="eyebrow-label mt-4">Generation stalled</p>
                      <p className="mt-2 max-w-xs text-sm text-[var(--text-muted)]">
                        Apparently the colors have unionized.
                      </p>
                      <button type="button" className="share-preview-retry" onClick={retryGeneration}>
                        <RefreshCw className="h-4 w-4" strokeWidth={1.5} /> Retry image
                      </button>
                    </div>
                  )}

                  {displayedAsset && (
                    <>
                      <img
                        src={displayedAsset.previewUrl}
                        alt={`${displayedLabel} for ${album.title} by ${album.artistName}`}
                        className="share-preview-image"
                        onError={() => setStatus({ tone: 'error', message: 'The prepared image could not be displayed. Try generating it again.' })}
                      />
                      {assetState === 'regenerating' && (
                        <div className="share-preview-regenerating" role="status" aria-live="polite">
                          <div className="share-preview-regenerating__veil" aria-hidden="true">
                            {albumColors.slice(0, MAX_DISPLAY_ART_COLORS).map((color, index) => (
                              <span key={`${color.hex}-${index}`} style={{ backgroundColor: color.hex }} />
                            ))}
                            <i />
                          </div>
                          <p>{GENERATION_MESSAGES[messageIndex]}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div className="share-studio__preview-caption">
                <span>
                  {displayedAsset
                    ? displayedIsPalette ? getPaletteArtStyleLabel(displayedAsset.style!) : 'Post-ready portrait'
                    : isAssetPending ? 'Generating portrait' : 'Portrait unavailable'}
                </span>
                <span>1080 x 1350 / PNG</span>
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
                    aria-checked={requestedVariant === 'cover'}
                    aria-busy={requestedVariant === 'cover' && isAssetPending}
                    disabled={isSharing}
                    className={`share-artwork-mode__option${requestedVariant === 'cover' ? ' is-selected' : ''}`}
                    onClick={() => setRequestedVariant('cover')}
                  >
                    <span className="share-artwork-mode__option-mark">COVER</span>
                    <span className="share-artwork-mode__option-copy">
                      <strong>Album cover</strong>
                      <small>Original artwork and metadata</small>
                    </span>
                    {requestedVariant === 'cover' && isAssetPending && <LoaderCircle className="share-artwork-busy" aria-hidden="true" />}
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={requestedVariant === 'palette'}
                    aria-busy={requestedVariant === 'palette' && isAssetPending}
                    disabled={isSharing}
                    className={`share-artwork-mode__option${requestedVariant === 'palette' ? ' is-selected' : ''}`}
                    onClick={() => setRequestedVariant('palette')}
                  >
                    <span className="share-artwork-mode__option-mark">ART</span>
                    <span className="share-artwork-mode__option-copy">
                      <strong>Palette art</strong>
                      <small>Generated from extracted coverage</small>
                    </span>
                    {requestedVariant === 'palette' && isAssetPending && <LoaderCircle className="share-artwork-busy" aria-hidden="true" />}
                  </button>
                </div>

                {requestedVariant === 'palette' && (
                  <>
                    <div className="share-artwork-styles" role="radiogroup" aria-label="Palette art style">
                      {PALETTE_ART_STYLES.map((option) => {
                        const styleIsBusy = requestedStyle === option.id && isAssetPending;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            role="radio"
                            aria-checked={requestedStyle === option.id}
                            aria-busy={styleIsBusy}
                            disabled={isSharing}
                            className={`share-artwork-style${requestedStyle === option.id ? ' is-selected' : ''}${styleIsBusy ? ' is-generating' : ''}`}
                            onClick={() => setRequestedStyle(option.id)}
                          >
                            <span className="share-artwork-style__preview" aria-hidden="true">
                              <PaletteArtCanvas
                                colors={albumColors}
                                artStyle={option.id}
                                seed={album.id || 'preview'}
                                size={44}
                                visualFeatures={album.visualFeatures}
                              />
                              {styleIsBusy && <LoaderCircle />}
                            </span>
                            <span className="share-artwork-style__copy">
                              <strong>{option.label}</strong>
                              <small>{option.description}</small>
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Data-to-form Explanation disclosure */}
                    <div className="share-artwork-explanation">
                      <p className="eyebrow-label">Why it looks this way</p>
                      <p className="share-artwork-explanation__text">
                        {activeModel.explanation.dominantSummary} {activeModel.explanation.accentSummary}
                      </p>
                    </div>
                  </>
                )}
              </section>

              <div className="share-studio__metadata">
                <div>
                  <p className="eyebrow-label">Artwork palette</p>
                  <div className="share-studio__swatches" aria-label="Extracted cover palette">
                    {activeModel.colors.slice(0, MAX_DISPLAY_ART_COLORS).map((color, index) => (
                      <span
                        key={`${color.sourceHex}-${index}`}
                        style={{ backgroundColor: color.sourceHex }}
                        title={`${color.sourceHex} (${Math.round(color.normalizedWeight * 100)}% coverage)`}
                      />
                    ))}
                  </div>
                </div>
                {album.releaseYear ? (
                  <p className="share-studio__archive-line">Released {album.releaseYear}</p>
                ) : null}
              </div>

              <div className="share-studio__actions">
                <button
                  type="button"
                  onClick={() => void handleSharePortrait()}
                  disabled={imageActionsDisabled}
                  className="premium-button premium-button--primary share-studio__primary-action"
                >
                  <span>{isAssetPending ? 'Generating image...' : action === 'sharing' ? 'Opening share sheet...' : displayedIsPalette ? 'Share palette artwork' : 'Share portrait card'}</span>
                  <span className="premium-button__island" aria-hidden="true">
                    {isAssetPending ? <LoaderCircle className="share-artwork-busy" /> : <Share2 className="h-4 w-4" strokeWidth={1.5} />}
                  </span>
                </button>
                <div className="share-studio__secondary-actions">
                  <button
                    type="button"
                    onClick={handleDownload}
                    disabled={imageActionsDisabled}
                    className="premium-button premium-button--secondary"
                  >
                    <Download className="h-4 w-4" strokeWidth={1.5} />
                    <span>{displayedIsPalette ? 'Download palette art' : 'Download image'}</span>
                  </button>
                  <button type="button" onClick={() => void handleCopyLink()} className="premium-button premium-button--secondary">
                    {copied ? <Check className="h-4 w-4 theme-success" strokeWidth={1.5} /> : <Copy className="h-4 w-4" strokeWidth={1.5} />}
                    <span>{copied ? 'Link copied' : 'Copy album link'}</span>
                  </button>
                </div>
              </div>

              {status && (
                <div className={`share-studio__status share-studio__status--${status.tone}`} role={status.tone === 'error' ? 'alert' : 'status'} aria-live="polite">
                  <span>{status.message}</span>
                  {status.tone === 'error' && failedAsset && (
                    <button type="button" onClick={retryGeneration}>Retry</button>
                  )}
                </div>
              )}

              <a href={shareUrl} className="share-studio__open-link" target="_blank" rel="noopener noreferrer">
                Open shared album page <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} />
              </a>
            </aside>
          </div>
        </>
      )}
    </DialogFrame>
  );
}
