'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  ExternalLink, Bookmark, Share2, Sparkles, Sliders, 
  ArrowLeft, Check, Copy, Disc, Music, ShieldAlert, Info 
} from 'lucide-react';
import { Album, RecommendationTiers, SearchMode, SimilarityResult } from '@/lib/types';
import { AlbumCard } from '@/components/AlbumCard';
import { WhyMatchModal } from '@/components/WhyMatchModal';
import { CoverArtwork } from '@/components/CoverArtwork';
import { RecommendationLoading } from '@/components/RecommendationLoading';

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
  const router = useRouter();
  const searchParams = useSearchParams();

  const [album, setAlbum] = useState<Album | null>(null);
  const [recommendationTiers, setRecommendationTiers] = useState<RecommendationTiers>(EMPTY_TIERS);
  const [isUnindexed, setIsUnindexed] = useState(false);
  const [relatedAlbums, setRelatedAlbums] = useState<RelatedAlbumItem[]>([]);
  const [mode, setMode] = useState<SearchMode>('art_style');
  const [isLoadingAlbum, setIsLoadingAlbum] = useState(true);
  const [isLoadingRecs, setIsLoadingRecs] = useState(true);
  const [recommendationError, setRecommendationError] = useState<string | null>(null);
  const [recommendationRetry, setRecommendationRetry] = useState(0);
  const [selectedWhyMatch, setSelectedWhyMatch] = useState<SimilarityResult | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);
  const [copiedPalette, setCopiedPalette] = useState(false);

  // Fetch selected album detail
  useEffect(() => {
    const controller = new AbortController();
    setIsLoadingAlbum(true);
    fetch(`/api/albums/${id}`, { signal: controller.signal })
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
  }, [id]);

  // Fetch recommendation tiers or handle unindexed album state
  useEffect(() => {
    if (!album) return;

    const controller = new AbortController();
    setIsLoadingRecs(true);
    setRecommendationError(null);
    setIsUnindexed(false);
    setRecommendationTiers(EMPTY_TIERS);
    setRelatedAlbums([]);

    fetch(`/api/albums/${id}/similar?limit=18`, { signal: controller.signal })
      .then(async (res) => {
        const data = await res.json();
        if (data.status === 'not_indexed') {
          setIsUnindexed(true);
          // Fetch metadata-based related albums fallback (Section 4)
          fetch(`/api/albums/${id}/related`, { signal: controller.signal })
            .then(r => r.json())
            .then(relData => {
              setRelatedAlbums(relData.results || []);
              setIsLoadingRecs(false);
            })
            .catch(() => setIsLoadingRecs(false));
          return null;
        }
        if (!res.ok) throw new Error(data.error || 'Recommendations could not be loaded');
        return data;
      })
      .then((data) => {
        if (!data) return;
        if (!data.tiers) throw new Error(data.error || 'Recommendations could not be loaded');
        setRecommendationTiers(data.tiers);
        if (data.queryAlbum) {
          setAlbum(current => current ? { ...current, ...data.queryAlbum, tracks: current.tracks } : data.queryAlbum);
        }
        setIsLoadingRecs(false);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        console.error('Failed to load recommendations:', err);
        setRecommendationError('Recommendations are temporarily unavailable. Please try again.');
        setIsLoadingRecs(false);
      });
    return () => controller.abort();
  }, [id, album?.itunesCollectionId, recommendationRetry]);

  const recommendations = recommendationTiers[mode];

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

  const handleShare = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2000);
    }
  };

  // Ambient palette wash color from dominant palette
  const palette = album?.dominantPalette?.slice(0, 3).map((color) => color.hex) || ['#1a1a1a'];
  const ambientBackground = `radial-gradient(ellipse at 18% 0%, ${palette[0]} 0%, transparent 52%), radial-gradient(ellipse at 82% 12%, ${palette[1] || palette[0]} 0%, transparent 48%), radial-gradient(ellipse at 50% 24%, ${palette[2] || palette[0]} 0%, transparent 60%)`;

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
          className="inline-flex items-center space-x-1.5 text-xs font-mono text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to search</span>
        </Link>

        {/* Hero Selected Album Gallery Entry Layout */}
        <section className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-12 items-start">
          
          {/* Prominent Square Artwork Display */}
          <div className="md:col-span-5 lg:col-span-5 relative aspect-square rounded-xl overflow-hidden shadow-2xl border border-[var(--border-color)] bg-[var(--bg-card)] group">
            <CoverArtwork src={album.artworkUrl} alt={`Cover artwork for ${album.title} by ${album.artistName}`} priority sizes="(max-width: 768px) calc(100vw - 2rem), 42vw" className="transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-[1.02]" />
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

            {/* Extracted Five-Color Palette Bar */}
            {album.dominantPalette && album.dominantPalette.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono text-[var(--text-muted)] uppercase tracking-wider block">
                    Extracted Palette
                  </span>
                  <button
                    onClick={() => {
                      const hexes = album.dominantPalette?.map((p) => p.hex).join(', ') || '';
                      navigator.clipboard.writeText(hexes);
                      setCopiedPalette(true);
                      setTimeout(() => setCopiedPalette(false), 2000);
                    }}
                    className="inline-flex items-center space-x-1 text-[11px] font-mono text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    {copiedPalette ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedPalette ? 'Copied HEX codes!' : 'Copy palette'}</span>
                  </button>
                </div>
                <div className="flex space-x-2 items-center">
                  {album.dominantPalette.map((p, idx) => (
                    <div key={idx} className="flex items-center space-x-1">
                      <span
                        className="w-6 h-6 rounded-md border border-black/10 shadow-sm cursor-pointer hover:scale-105 transition-transform"
                        style={{ backgroundColor: p.hex }}
                        title={`Copy ${p.hex}`}
                        onClick={() => {
                          navigator.clipboard.writeText(p.hex);
                          setCopiedPalette(true);
                          setTimeout(() => setCopiedPalette(false), 2000);
                        }}
                      />
                      <span className="text-[10px] font-mono text-[var(--text-muted)] hidden sm:inline">
                        {p.hex}
                      </span>
                    </div>
                  ))}
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
                    <span className="text-red-400 flex items-center"><ShieldAlert className="w-3 h-3 mr-1" /> Explicit</span>
                  ) : (
                    'Clean'
                  )}
                </span>
              </div>
              <div>
                <span className="text-[var(--text-muted)] block">Country Store</span>
                <span className="font-semibold text-[var(--text-primary)]">{album.country}</span>
              </div>
              {album.price ? (
                <div>
                  <span className="text-[var(--text-muted)] block">Store Price</span>
                  <span className="font-semibold text-[var(--text-primary)]">${album.price} {album.currency}</span>
                </div>
              ) : null}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 pt-2">
              {album.storeUrl && (
                <a
                  href={album.storeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-lg bg-[var(--accent-editorial)] text-[var(--bg-canvas)] hover:opacity-90 transition-opacity text-xs font-semibold shadow-md"
                >
                  <Music className="w-4 h-4" />
                  <span>View on Apple Music</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                </a>
              )}

              <button
                onClick={toggleSave}
                className={`inline-flex items-center space-x-2 px-4 py-2.5 rounded-lg border text-xs font-medium transition-colors ${
                  isSaved
                    ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
                    : 'border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--accent-soft)]'
                }`}
              >
                {isSaved ? <Check className="w-4 h-4 text-emerald-400" /> : <Bookmark className="w-4 h-4" />}
                <span>{isSaved ? 'Saved to collection' : 'Save artwork'}</span>
              </button>

              <button
                onClick={handleShare}
                className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-lg border border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--accent-soft)] transition-colors text-xs font-medium"
              >
                {copiedShare ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
                <span>{copiedShare ? 'Link copied!' : 'Share cover'}</span>
              </button>
            </div>

          </div>
        </section>

        {/* Section 4: Honest Unindexed State or Similar Covers */}
        {isUnindexed ? (
          <section className="space-y-8 pt-6 border-t border-[var(--border-color)]">
            <div className="p-6 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-3">
              <div className="flex items-center space-x-2 text-amber-500 font-medium text-sm">
                <Info className="w-4 h-4" />
                <span>This album has not been visually indexed yet.</span>
              </div>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                Articol can only compare covers that have already been analyzed and added to its visual catalog.
              </p>
            </div>

            {/* Separately Labeled Metadata-based Related Albums (Section 4) */}
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-serif font-normal text-[var(--text-primary)]">
                  Related albums
                </h2>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Metadata-based musical recommendations from iTunes.
                </p>
              </div>

              {isLoadingRecs ? (
                <RecommendationLoading />
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
                  More Like This Cover
                </h2>
                <p className="text-xs sm:text-sm text-[var(--text-muted)] font-sans mt-1">
                  Albums connected by composition, color, typography, texture, and overall visual mood.
                </p>
              </div>

              {/* 3 User-Selectable Search Mode Selector Pills */}
              <div className="grid grid-cols-3 w-full md:w-auto items-center gap-1 p-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] text-xs">
                <button
                  onClick={() => setMode('art_style')}
                  className={`px-3 py-1.5 rounded-md transition-all font-medium ${
                    mode === 'art_style'
                      ? 'bg-[var(--accent-editorial)] text-[var(--bg-canvas)] shadow-sm'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                  title="Ranked using artwork similarity only"
                >
                  Art Style
                </button>
                <button
                  onClick={() => setMode('balanced')}
                  className={`px-3 py-1.5 rounded-md transition-all font-medium ${
                    mode === 'balanced'
                      ? 'bg-[var(--accent-editorial)] text-[var(--bg-canvas)] shadow-sm'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                  title="60% artwork similarity and 40% music relationship"
                >
                  Balanced
                </button>
                <button
                  onClick={() => setMode('music_relation')}
                  className={`px-3 py-1.5 rounded-md transition-all font-medium ${
                    mode === 'music_relation'
                      ? 'bg-[var(--accent-editorial)] text-[var(--bg-canvas)] shadow-sm'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                  title="Ranked using music relationship only"
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
                <button onClick={() => setRecommendationRetry((value) => value + 1)} className="text-xs font-mono px-3 py-2 rounded-md hover:bg-[var(--accent-soft)]">Try again</button>
              </div>
            ) : recommendations.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-[var(--border-color)] rounded-xl space-y-3">
                <p className="text-sm text-[var(--text-muted)]">
                  No visual matches found in current candidate pool.
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
            onClose={() => setSelectedWhyMatch(null)}
          />
        )}

      </div>
    </div>
  );
}
