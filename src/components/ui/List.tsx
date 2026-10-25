import React from 'react';
import { cn } from '@/components/ui/cn';
import { cardClass } from '@/components/ui/Card';

/**
 * Collections of records are ONE card with divided rows — not a stack of
 * separate bordered cards, each with its own padding and shadow.
 */
export function List({ className, children }: { className?: string; children: React.ReactNode }) {
  return <ul className={cn(cardClass, 'divide-y divide-mist-100 overflow-hidden', className)}>{children}</ul>;
}

/**
 * Row geometry for <List>. Put it on the <li>, or on the <Link> inside it.
 * The focus outline is inset: the list clips its rows to the card's rounded
 * corners (overflow-hidden), and an outline outside the row would be cut off.
 * On an <li> it never shows - only a focusable row can match focus-visible.
 */
export const listRowClass =
  'flex items-center gap-4 px-4 py-3 sm:px-5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-board-600';
export const listRowInteractiveClass = cn(listRowClass, 'transition-colors hover:bg-mist-50 focus-visible:bg-mist-50');

/**
 * Trailing chevron of a row or card that opens something. mist-400, not 300:
 * mist-300 on white is 1.5:1 and the chevron vanished. The row needs `group`.
 */
export const rowChevronClass = 'h-4 w-4 shrink-0 text-mist-400 transition-colors group-hover:text-mist-600';

/* Tables — for admin data with real columns. */
export const tableWrapClass = cn(cardClass, 'overflow-x-auto');
export const tableClass = 'w-full text-left text-sm';
export const thClass = 'whitespace-nowrap border-b border-mist-200 bg-mist-50 px-4 py-2.5 text-xs font-medium text-mist-600';
export const tdClass = 'border-b border-mist-100 px-4 py-3 align-middle text-mist-700';

/** Title + one meta line, the left side of most rows. */
export function RowText({
  title,
  meta,
  className,
}: {
  title: React.ReactNode;
  meta?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('min-w-0 flex-1', className)}>
      <p className="truncate text-sm font-medium text-mist-900">{title}</p>
      {meta && <p className="mt-0.5 truncate text-xs text-mist-500">{meta}</p>}
    </div>
  );
}
