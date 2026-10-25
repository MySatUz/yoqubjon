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
/** Below Tailwind's `md`, a window turns into a bottom sheet. */
export const PHONE_MAX_WIDTH = 767;

/**
 * Below this the question column stays centred and an open window covers
 * part of it, as in Bluebook: there is no room to move it aside.
 */
const COLUMN_SHIFT_MIN_VIEWPORT = 1240;
/** The question column (`max-w-[680px]`) plus its `md:px-8` gutters. */
const COLUMN_FOOTPRINT = 680 + 2 * 32;

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
  if (viewportWidth < COLUMN_SHIFT_MIN_VIEWPORT) return 0;

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

  const reach = Math.max(0, (viewportWidth - COLUMN_FOOTPRINT) / 2);
  const offset = (left + right) / 2 - viewportWidth / 2;
  return Math.round(Math.min(reach, Math.max(-reach, offset)));
}

/** A number, so the column only re-renders when where it goes really changes. */
export function useColumnOffset() {
  return useSyncExternalStore(
    subscribeToLayout,
    () => columnOffset(window.innerWidth),
    () => 0
  );
}

/** How much of the question an open bottom sheet covers, on a phone. */
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
  /** The bottom sheet's height on a phone. */
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
