'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { buttonClass } from '@/components/ui/Button';

/**
 * "Needs attention" as one small button beside the page's other actions,
 * like a notification: a bell and the number of things waiting. The list it
 * opens is rendered by the page (server rows: payments, access ending,
 * hidden imports, the olympiad) and passed in as `children`.
 *
 * It used to be a card above the courses table, which pushed the table down
 * on every visit for things that are only sometimes urgent (the owner's
 * call). The button is not drawn at all when nothing waits.
 *
 * A popover, not a dialog: no focus trap, Escape and a press outside close
 * it, and focus returns to the button. A row's own action (Extend opens Give
 * access, whose dialog lives in GiveAccessHost above) keeps working after the
 * popover closes.
 */
export function AttentionButton({ count, children }: { count: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // A Give access dialog opened from a row is a modal over the page: its
      // Escape is its own.
      if (event.target instanceof Element && event.target.closest('[aria-modal="true"]')) return;
      setOpen(false);
      buttonRef.current?.focus();
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`Needs attention: ${count}`}
        title="Needs attention"
        onClick={() => setOpen((value) => !value)}
        className={buttonClass({ variant: 'secondary', className: open ? 'bg-gray-100' : undefined })}
      >
        <Bell className="h-4 w-4" />
        {/* Amber: things waiting for a decision or about to expire. */}
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-50 px-1.5 text-xs font-medium tabular-nums text-amber-800">
          {count}
        </span>
      </button>

      {open && (
        <div
          id={panelId}
          role="region"
          aria-label="Needs attention"
          className="z-40 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg max-sm:fixed max-sm:inset-x-4 max-sm:top-16 sm:absolute sm:right-0 sm:top-full sm:mt-2 sm:w-md"
        >
          <p className="border-b border-gray-200 px-4 py-3 text-sm font-semibold text-gray-900 sm:px-5">Needs attention</p>
          <div className="max-h-[min(28rem,70vh)] overflow-y-auto">{children}</div>
        </div>
      )}
    </div>
  );
}
