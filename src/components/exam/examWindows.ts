"use client";

import { useSyncExternalStore } from 'react';

/**
 * Shared, non-persisted state for the exam's floating windows - the graphing
 * calculator and the reference sheet (see `FloatingWindow`).
 *
 * Deliberately not in `useExamStore`: where a window sits is screen layout,
 * not part of the attempt, and nothing about it may reach the persisted exam
 * state. The question column reads the windows' footprints from here to slide
 * out from under them, and each window's own position and size is kept in
 * sessionStorage by the window itself.
 */

/** TopNav is `h-14`. */
export const TOP_BAR_HEIGHT = 56;
/** BottomNav is `h-16`. */
export const BOTTOM_BAR_HEIGHT = 64;
/** How far a window first opens from the screen's edge. */
export const WINDOW_MARGIN = 24;
/** The narrowest a window is drawn, unless the screen itself is narrower. */
export const WINDOW_MIN_WIDTH = 360;
/** The question surface's `md:px-8` on each side of the column. */
const COLUMN_GUTTER = 32;

/**
 * Up to this width a window is a bottom sheet over the answers, and the
 * question scrolls up above it: a phone, a tablet held upright. From the next
 * pixel a window at its minimum fits beside the question column (680px and
 * its gutters, the steps below 1600px), so it floats there and the column
 * moves out from under it - on a tablet on its side as on a laptop.
 */
export const SHEET_MAX_WIDTH = 680 + 2 * COLUMN_GUTTER + WINDOW_MIN_WIDTH + WINDOW_MARGIN - 1;

/**
 * The question column's width at a viewport width: the steps of `columnClass`
 * in questionParts.tsx (680, 760 and 840px), which must change together with
 * these.
 */
function questionColumnWidth(viewportWidth: number) {
  if (viewportWidth >= 2200) return 840;
  if (viewportWidth >= 1600) return 760;
  return 680;
}

/** The question column plus its gutters. */
function columnFootprint(viewportWidth: number) {
  return questionColumnWidth(viewportWidth) + 2 * COLUMN_GUTTER;
}

/**
 * How wide a window first opens: its own width where that leaves the question
 * column room beside it, narrower where it would not (a tablet on its side, a
 * small laptop), and never under its minimum.
 */
export function openingWindowWidth(viewportWidth: number, defaultWidth: number, minWidth: number) {
  const room = viewportWidth - columnFootprint(viewportWidth) - WINDOW_MARGIN;
  return Math.min(defaultWidth, Math.max(minWidth, room));
}

export type WindowId = 'calculator' | 'reference';

export type Rect = { x: number; y: number; width: number; height: number };

/** What an open window covers: a span of the screen's width, or a sheet's height. */
export type WindowFootprint =
  | { kind: 'window'; left: number; right: number }
  | { kind: 'sheet'; height: number };

type Footprints = Partial<Record<WindowId, WindowFootprint>>;

let footprints: Footprints = {};
let frontWindow: WindowId | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit() {
  for (const listener of listeners) listener();
}

function sameFootprint(a: WindowFootprint | null, b: WindowFootprint | null) {
  if (a === null || b === null) return a === b;
  if (a.kind === 'window' && b.kind === 'window') return a.left === b.left && a.right === b.right;
  if (a.kind === 'sheet' && b.kind === 'sheet') return a.height === b.height;
  return false;
}

/** `null` when the window is closed or gone. */
export function setWindowFootprint(id: WindowId, footprint: WindowFootprint | null) {
  if (sameFootprint(footprints[id] ?? null, footprint)) return;
  const next = { ...footprints };
  if (footprint) next[id] = footprint;
  else delete next[id];
  footprints = next;
  emit();
}

export function bringWindowToFront(id: WindowId) {
  if (frontWindow === id) return;
  frontWindow = id;
  emit();
}

export function useIsFrontWindow(id: WindowId) {
  return useSyncExternalStore(
    subscribe,
    () => frontWindow === id,
    () => false
  );
}

/* ------------------------------------------------------------- viewport */

function subscribeToViewport(listener: () => void) {
  window.addEventListener('resize', listener);
  return () => window.removeEventListener('resize', listener);
}

const SERVER_VIEWPORT = { width: 1280, height: 800 };
let viewportSnapshot = SERVER_VIEWPORT;

/** The same object until the size really changes, as `useSyncExternalStore` needs. */
function readViewport() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  if (width !== viewportSnapshot.width || height !== viewportSnapshot.height) {
    viewportSnapshot = { width, height };
  }
  return viewportSnapshot;
}

export function useViewport() {
  return useSyncExternalStore(subscribeToViewport, readViewport, () => SERVER_VIEWPORT);
}

/* ------------------------------------------------------- question column */

function subscribeToLayout(listener: () => void) {
  const unsubscribeWindows = subscribe(listener);
  const unsubscribeViewport = subscribeToViewport(listener);
  return () => {
    unsubscribeWindows();
    unsubscribeViewport();
  };
}

/**
 * How far the question column moves sideways - never how wide it is. A
 * window on the left half pushes it right, one on the right half pushes it
 * left, and it settles in the middle of what is left uncovered. It never moves
 * so far that it would leave the screen; whatever a window still covers after
 * that, it covers, as in Bluebook.
 */
function columnOffset(viewportWidth: number) {
  if (viewportWidth <= SHEET_MAX_WIDTH) return 0;

  let left = 0;
  let right = viewportWidth;
  let hasWindow = false;
  for (const footprint of Object.values(footprints)) {
    if (footprint?.kind !== 'window') continue;
    hasWindow = true;
    if ((footprint.left + footprint.right) / 2 < viewportWidth / 2) left = Math.max(left, footprint.right);
    else right = Math.min(right, footprint.left);
  }
  if (!hasWindow) return 0;

  const reach = Math.max(0, (viewportWidth - columnFootprint(viewportWidth)) / 2);
  const offset = (left + right) / 2 - viewportWidth / 2;
  return Math.round(Math.min(reach, Math.max(-reach, offset)));
}

/**
 * The same for a column held at the left edge (the Board's), whose text
 * starts `start` px in: a window on the left half pushes it right until it is
 * a gutter clear of the window; one on the right half lies over the free side
 * and leaves it where it is. It never moves so far that it would leave the
 * screen.
 */
function leftColumnOffset(viewportWidth: number, start: number) {
  if (viewportWidth <= SHEET_MAX_WIDTH) return 0;

  let left = 0;
  for (const footprint of Object.values(footprints)) {
    if (footprint?.kind !== 'window') continue;
    if ((footprint.left + footprint.right) / 2 < viewportWidth / 2) left = Math.max(left, footprint.right);
  }
  if (left === 0) return 0;

  const reach = Math.max(0, viewportWidth - start - columnFootprint(viewportWidth) + COLUMN_GUTTER);
  return Math.round(Math.min(reach, Math.max(0, left + COLUMN_GUTTER - start)));
}

/**
 * A number, so the column only re-renders when where it goes really changes.
 * `leftStart`: for a column held at the left edge, where its text starts.
 */
export function useColumnOffset(leftStart?: number) {
  return useSyncExternalStore(
    subscribeToLayout,
    () =>
      leftStart === undefined
        ? columnOffset(window.innerWidth)
        : leftColumnOffset(window.innerWidth, leftStart),
    () => 0
  );
}

/** How much of the question an open bottom sheet covers (see `SHEET_MAX_WIDTH`). */
export function useSheetInset() {
  return useSyncExternalStore(
    subscribe,
    () => {
      let inset = 0;
      for (const footprint of Object.values(footprints)) {
        if (footprint?.kind === 'sheet') inset = Math.max(inset, footprint.height);
      }
      return inset;
    },
    () => 0
  );
}

/* ------------------------------------------------------- sessionStorage */

const STORAGE_PREFIX = 'mysat-exam-window:';

export type SavedWindow = {
  /** `null` until the student moves or resizes it: it opens where it should. */
  rect: Rect | null;
  expanded: boolean;
  /** The bottom sheet's height (see `SHEET_MAX_WIDTH`). */
  sheetHeight: number | null;
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

function readRect(value: unknown): Rect | null {
  if (!value || typeof value !== 'object') return null;
  const { x, y, width, height } = value as Record<string, unknown>;
  return isFiniteNumber(x) && isFiniteNumber(y) && isFiniteNumber(width) && isFiniteNumber(height)
    ? { x, y, width, height }
    : null;
}

/** Remembered for the browser tab, like the whiteboard's pages; anything unreadable is dropped. */
export function readSavedWindow(id: WindowId): SavedWindow {
  const fallback: SavedWindow = { rect: null, expanded: false, sheetHeight: null };
  if (typeof window === 'undefined') return fallback;

  try {
    const raw = window.sessionStorage.getItem(STORAGE_PREFIX + id);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      rect: readRect(parsed.rect),
      expanded: parsed.expanded === true,
      sheetHeight: isFiniteNumber(parsed.sheetHeight) ? parsed.sheetHeight : null,
    };
  } catch {
    return fallback;
  }
}

export function saveWindow(id: WindowId, value: SavedWindow) {
  try {
    window.sessionStorage.setItem(STORAGE_PREFIX + id, JSON.stringify(value));
  } catch {
    // Private mode or a full quota: the window just opens at its default place next time.
  }
}
