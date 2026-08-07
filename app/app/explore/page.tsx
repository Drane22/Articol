'use client';

import React, { useState, useEffect } from 'react';
import { Compass, Filter, Sparkles, RefreshCw } from 'lucide-react';
import { AlbumCard } from '@/components/AlbumCard';
import { ColorSpectrumSlider } from '@/components/ColorSpectrumSlider';
import { Album } from '@/lib/types';
import { useCountry } from '@/components/CountryProvider';

const PREDEFINED_COLLECTIONS = [
  'Quiet Minimalism',
  'Red and Black',
  'Dreamlike Portraits',
  'Hand-Drawn Worlds',
  'Brutalist Type',
  'Analog Grain',
  'Soft Pastels',
  'Dark Monochrome',
  'Maximalist Collage',
];

const VISUAL_TAGS = ['Minimal', 'Portrait', 'Illustrated', 'Abstract', 'Monochrome', 'Warm', 'Cool'];
const DECADES = ['1960', '1970', '1980', '1990', '2000', '2010', '2020'];

export default function ExplorePage() {
  const { country, ready } = useCountry();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCollection, setActiveCollection] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [activeColor, setActiveColor] = useState<string | null>(null);
  const [activeDecade, setActiveDecade] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    let isCurrentRequest = true;
    setIsLoading(true);

    const params = new URLSearchParams();
    params.set('country', country);
    if (activeCollection) params.set('collection', activeCollection);
    if (activeFilter) params.set('filter', activeFilter);
    if (activeColor) params.set('color', activeColor);
    if (activeDecade) params.set('decade', activeDecade);

    fetch(`/api/discover?${params.toString()}`, { signal: controller.signal, cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error(`Explore request failed: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!isCurrentRequest) return;
        setAlbums(data.albums || []);
        setIsLoading(false);
      })
      .catch((err) => {
        if (err.name === 'AbortError' || !isCurrentRequest) return;
        console.error('Explore discover error:', err);
        setAlbums([]);
        setIsLoading(false);
      });

    return () => {
      isCurrentRequest = false;
      controller.abort();
    };
  }, [activeCollection, activeFilter, activeColor, activeDecade, country, ready]);

  const handleResetFilters = () => {
    setActiveCollection(null);
    setActiveFilter(null);
    setActiveColor(null);
    setActiveDecade(null);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2 text-xs font-mono uppercase theme-warning">
          <Compass className="w-4 h-4" />
          <span>Digital Cover Archive</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-serif font-normal text-[var(--text-primary)]">
          Explore Visual Language
        </h1>
        <p className="text-sm text-[var(--text-muted)] max-w-2xl">
          Browse records indexed by dominant color spectrums, layout structures, decade aesthetics, and extracted visual tags.
        </p>
      </div>

      {/* Predefined Collections Scrollable Bar */}
      <div className="space-y-2">
        <span className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-wider block">
          Curated Visual Collections
        </span>
        <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-none">
          {PREDEFINED_COLLECTIONS.map((coll, idx) => {
            const isSelected = activeCollection === coll;
            return (
              <button
                key={idx}
                onClick={() => {
                  setActiveCollection(isSelected ? null : coll);
                }}
                className={`flex min-h-11 flex-shrink-0 items-center rounded-full border px-4 py-2 text-xs transition-[border-color,background-color,color,transform] duration-200 ${
                  isSelected
                    ? 'bg-[var(--accent-editorial)] text-[var(--bg-canvas)] font-semibold shadow-md border-[var(--text-primary)]'
                    : 'border-[var(--border-color)] bg-[var(--bg-card)] hover:border-[var(--text-muted)] text-[var(--text-primary)]'
                }`}
              >
                {coll}
              </button>
            );
          })}
        </div>
      </div>

      {/* Color Spectrum Slider */}
      <ColorSpectrumSlider
        selectedColor={activeColor}
        onColorSelect={(colorHex) => setActiveColor(colorHex)}
      />

      {/* Visual Attribute Tags & Decade Filter Row */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-mono text-[var(--text-muted)] flex items-center space-x-1 mr-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Attributes:</span>
          </span>
          {VISUAL_TAGS.map((tag, idx) => {
            const isSelected = activeFilter === tag;
            return (
              <button
                key={idx}
                onClick={() => setActiveFilter(isSelected ? null : tag)}
                className={`min-h-10 px-3 py-1 rounded-full text-xs font-mono transition-colors ${
                  isSelected
                    ? 'theme-info-fill font-medium'
                    : 'bg-[var(--tag-bg)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs font-mono text-[var(--text-muted)]">Decade:</span>
          <select
            value={activeDecade || ''}
            onChange={(e) => setActiveDecade(e.target.value || null)}
            className="min-h-10 bg-[var(--accent-soft)] border border-[var(--border-color)] text-[var(--text-primary)] text-xs rounded px-2 py-1 focus:outline-none"
          >
            <option value="">All Decades</option>
            {DECADES.map((d) => (
              <option key={d} value={d}>
                {d}s
              </option>
            ))}
          </select>

          {(activeCollection || activeFilter || activeColor || activeDecade) && (
            <button
              onClick={handleResetFilters}
              className="flex min-h-10 items-center space-x-1 px-2 text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
              title="Reset all filters"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Album Grid */}
      <section className="space-y-4">
        <div className="flex justify-between items-center text-xs font-mono text-[var(--text-muted)]">
          <span>Displaying {albums.length} catalog covers</span>
          {activeCollection && <span className="font-semibold theme-warning">Collection: {activeCollection}</span>}
        </div>

        {isLoading ? (
          <div className="recommendation-grid">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-square bg-[var(--accent-soft)] rounded-lg animate-pulse" />
            ))}
          </div>
        ) : albums.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-[var(--border-color)] rounded-xl space-y-2">
            <p className="text-sm text-[var(--text-muted)]">No covers match your specific filter criteria.</p>
            <button
              onClick={handleResetFilters}
              className="text-xs font-mono theme-info hover:underline"
            >
              Clear filters to view all covers
            </button>
          </div>
        ) : (
          <div className="recommendation-grid">
            {albums.map((alb) => (
              <AlbumCard key={alb.itunesCollectionId} album={alb} />
            ))}
          </div>
        )}
      </section>

    </div>
  );
}
