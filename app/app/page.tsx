'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Loader2, Sparkles, ArrowRight } from 'lucide-react';
import { AlbumCard } from '@/components/AlbumCard';
import { Album } from '@/lib/types';
import { useDebounce } from 'use-debounce';
import { CoverArtwork } from '@/components/CoverArtwork';

export default function HomePage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [debouncedQuery] = useDebounce(query, 300);
  const [results, setResults] = useState<Album[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [country, setCountry] = useState('PH');
  const [seedSpotlight, setSeedSpotlight] = useState<Album[]>([]);
  const [spotlightError, setSpotlightError] = useState(false);
  const [spotlightRetry, setSpotlightRetry] = useState(0);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchRetry, setSearchRetry] = useState(0);
  const latestQueryRef = useRef('');

  // Fetch seed spotlight on mount
  useEffect(() => {
    setSpotlightError(false);
    fetch(`/api/discover?featured=true&country=${country}`)
      .then(res => {
        if (!res.ok) throw new Error('Featured covers failed to load');
        return res.json();
      })
      .then(data => {
        setSeedSpotlight(data.albums || []);
        setSpotlightError(!data.albums?.length);
      })
      .catch(() => { setSeedSpotlight([]); setSpotlightError(true); });
  }, [country, spotlightRetry]);

  // Search execution when debounced query changes
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      setIsLoading(false);
      setSearchError(null);
      return;
    }

    const controller = new AbortController();
    let isCurrentRequest = true;
    setIsLoading(true);
    setSearchError(null);
    fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}&country=${country}&limit=12`, {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Search failed');
        return data;
      })
      .then((data) => {
        if (!isCurrentRequest || latestQueryRef.current !== debouncedQuery) return;
        setResults(data.results || []);
        setIsLoading(false);
      })
      .catch((err) => {
        if (err.name === 'AbortError' || !isCurrentRequest || latestQueryRef.current !== debouncedQuery) return;
        console.error('Search error:', err);
        setResults([]);
        setSearchError('Search is unavailable right now. Please try again.');
        setIsLoading(false);
      });

    return () => {
      isCurrentRequest = false;
      controller.abort();
    };
  }, [debouncedQuery, country, searchRetry]);

  const handleQueryChange = (value: string) => {
    latestQueryRef.current = value;
    setQuery(value);
    setResults([]);
    setSearchError(null);
    setIsLoading(Boolean(value.trim()));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
      
      {/* Hero Section */}
      <section className="text-center max-w-3xl mx-auto space-y-6 pt-6">
        <h1 className="text-4xl sm:text-6xl font-serif font-normal tracking-tight text-[var(--text-primary)] leading-[1.1]">
          Find records by the way they look.
        </h1>
        <p className="text-base sm:text-lg text-[var(--text-muted)] font-sans max-w-2xl mx-auto leading-relaxed">
          Search an album, study its artwork, and discover records with a similar visual language.
        </p>

        {/* Restrained Editorial Search Bar */}
        <div className="relative max-w-xl mx-auto pt-2">
          <div className="relative flex items-center shadow-lg rounded-xl overflow-hidden border border-[var(--border-color)] bg-[var(--bg-card)] focus-within:border-[var(--text-primary)] transition-all">
            <Search className="w-5 h-5 text-[var(--text-muted)] ml-4 flex-shrink-0" />
            <input
              id="home-search-input"
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Search album or artist..."
              className="w-full py-4 px-3 bg-transparent text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none"
            />
            {isLoading && <Loader2 className="w-5 h-5 text-[var(--text-muted)] animate-spin mr-4 flex-shrink-0" />}
          </div>

        </div>
      </section>

      {/* Live Search Results Grid (when searching) */}
      {query.trim().length > 0 && (
        <section className="space-y-6 pt-4">
          <div className="flex justify-between items-center border-b border-[var(--border-color)] pb-3">
            <h2 className="text-xl font-serif font-medium text-[var(--text-primary)]">
              Search Results
            </h2>
            <span className="text-xs font-mono text-[var(--text-muted)]">
              {results.length} albums found
            </span>
          </div>

          {isLoading ? (
            <div className="recommendation-grid">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-square bg-[var(--accent-soft)] rounded-lg animate-pulse" />
              ))}
            </div>
          ) : searchError ? (
            <div className="text-center py-12 text-[var(--text-muted)] space-y-3">
              <p className="text-sm text-red-400" role="alert">{searchError}</p>
              <button
                type="button"
                onClick={() => {
                  setIsLoading(true);
                  setSearchRetry((value) => value + 1);
                }}
                className="min-h-10 rounded-md bg-[var(--accent-soft)] px-4 text-xs text-[var(--text-primary)] hover:bg-[var(--border-color)] transition-colors"
              >
                Try again
              </button>
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-12 text-[var(--text-muted)] space-y-2">
              <p className="text-sm">No albums found matching "{query}"</p>
              <p className="text-xs">Try searching for famous albums like "Abbey Road", "Kind of Blue", or "Igor".</p>
            </div>
          ) : (
            <div className="recommendation-grid">
              {results.map((alb) => (
                <AlbumCard key={alb.itunesCollectionId} album={alb} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Archival Catalog Spotlight Showcase (when idle) */}
      {query.trim().length === 0 && (
        <section className="space-y-8 pt-6">
          <div className="flex justify-between items-end border-b border-[var(--border-color)] pb-4">
            <div>
              <div className="flex items-center space-x-1.5 text-xs font-mono uppercase text-amber-500 mb-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Featured Visual Languages</span>
              </div>
              <h2 className="text-2xl font-serif font-medium text-[var(--text-primary)]">
                Study Artwork & Explore Similar Covers
              </h2>
            </div>
            <button
              onClick={() => router.push('/explore')}
              className="text-xs font-mono flex items-center space-x-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              <span>View cover archive</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {spotlightError ? <div className="py-12 text-center rounded-xl border border-dashed border-[var(--border-color)]"><p className="text-sm text-[var(--text-muted)] mb-3">Featured covers could not be loaded.</p><button onClick={() => setSpotlightRetry(value => value + 1)} className="min-h-10 px-4 rounded-md bg-[var(--accent-soft)] text-xs">Try again</button></div> : seedSpotlight.length === 0 ? <div className="recommendation-grid">{Array.from({ length: 6 }, (_, index) => <div key={index} className="aspect-square rounded-xl bg-[var(--accent-soft)] animate-pulse" />)}</div> : <div className="recommendation-grid">{seedSpotlight.map((alb) => <AlbumCard key={alb.itunesCollectionId} album={alb} />)}</div>}
        </section>
      )}

    </div>
  );
}
