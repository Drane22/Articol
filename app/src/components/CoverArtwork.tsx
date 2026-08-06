'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ImageOff, RotateCw } from 'lucide-react';

interface CoverArtworkProps {
  src: string;
  alt: string;
  priority?: boolean;
  sizes: string;
  className?: string;
}

export function CoverArtwork({ src, alt, priority = false, sizes, className = '' }: CoverArtworkProps) {
  const [mode, setMode] = useState<'direct' | 'proxy' | 'failed'>('direct');
  const [attempt, setAttempt] = useState(0);

  const handleError = () => {
    setMode((current) => {
      if (current === 'direct') return 'proxy';
      return 'failed';
    });
  };

  const handleRetry = () => {
    setMode('direct');
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
    <Image
      key={`${src}-${attempt}-${mode}`}
      src={currentSrc}
      alt={alt}
      fill
      priority={priority}
      sizes={sizes}
      unoptimized={true}
      onError={handleError}
      className={`object-cover ${className}`}
    />
  );
}
