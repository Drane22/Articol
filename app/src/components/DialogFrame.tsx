'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { acquirePageScrollLock } from '@/lib/pageScrollLock';

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

interface DialogFrameControls {
  closeButtonRef: React.RefObject<HTMLButtonElement | null>;
  isClosing: boolean;
  requestClose: () => void;
}

interface DialogFrameProps {
  ariaLabelledBy: string;
  ariaDescribedBy?: string;
  panelClassName?: string;
  onClose: () => void;
  children: (controls: DialogFrameControls) => React.ReactNode;
}

export function DialogFrame({
  ariaLabelledBy,
  ariaDescribedBy,
  panelClassName = '',
  onClose,
  children,
}: DialogFrameProps) {
  const [isClosing, setIsClosing] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const requestClose = useCallback(() => {
    setIsClosing((closing) => {
      if (closing) return closing;
      closeTimerRef.current = window.setTimeout(() => onCloseRef.current(), 160);
      return true;
    });
  }, []);

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const releaseScrollLock = acquirePageScrollLock(document);
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        requestClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) || [],
      );
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
      document.removeEventListener('keydown', handleKeyDown);
      releaseScrollLock();
      previousFocusRef.current?.focus?.();
    };
  }, [requestClose]);

  return (
    <div
      className={`share-dialog-backdrop${isClosing ? ' is-closing' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
      onClick={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <div
        ref={panelRef}
        className={`share-dialog-panel ${panelClassName}${isClosing ? ' is-closing' : ''}`.trim()}
      >
        <div className="dialog-frame__scroll">
          {children({ closeButtonRef, isClosing, requestClose })}
        </div>
      </div>
    </div>
  );
}
