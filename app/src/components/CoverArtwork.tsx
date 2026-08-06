'use client';

import { useEffect, useState } from 'react';
import { ImageOff, RotateCw } from 'lucide-react';

interface CoverArtworkProps {
  src: string;
  alt: string;
  priority?: boolean;
  sizes: string;
  className?: string;
}

export function CoverArtwork({ src, alt, priority = false, className = '' }: CoverArtworkProps) {
  const [mode, setMode] = useState<'direct' | 'proxy' | 'failed'>('proxy');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setMode('proxy');
    setAttempt(0);
  }, [src]);

  const handleError = () => {
    setMode((current) => {
      if (current === 'proxy') return 'direct';
      return 'failed';
    });
  };

  const handleRetry = () => {
    setMode('proxy');
    setAttempt((v) => v + 1);
  };

  if (!src || mode === 'failed') {
    return (
      <div className="cover-artwork-fallback" role="img" aria-label={`${alt} artwork unavailable`}>
        <ImageOff className="w-6 h-6" />
        <span>Cover unavailable</span>
        {src && (
          <button type="button" onClick={handleRetry} className="cover-retry">
            <RotateCw className="w-3 h-3" />
            Retry
          </button>
        )}
      </div>
    );
  }

  const currentSrc = mode === 'proxy' ? `/api/proxy-image?url=${encodeURIComponent(src)}` : src;

  return (
    <img
      key={`${src}-${attempt}-${mode}`}
      src={currentSrc}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={handleError}
      className={`absolute inset-0 h-full w-full object-cover ${className}`}
    />
  );
}
