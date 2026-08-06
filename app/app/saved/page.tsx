'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Bookmark, Trash2, ArrowLeft, Disc } from 'lucide-react';
import { AlbumCard } from '@/components/AlbumCard';
import { Album } from '@/lib/types';

export default function SavedPage() {
  const [savedAlbums, setSavedAlbums] = useState<Album[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'favorites' | 'inspiration'>('all');

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('articol_saved_albums') || '[]');
      setSavedAlbums(saved);
    } catch (e) {
      setSavedAlbums([]);
    }
  }, []);

  const handleClearAll = () => {
    if (confirm('Clear all saved album covers?')) {
      localStorage.removeItem('articol_saved_albums');
      setSavedAlbums([]);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[var(--border-color)] pb-6">
        <div className="space-y-2">
          <div className="flex items-center space-x-2 text-xs font-mono uppercase text-emerald-500">
            <Bookmark className="w-4 h-4" />
            <span>Local Collections</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-serif font-normal text-[var(--text-primary)]">
            Saved Cover References
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            Your personal archive of album covers saved for design inspiration and study.
          </p>
        </div>

        {savedAlbums.length > 0 && (
          <button
            onClick={handleClearAll}
            className="inline-flex items-center space-x-1 text-xs font-mono text-red-400 hover:text-red-500 border border-red-500/20 px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear saved list</span>
          </button>
        )}
      </div>

      {/* Content */}
      {savedAlbums.length === 0 ? (
        <div className="text-center py-24 space-y-4 border border-dashed border-[var(--border-color)] rounded-xl">
          <Disc className="w-12 h-12 text-[var(--text-muted)] mx-auto opacity-40" />
          <h3 className="text-lg font-serif text-[var(--text-primary)]">No saved covers yet</h3>
          <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
            Click the bookmark icon on any album card while searching or exploring to build your personal reference archive.
          </p>
          <Link
            href="/"
            className="inline-flex items-center space-x-1.5 text-xs font-mono border border-[var(--border-color)] px-4 py-2 rounded-lg hover:bg-[var(--accent-soft)] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Explore records</span>
          </Link>
        </div>
      ) : (
        <div className="recommendation-grid">
          {savedAlbums.map((alb) => (
            <AlbumCard key={alb.itunesCollectionId} album={alb} />
          ))}
        </div>
      )}

    </div>
  );
}
