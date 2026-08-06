'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ImageOff, RotateCw } from 'lucide-react';

interface CoverArtworkProps { src: string; alt: string; priority?: boolean; sizes: string; className?: string; }

export function CoverArtwork({ src, alt, priority = false, sizes, className = '' }: CoverArtworkProps) {
  const [mode, setMode] = useState<'optimized' | 'direct' | 'failed'>('optimized');
  const [attempt, setAttempt] = useState(0);
  if (!src || mode === 'failed') return <div className="cover-artwork-fallback" role="img" aria-label={`${alt} artwork unavailable`}><ImageOff className="w-6 h-6" /><span>Cover unavailable</span>{src && <button type="button" onClick={() => { setMode('optimized'); setAttempt(value => value + 1); }} className="cover-retry"><RotateCw className="w-3 h-3" />Retry</button>}</div>;
  return <Image key={`${src}-${attempt}-${mode}`} src={src} alt={alt} fill priority={priority} sizes={sizes} unoptimized={mode === 'direct'} onError={() => setMode(current => current === 'optimized' ? 'direct' : 'failed')} className={`object-cover ${className}`} />;
}
