'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Info, ArrowRight, Bookmark, Check } from 'lucide-react';
import { Album, SimilarityResult } from '../lib/types';
import { CoverArtwork } from './CoverArtwork';

interface AlbumCardProps { album: Album; similarity?: SimilarityResult; onWhyMatchClick?: (result: SimilarityResult) => void; showExploreButton?: boolean; }

export const AlbumCard: React.FC<AlbumCardProps> = ({ album, similarity, onWhyMatchClick, showExploreButton = true }) => {
  const router = useRouter();
  const [isSaved, setIsSaved] = useState(false);
  const matchPercentage = similarity ? Math.round(similarity.finalScore * 100) : null;
  const toggleSave = (event: React.MouseEvent) => {
    event.preventDefault(); event.stopPropagation();
    try {
      const saved = JSON.parse(localStorage.getItem('articol_saved_albums') || '[]');
      const next = isSaved ? saved.filter((item: Album) => item.itunesCollectionId !== album.itunesCollectionId) : [...saved, album];
      localStorage.setItem('articol_saved_albums', JSON.stringify(next)); setIsSaved(!isSaved);
    } catch (error) { console.warn('LocalStorage save failed:', error); }
  };
  const handleExplore = (event: React.MouseEvent) => { event.preventDefault(); router.push(`/album/${album.itunesCollectionId}`); };

  return <article className="group flex flex-col overflow-hidden rounded-xl bg-[var(--bg-card)] ring-1 ring-[var(--border-color)] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5 hover:ring-[var(--text-muted)]/45 focus-within:ring-[var(--text-muted)]/60">
    <div className="relative aspect-square w-full overflow-hidden bg-[var(--accent-soft)]">
      <CoverArtwork src={album.artworkUrl} alt={`Cover artwork for ${album.title} by ${album.artistName}`} sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw" className="transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-[1.03] group-focus-within:scale-[1.03]" />
      {matchPercentage !== null && <span className="absolute top-2.5 right-2.5 px-2 py-1 rounded bg-black/80 text-[11px] font-mono text-white">{matchPercentage}% match</span>}
      <button onClick={toggleSave} className="absolute top-2.5 left-2.5 p-2 rounded-full bg-black/60 hover:bg-black/85 text-white transition-colors" title={isSaved ? 'Remove from saved' : 'Save cover'} aria-label={isSaved ? `Remove ${album.title} from saved` : `Save ${album.title}`}>
        {isSaved ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Bookmark className="w-3.5 h-3.5" />}
      </button>
    </div>
    <div className="p-3.5 flex flex-col flex-1 justify-between space-y-3">
      <div><Link href={`/album/${album.itunesCollectionId}`} className="block hover:text-blue-500 transition-colors"><h4 className="text-sm font-serif font-semibold truncate leading-tight text-[var(--text-primary)]">{album.title}</h4></Link><p className="text-xs text-[var(--text-muted)] truncate mt-0.5">{album.artistName}</p><p className="text-[10px] uppercase font-mono tracking-wider text-[var(--text-muted)] mt-2">{album.genre} · {album.releaseYear}</p></div>
      {similarity?.matchReasons?.length ? <div className="flex flex-wrap gap-1">{similarity.matchReasons.slice(0, 2).map((reason, index) => <span key={index} className="text-[10px] px-2 py-0.5 rounded bg-[var(--tag-bg)] text-[var(--text-muted)] font-mono truncate max-w-full">{reason.label}</span>)}</div> : null}
      <div className="flex items-center justify-between gap-2 pt-1">
        {album.dominantPalette?.length ? <div className="flex -space-x-1" aria-label="Extracted cover palette">{album.dominantPalette.slice(0, 5).map((color, index) => <span key={index} className="w-4 h-4 rounded-full ring-1 ring-[var(--bg-card)]" style={{ backgroundColor: color.hex }} title={color.hex} />)}</div> : <span />}
        <div className="flex items-center gap-1.5">{similarity && onWhyMatchClick ? <button onClick={(event) => { event.preventDefault(); onWhyMatchClick(similarity); }} className="min-h-9 min-w-9 px-2.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-soft)] transition-colors" aria-label={`Why ${album.title} is a match`}><Info className="w-3.5 h-3.5" /></button> : null}{showExploreButton ? <button onClick={handleExplore} className="min-h-9 px-3 rounded-md bg-[var(--accent-editorial)] text-[var(--bg-canvas)] text-[11px] font-medium inline-flex items-center gap-1.5 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:opacity-90 active:scale-[0.98]"><span>Explore this cover</span><ArrowRight className="w-3.5 h-3.5" /></button> : null}</div>
      </div>
    </div>
  </article>;
};
