'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { 
  ExternalLink, Bookmark, Share2,
  ArrowLeft, Check, Copy, Music, ShieldAlert, Info
} from 'lucide-react';
import { Album, RecommendationTiers, SearchMode, SimilarityResult } from '@/lib/types';
import { AlbumCard } from '@/components/AlbumCard';
import { WhyMatchModal } from '@/components/WhyMatchModal';
import { CoverArtwork } from '@/components/CoverArtwork';
import { RecommendationLoading } from '@/components/RecommendationLoading';
import { ShareCardModal } from '@/components/ShareCardModal';
import { PaletteDepth } from '@/components/PaletteDepth';
import { useCountry } from '@/components/CountryProvider';
import { getStorefront } from '@/lib/storefronts';
import { getAbsoluteUrl, getAlbumPortraitShareImagePath, getAlbumSharePath } from '@/lib/share';
import { limitPalette } from '@/lib/palette';

const EMPTY_TIERS: RecommendationTiers = {
  art_style: [],
  balanced: [],
  music_relation: [],
};

interface RelatedAlbumItem {
  album: Album;
  musicScore: number;
  reason: string;
}

export default function AlbumDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const { country, ready, setCountry } = useCountry();

  const [album, setAlbum] = useState<Album | null>(null);
  const [recommendationTiers, setRecommendationTiers] = useState<RecommendationTiers>(EMPTY_TIERS);
  const [isUnindexed, setIsUnindexed] = useState(false);
  const [showRelatedFallback, setShowRelatedFallback] = useState(false);
  const [relatedAlbums, setRelatedAlbums] = useState<RelatedAlbumItem[]>([]);
  const [relatedError, setRelatedError] = useState<string | null>(null);
  const [mode, setMode] = useState<SearchMode>('art_style');
  const [isLoadingAlbum, setIsLoadingAlbum] = useState(true);
  const [isLoadingRecs, setIsLoadingRecs] = useState(true);
  const [recommendationError, setRecommendationError] = useState<string | null>(null);
  const [recommendationRetry, setRecommendationRetry] = useState(0);
  const [selectedWhyMatch, setSelectedWhyMatch] = useState<SimilarityResult | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [shareOrigin, setShareOrigin] = useState('');
  const [copiedShare, setCopiedShare] = useState(false);
  const [copiedPalette, setCopiedPalette] = useState(false);
  const [paletteCopyError, setPaletteCopyError] = useState(false);

  useEffect(() => {
    setShareOrigin(window.location.origin);
  }, []);

  // Fetch selected album detail
  useEffect(() => {
    const sharedCountry = searchParams.get('country');
    if (sharedCountry) setCountry(sharedCountry);
  }, [searchParams, setCountry]);

  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    setIsLoadingAlbum(true);
    setAlbum(null);
    fetch(`/api/albums/${id}?country=${country}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (data.album) {
          setAlbum(data.album);
          checkIsSaved(data.album.itunesCollectionId);
        }
        setIsLoadingAlbum(false);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        console.error('Failed to load album:', err);
        setIsLoadingAlbum(false);
      });
    return () => controller.abort();
  }, [country, id, ready]);

  // Fetch recommendation tiers or handle unindexed/low-confidence album state
  useEffect(() => {
    if (!ready) return;

    const controller = new AbortController();
    setIsLoadingRecs(true);
    setRecommendationError(null);
    setIsUnindexed(false);
    setShowRelatedFallback(false);
    setRelatedError(null);
    setRecommendationTiers(EMPTY_TIERS);
    setRelatedAlbums([]);

    const loadRelatedFallback = async (reason: 'unindexed' | 'low-confidence') => {
      if (reason === 'unindexed') setIsUnindexed(true);
      else setShowRelatedFallback(true);

      try {
        const relatedResponse = await fetch(`/api/albums/${id}/related?country=${country}`, { signal: controller.signal });
        const relatedData = await relatedResponse.json();
        if (!relatedResponse.ok) throw new Error(relatedData.error || 'Related albums could not be loaded');
        setRelatedAlbums(relatedData.results || []);
      } catch (error: any) {
        if (error?.name === 'AbortError') return;
        console.error('Failed to load related albums:', error);
        setRelatedError('Related albums are temporarily unavailable.');
      } finally {
        setIsLoadingRecs(false);
      }
    };

    const loadRecommendations = async () => {
      try {
        const response = await fetch(`/api/albums/${id}/similar?country=${country}&limit=18`, { signal: controller.signal });
        const data = await response.json();

        if (data.status === 'not_indexed') {
          await loadRelatedFallback('unindexed');
          return;
        }
        if (!response.ok) throw new Error(data.error || 'Recommendations could not be loaded');
        if (!data.tiers) throw new Error(data.error || 'Recommendations could not be loaded');

        setRecommendationTiers(data.tiers);
        if (data.queryAlbum) {
          setAlbum(current => current ? { ...current, ...data.queryAlbum, tracks: current.tracks } : data.queryAlbum);
          setIsLoadingAlbum(false);
        }

        const hasEligibleTier = Object.values(data.tiers as RecommendationTiers).some((tier) => tier.length > 0);
        if (!hasEligibleTier) {
          await loadRelatedFallback('low-confidence');
          return;
        }

        setIsLoadingRecs(false);
      } catch (error: any) {
        if (error?.name === 'AbortError') return;
        console.error('Failed to load recommendations:', error);
        setRecommendationError('Recommendations are temporarily unavailable. Please try again.');
        setIsLoadingRecs(false);
      }
    };

    void loadRecommendations();
    return () => controller.abort();
  }, [country, id, ready, recommendationRetry]);

  const recommendations = recommendationTiers[mode];
  const recommendationHeading = mode === 'music_relation' ? 'Musically Related Albums' : 'More Like This Cover';
  const recommendationDescription = mode === 'art_style'
    ? 'Covers connected by verified color language, composition, medium, typography, and texture.'
    : mode === 'balanced'
      ? 'Albums connected by a verified visual relationship and music context.'
      : 'Albums connected by artist, genre/style, and release-era evidence. Artwork is shown for context.';

  const checkIsSaved = (colId: number) => {
    try {
      const saved = JSON.parse(localStorage.getItem('articol_saved_albums') || '[]');
      setIsSaved(saved.some((a: any) => a.itunesCollectionId === colId));
    } catch (e) {}
  };

  const toggleSave = () => {
    if (!album) return;
    try {
      const saved = JSON.parse(localStorage.getItem('articol_saved_albums') || '[]');
      if (isSaved) {
        const next = saved.filter((a: any) => a.itunesCollectionId !== album.itunesCollectionId);
        localStorage.setItem('articol_saved_albums', JSON.stringify(next));
        setIsSaved(false);
      } else {
        saved.push(album);
        localStorage.setItem('articol_saved_albums', JSON.stringify(saved));
        setIsSaved(true);
      }
    } catch (e) {}
  };

  const sharePath = getAlbumSharePath(id, country);
  const portraitImagePath = getAlbumPortraitShareImagePath(id, country);
  const shareUrl = shareOrigin ? getAbsoluteUrl(sharePath, shareOrigin) : sharePath;
  const portraitImageUrl = shareOrigin ? getAbsoluteUrl(portraitImagePath, shareOrigin) : portraitImagePath;

  const handleShare = () => {
    setIsShareOpen(true);
  };

  const handleCopyShare = async (): Promise<boolean> => {
    if (typeof navigator === 'undefined' || typeof document === 'undefined') return false;
    try {
      let copied = false;
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(shareUrl);
          copied = true;
        } catch {
          // Fall through to the legacy copy path for webviews or blocked
          // clipboard permissions.
        }
      }
      if (!copied) {
        const fallbackInput = document.createElement('textarea');
        fallbackInput.value = shareUrl;
        fallbackInput.setAttribute('readonly', '');
        fallbackInput.style.position = 'fixed';
        fallbackInput.style.opacity = '0';
        document.body.appendChild(fallbackInput);
        fallbackInput.select();
        copied = document.execCommand('copy');
        fallbackInput.remove();
        if (!copied) throw new Error('Clipboard fallback failed');
      }
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2000);
      return true;
    } catch (error) {
      console.warn('Share link copy failed:', error);
      return false;
    }
  };

  const handleCopyPalette = async (hexes: string) => {
    if (!hexes || typeof navigator === 'undefined' || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(hexes);
      setPaletteCopyError(false);
      setCopiedPalette(true);
      setTimeout(() => setCopiedPalette(false), 2000);
    } catch (error) {
      console.warn('Palette copy failed:', error);
      setPaletteCopyError(true);
      setTimeout(() => setPaletteCopyError(false), 2500);
    }
  };

  // Ambient palette wash color from dominant palette
  const palette = album?.dominantPalette?.slice(0, 3).map((color) => color.hex) || ['#1a1a1a'];
  const ambientBackground = `radial-gradient(ellipse at 18% 0%, ${palette[0]} 0%, transparent 52%), radial-gradient(ellipse at 82% 12%, ${palette[1] || palette[0]} 0%, transparent 48%), radial-gradient(ellipse at 50% 24%, ${palette[2] || palette[0]} 0%, transparent 60%)`;
  const albumStorefront = getStorefront(album?.country);

  if (isLoadingAlbum) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 space-y-8 animate-pulse">
        <div className="h-6 w-24 bg-[var(--accent-soft)] rounded" />
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          <div className="md:col-span-5 aspect-square bg-[var(--accent-soft)] rounded-xl" />
          <div className="md:col-span-7 space-y-4">
            <div className="h-10 w-3/4 bg-[var(--accent-soft)] rounded" />
            <div className="h-6 w-1/2 bg-[var(--accent-soft)] rounded" />
            <div className="h-24 w-full bg-[var(--accent-soft)] rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (!album) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-24 text-center space-y-4">
        <h2 className="text-2xl font-serif">Album not found</h2>
        <p className="text-sm text-[var(--text-muted)]">Could not retrieve metadata for collection ID: {id}</p>
        <Link href="/" className="inline-flex items-center space-x-2 text-xs font-mono border border-[var(--border-color)] px-4 py-2 rounded-lg hover:bg-[var(--accent-soft)]">
          <ArrowLeft className="w-4 h-4" />
          <span>Return to search</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      
      {/* Dynamic Low-Opacity Palette Ambient Background Wash */}
      <div
        className="ambient-wash"
        style={{
          background: ambientBackground,
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-16 relative z-10">
        
        {/* Back Link */}
        <Link
          href="/"
          className="inline-flex min-h-11 items-center space-x-1.5 text-xs font-mono text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to search</span>
        </Link>

        {/* Hero Selected Album Gallery Entry Layout */}
        <section className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-12 items-start">
          
          {/* Prominent Square Artwork Display */}
          <div className="md:col-span-5 lg:col-span-5 relative aspect-square rounded-xl overflow-hidden shadow-2xl border border-[var(--border-color)] bg-[var(--bg-card)] group">
            <CoverArtwork src={album.artworkUrl} alt={`Cover artwork for ${album.title} by ${album.artistName}`} priority sizes="(max-width: 768px) calc(100vw - 2rem), 42vw" className="transition-transform duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.02]" />
          </div>

          {/* Archival Catalog Entry Details */}
          <div className="md:col-span-7 lg:col-span-7 space-y-6">
            
            {/* Title & Artist */}
            <div>
              <span className="text-xs font-mono uppercase tracking-widest text-[var(--text-muted)] block mb-1">
                {album.genre} • {album.releaseYear}
              </span>
              <h1 className="text-3xl sm:text-5xl font-serif font-normal text-[var(--text-primary)] leading-tight">
                {album.title}
              </h1>
              <p className="text-lg sm:text-xl text-[var(--text-muted)] font-sans mt-1">
                {album.artistName}
              </p>
            </div>

            {/* Extracted palette — up to ten meaningful colors */}
            {album.dominantPalette && album.dominantPalette.length > 0 && (
              <div className="space-y-1.5">
                <PaletteDepth label="Extracted palette depth" palette={album.dominantPalette} className="palette-depth--album" />
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border-color)]/70 bg-[var(--bg-card)]/60 px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                  {limitPalette(album.dominantPalette).map((p, idx) => (
                    <div key={idx} className="flex items-center space-x-1">
                      <button
                        type="button"
                        className="h-11 w-11 cursor-pointer rounded-xl border theme-swatch-border shadow-sm transition-transform duration-[160ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-[1.03]"
                        style={{ backgroundColor: p.hex }}
                        title={`Copy ${p.hex}`}
                        aria-label={`Copy ${p.hex}`}
                        onClick={() => void handleCopyPalette(p.hex)}
                      />
                      <span className="text-[10px] font-mono text-[var(--text-muted)] hidden sm:inline">
                        {p.hex}
                      </span>
                    </div>
                  ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleCopyPalette(limitPalette(album.dominantPalette).map((p) => p.hex).join(', '))}
                    className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-[var(--border-color)] px-3 text-[11px] font-mono text-[var(--text-muted)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--text-primary)]"
                  >
                    {copiedPalette ? <Check className="h-3 w-3 theme-success" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedPalette ? 'Copied' : paletteCopyError ? 'Copy failed' : 'Copy palette'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Archival Catalog Metadata Table */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)]/50 text-xs">
              <div>
                <span className="text-[var(--text-muted)] block">Label</span>
                <span className="font-semibold text-[var(--text-primary)] truncate block">{album.label || 'Independent'}</span>
              </div>
              <div>
                <span className="text-[var(--text-muted)] block">Track Count</span>
                <span className="font-semibold text-[var(--text-primary)]">{album.trackCount} tracks</span>
              </div>
              <div>
                <span className="text-[var(--text-muted)] block">Explicitness</span>
                <span className="font-semibold text-[var(--text-primary)] flex items-center space-x-1">
                  {album.explicitness === 'explicit' ? (
                    <span className="theme-danger flex items-center"><ShieldAlert className="w-3 h-3 mr-1" /> Explicit</span>
                  ) : (
                    'Clean'
                  )}
                </span>
              </div>
              <div>
                <span className="text-[var(--text-muted)] block">Country Store</span>
                <span className="font-semibold text-[var(--text-primary)]">{albumStorefront.label} ({album.country})</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 pt-2">
              {album.storeUrl && (
                <a
                  href={album.storeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full sm:w-auto justify-center items-center space-x-2 px-4 py-3 rounded-lg bg-[var(--accent-editorial)] text-[var(--bg-canvas)] hover:opacity-90 transition-opacity text-xs font-semibold shadow-md"
                >
                  <Music className="w-4 h-4" />
                  <span>View on Apple Music</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                </a>
              )}

              <button
                type="button"
                onClick={toggleSave}
                className={`inline-flex w-full sm:w-auto justify-center items-center space-x-2 px-4 py-3 rounded-lg border text-xs font-medium transition-colors ${
                  isSaved
                     ? 'theme-success-soft border'
                    : 'border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--accent-soft)]'
                }`}
              >
                {isSaved ? <Check className="w-4 h-4 theme-success" /> : <Bookmark className="w-4 h-4" />}
                <span>{isSaved ? 'Saved to collection' : 'Save artwork'}</span>
              </button>

              <button
                type="button"
                onClick={handleShare}
                className="inline-flex w-full sm:w-auto justify-center items-center space-x-2 px-4 py-3 rounded-lg border border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--accent-soft)] transition-colors text-xs font-medium"
              >
                {copiedShare ? <Check className="w-4 h-4 theme-success" /> : <Share2 className="w-4 h-4" />}
                <span>{copiedShare ? 'Link copied!' : 'Share cover'}</span>
              </button>
            </div>

          </div>
        </section>

        {/* Section 4: Honest Unindexed State or Similar Covers */}
        {isUnindexed || showRelatedFallback ? (
          <section className="space-y-8 pt-6 border-t border-[var(--border-color)]">
            <div className="p-6 rounded-xl border theme-warning-surface space-y-3">
              <div className="flex items-center space-x-2 theme-warning font-medium text-sm">
                <Info className="w-4 h-4" />
                <span>{isUnindexed ? 'This album has not been visually indexed yet.' : 'No strong visual matches cleared the 30% confidence threshold.'}</span>
              </div>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                {isUnindexed
                  ? 'Articol can only compare covers that have already been analyzed and added to its visual catalog.'
                  : 'Articol is keeping uncertain matches out of the collection. These alternatives are related by catalog metadata, not visual similarity.'}
              </p>
            </div>

            {/* Separately Labeled Metadata-based Related Albums (Section 4) */}
            <div className="space-y-6">
              <div>
                  <h2 className="text-2xl font-serif font-normal text-[var(--text-primary)]">
                  {isUnindexed ? 'Related albums' : 'Other ways to explore'}
                  </h2>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                  Metadata-based album references from the catalog.
                  </p>
                </div>

              {isLoadingRecs ? (
                <RecommendationLoading />
              ) : relatedError ? (
                <p className="text-xs theme-danger" role="alert">{relatedError}</p>
              ) : relatedAlbums.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)]">No related albums available.</p>
              ) : (
                <div className="recommendation-grid">
                  {relatedAlbums.map((rel) => (
                    <AlbumCard key={rel.album.itunesCollectionId} album={rel.album} />
                  ))}
                </div>
              )}
            </div>
          </section>
        ) : (
          /* "More Like This Cover" Recommendation Grid for Indexed Albums */
          <section className="space-y-6 pt-6 border-t border-[var(--border-color)]">
            
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl sm:text-3xl font-serif font-normal text-[var(--text-primary)]">
                  {recommendationHeading}
                </h2>
                <p className="text-xs sm:text-sm text-[var(--text-muted)] font-sans mt-1">
                  {recommendationDescription}
                </p>
              </div>

              {/* 3 User-Selectable Search Mode Selector Pills */}
              <div className="grid grid-cols-3 w-full md:w-auto items-center gap-1 p-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] text-[10px] sm:text-xs">
                <button
                  type="button"
                  onClick={() => setMode('art_style')}
                  className={`min-h-11 min-w-0 rounded-full px-1.5 py-2 font-medium whitespace-nowrap transition-colors ${
                    mode === 'art_style'
                      ? 'bg-[var(--accent-editorial)] text-[var(--bg-canvas)] shadow-sm'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                  title="Ranked using verified palette, composition, medium, and typography evidence"
                >
                  Art Style
                </button>
                <button
                  type="button"
                  onClick={() => setMode('balanced')}
                  className={`min-h-11 min-w-0 rounded-full px-1.5 py-2 font-medium whitespace-nowrap transition-colors ${
                    mode === 'balanced'
                      ? 'bg-[var(--accent-editorial)] text-[var(--bg-canvas)] shadow-sm'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                  title="70% verified artwork relationship and 30% music relationship"
                >
                  Balanced
                </button>
                <button
                  type="button"
                  onClick={() => setMode('music_relation')}
                  className={`min-h-11 min-w-0 rounded-full px-1.5 py-2 font-medium whitespace-nowrap transition-colors ${
                    mode === 'music_relation'
                      ? 'bg-[var(--accent-editorial)] text-[var(--bg-canvas)] shadow-sm'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                  title="Ranked using artist, genre/style, and release-era evidence; artwork is contextual"
                >
                  Music Relation
                </button>
              </div>
            </div>

            {/* Grid View */}
            {isLoadingRecs ? (
              <RecommendationLoading />
            ) : recommendationError ? (
              <div className="text-center py-16 border border-dashed border-[var(--border-color)] rounded-xl space-y-3">
                <p className="text-sm text-[var(--text-muted)]">{recommendationError}</p>
                <button type="button" onClick={() => setRecommendationRetry((value) => value + 1)} className="inline-flex min-h-11 items-center rounded-full px-4 text-xs font-mono hover:bg-[var(--accent-soft)]">Try again</button>
              </div>
            ) : recommendations.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-[var(--border-color)] rounded-xl space-y-3">
                <p className="text-sm text-[var(--text-muted)]">
                  {mode === 'music_relation' ? 'No music relationships found in the current candidate pool.' : 'No strong visual matches found in the current candidate pool.'}
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  Try switching modes or exploring other record covers.
                </p>
              </div>
            ) : (
              <div className="recommendation-grid animate-fade-in">
                {recommendations.map((rec) => (
                  <AlbumCard
                    key={rec.album.itunesCollectionId}
                    album={rec.album}
                    similarity={rec}
                    mode={mode}
                    onWhyMatchClick={setSelectedWhyMatch}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Modal for "Why this match" explanation */}
        {selectedWhyMatch && album && (
          <WhyMatchModal
            queryAlbum={album}
            result={selectedWhyMatch}
            mode={mode}
            onClose={() => setSelectedWhyMatch(null)}
          />
        )}

        {isShareOpen && album && (
          <ShareCardModal
            album={album}
            shareUrl={shareUrl}
            portraitImageUrl={portraitImageUrl}
            copied={copiedShare}
            onCopyLink={handleCopyShare}
            onClose={() => setIsShareOpen(false)}
          />
        )}

      </div>
    </div>
  );
}
