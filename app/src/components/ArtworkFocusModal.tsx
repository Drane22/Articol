'use client';

import { X } from 'lucide-react';
import type { Album } from '@/lib/types';
import { CoverArtwork } from './CoverArtwork';
import { DialogFrame } from './DialogFrame';

export function ArtworkFocusModal({ album, onClose }: { album: Album; onClose: () => void }) {
  return (
    <DialogFrame ariaLabelledBy="artwork-focus-title" panelClassName="artwork-focus-dialog" scrollContent={false} onClose={onClose}>
      {({ closeButtonRef, requestClose }) => (
        <div className="artwork-focus-dialog__content">
          <div className="artwork-focus-dialog__header">
            <div className="min-w-0">
              <p className="eyebrow-label">Cover study</p>
              <h2 id="artwork-focus-title" className="truncate font-serif text-lg text-[var(--text-primary)]">{album.title}</h2>
              <p className="truncate text-xs text-[var(--text-muted)]">{album.artistName}</p>
            </div>
            <button type="button" ref={closeButtonRef} onClick={requestClose} className="icon-button icon-button--quiet" aria-label="Close artwork view">
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <div className="artwork-focus-dialog__image">
            <CoverArtwork src={album.artworkUrl} alt={`Cover artwork for ${album.title} by ${album.artistName}`} sizes="(max-width: 640px) 92vw, 900px" priority />
          </div>
        </div>
      )}
    </DialogFrame>
  );
}
