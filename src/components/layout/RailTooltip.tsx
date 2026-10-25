import React from 'react';
import { cn } from '@/components/ui/cn';

/*
 * A plain module, not 'use client': the server-rendered shell (AppShellFrame)
 * needs the focus class too, and a string exported from a client module
 * reaches a server component as a client reference, not as the string.
 */

/** Keyboard focus on the deep board-green sidebar: the accent outline would vanish on `board-950`. */
export const sidebarFocusClass = 'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white';

/**
 * The label a collapsed rail row shows beside it, on hover and on keyboard
 * focus. The row keeps its own label in the accessibility tree (sr-only while
 * collapsed), so this copy is aria-hidden. It replaces `title`, which showed
 * only to a resting mouse, a second later, and never to the keyboard.
 *
 * The row needs `group` and `relative`; the tip opens past the sidebar's right
 * edge, over the canvas, in the popover style (white, mist border, shadow-lg).
 * `className` is for the horizontal offset only.
 *
 * `w-max max-w-64`: as wide as the label up to 16rem, then it wraps (a long
 * student name would otherwise run across the page). An absolutely placed box
 * at `left-full` has no room of its own, so without `w-max` it would wrap at
 * every word. `wrap-anywhere`, not `break-words`: only it lets a flex box
 * shrink below one unbroken word. One line is the min-h-8, 32px: its 20px line,
 * py-1 and the border come to 30 (py-1.5 made it 34).
 */
export function RailTooltip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'pointer-events-none absolute left-full top-1/2 z-10 hidden min-h-8 w-max max-w-64 -translate-y-1/2 items-center wrap-anywhere rounded-lg border border-mist-200 bg-white px-3 py-1 text-sm font-medium leading-5 text-mist-900 shadow-lg',
        'collapsed:group-hover:flex collapsed:group-focus-visible:flex',
        className ?? 'ml-3',
      )}
    >
      {children}
    </span>
  );
}
