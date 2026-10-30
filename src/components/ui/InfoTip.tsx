'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { Info } from 'lucide-react';
import { iconButtonClass } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';

/**
 * An "i" beside a page title (`PageHeader`'s `info`), for the line that
 * explains a page to someone new and would otherwise push its controls down
 * for everyone else. Ghost, like a toolbar's icon: an "i" says "press me" by
 * itself, and a keyed box would weigh more than the title.
 *
 * A mouse resting on it shows the note; a press pins it open, the only way on
 * a touch screen. Escape and a press elsewhere close it, as the other
 * popovers here do (AttentionButton). The note is in the popover style:
 * white, a gray-200 edge, shadow-lg.
 */
export function InfoTip({ label, children }: { label: string; children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hovered || pinned;
  const noteId = useId();
  const rootRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = () => {
      setHovered(false);
      setPinned(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      close();
      buttonRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  // A finger "enters" on every tap; only a mouse hovers.
  const onHover = (event: React.PointerEvent, value: boolean) => {
    if (event.pointerType === 'mouse') setHovered(value);
  };

  return (
    <span
      ref={rootRef}
      className="relative inline-flex"
      onPointerEnter={(event) => onHover(event, true)}
      onPointerLeave={(event) => onHover(event, false)}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={noteId}
        onClick={() => setPinned((value) => !value)}
        className={iconButtonClass({ size: 'sm', className: open ? 'bg-gray-100' : undefined })}
      >
        <Info className="h-4 w-4" />
      </button>
      <span
        id={noteId}
        role="note"
        hidden={!open}
        className={cn(
          'absolute left-0 top-full z-40 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-gray-200 bg-white p-4',
          'text-sm leading-6 text-gray-700 shadow-lg',
        )}
      >
        {children}
      </span>
    </span>
  );
}
