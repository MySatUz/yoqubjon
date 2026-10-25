import { create } from 'zustand';
import {
  appendStroke,
  INKS,
  sanitizeStroke,
  WIDTHS,
  type BoardTool,
  type Stroke,
} from '@/components/exam/whiteboard/geometry';

/**
 * The whiteboard's drawings, one page per question of one attempt.
 *
 * A page key is `${attemptId}:${questionId}`. The question id, not its number:
 * numbering starts again in every module, so "question 1" names two different
 * questions in a two-module test, and a drawing keyed by the number would sit
 * over both. The attempt id keeps a new attempt of the same test - the next
 * lesson with the same paper - from opening on the last one's working.
 *
 * Kept in memory, and mirrored to sessionStorage so a reload in the middle of
 * a lesson does not wipe the board. sessionStorage, not localStorage: it is a
 * separate quota, so a heavy drawing can never crowd out the exam answers
 * `useExamStore` keeps in localStorage, and it ends with the tab, which is
 * about as long as a lesson. Undo history stays in memory only.
 */

const STORAGE_PREFIX = 'mysat-board:';
const HISTORY_LIMIT = 100;

interface Page {
  strokes: readonly Stroke[];
  past: readonly (readonly Stroke[])[];
  future: readonly (readonly Stroke[])[];
}

const EMPTY_STROKES: readonly Stroke[] = [];

export const EMPTY_PAGE: Page = { strokes: EMPTY_STROKES, past: [], future: [] };

export function pageKeyFor(attemptId: string, questionId: string) {
  return `${attemptId}:${questionId}`;
}

function safeSessionStorage() {
  try {
    return window.sessionStorage;
  } catch {
    // Blocked storage throws on access, not only on write.
    return null;
  }
}

function writePage(key: string, strokes: readonly Stroke[]) {
  const storage = safeSessionStorage();
  if (!storage) return;
  try {
    if (strokes.length === 0) storage.removeItem(STORAGE_PREFIX + key);
    else storage.setItem(STORAGE_PREFIX + key, JSON.stringify(strokes));
  } catch {
    // Over quota: the page stays in memory and is only lost on reload.
  }
}

/**
 * Reads back this attempt's pages and deletes every other attempt's, so a
 * finished lesson's drawings do not sit in the tab's quota for the rest of
 * the day.
 */
function readAttempt(attemptId: string) {
  const pages: Record<string, Page> = {};
  const storage = safeSessionStorage();
  if (!storage) return pages;

  const ownPrefix = `${STORAGE_PREFIX}${attemptId}:`;
  const stale: string[] = [];

  try {
    for (let i = 0; i < storage.length; i += 1) {
      const name = storage.key(i);
      if (!name?.startsWith(STORAGE_PREFIX)) continue;
      if (!name.startsWith(ownPrefix)) {
        stale.push(name);
        continue;
      }

      let raw: unknown = null;
      try {
        raw = JSON.parse(storage.getItem(name) ?? 'null');
      } catch {
        raw = null;
      }
      const strokes = Array.isArray(raw)
        ? raw.map(sanitizeStroke).filter((stroke): stroke is Stroke => stroke !== null)
        : [];
      if (strokes.length > 0) {
        pages[name.slice(STORAGE_PREFIX.length)] = { ...EMPTY_PAGE, strokes };
      } else {
        stale.push(name);
      }
    }
    for (const name of stale) storage.removeItem(name);
  } catch {
    // Storage that cannot be read is storage with nothing in it.
  }

  return pages;
}

export interface PanelOffset {
  x: number;
  y: number;
}

/** The side of the window the toolbar is docked to, standing in a column; null while it floats. */
export type PanelDock = 'left' | 'right' | null;

interface BoardState {
  attemptId: string | null;
  pages: Record<string, Page>;
  tool: BoardTool;
  colorIndex: number;
  width: number;
  /** Where the toolbar was dragged to, kept across questions and modules. */
  panelOffset: PanelOffset;
  /** The side it was docked to, kept the same way. The offset is where it floats again. */
  panelDock: PanelDock;

  bindAttempt: (attemptId: string) => void;
  /**
   * Forgets every page whose key starts with `keyPrefix` - its strokes, its
   * history and the tab's copy. For the admin Board, which never goes back to
   * a question it has left; the exam never calls it.
   */
  discardPages: (keyPrefix: string) => void;
  addStroke: (key: string, stroke: Stroke) => void;
  replaceStrokes: (key: string, strokes: readonly Stroke[]) => void;
  clear: (key: string) => void;
  undo: (key: string) => void;
  redo: (key: string) => void;
  setTool: (tool: BoardTool) => void;
  setColorIndex: (index: number) => void;
  setWidth: (width: number) => void;
  setPanelOffset: (offset: PanelOffset) => void;
  setPanelDock: (dock: PanelDock) => void;
}

export const useBoardStore = create<BoardState>()((set, get) => {
  /** Every change to a page goes through here: one history entry, one write. */
  const change = (key: string, next: readonly Stroke[]) => {
    const page = get().pages[key] ?? EMPTY_PAGE;
    if (next === page.strokes) return;
    writePage(key, next);
    set((state) => ({
      pages: {
        ...state.pages,
        [key]: {
          strokes: next,
          past: [...page.past, page.strokes].slice(-HISTORY_LIMIT),
          future: [],
        },
      },
    }));
  };

  return {
    attemptId: null,
    pages: {},
    tool: 'pen',
    colorIndex: 0,
    width: WIDTHS[1],
    panelOffset: { x: 0, y: 0 },
    panelDock: null,

    // The store outlives the exam page - client navigation keeps modules
    // loaded - so it has to be told which attempt is on screen, and it drops
    // everything belonging to any other.
    bindAttempt: (attemptId) => {
      if (get().attemptId === attemptId) return;
      set({ attemptId, pages: readAttempt(attemptId) });
    },

    discardPages: (keyPrefix) => {
      const storage = safeSessionStorage();
      if (storage) {
        try {
          const names: string[] = [];
          for (let i = 0; i < storage.length; i += 1) {
            const name = storage.key(i);
            if (name?.startsWith(STORAGE_PREFIX + keyPrefix)) names.push(name);
          }
          for (const name of names) storage.removeItem(name);
        } catch {
          // Storage that cannot be read holds nothing of these pages.
        }
      }

      const pages = get().pages;
      const kept = Object.fromEntries(Object.entries(pages).filter(([key]) => !key.startsWith(keyPrefix)));
      if (Object.keys(kept).length !== Object.keys(pages).length) set({ pages: kept });
    },

    addStroke: (key, stroke) => change(key, appendStroke((get().pages[key] ?? EMPTY_PAGE).strokes, stroke)),

    replaceStrokes: (key, strokes) => change(key, strokes),

    clear: (key) => {
      if ((get().pages[key] ?? EMPTY_PAGE).strokes.length === 0) return;
      change(key, EMPTY_STROKES);
    },

    undo: (key) => {
      const page = get().pages[key];
      if (!page || page.past.length === 0) return;
      const previous = page.past[page.past.length - 1];
      writePage(key, previous);
      set((state) => ({
        pages: {
          ...state.pages,
          [key]: {
            strokes: previous,
            past: page.past.slice(0, -1),
            future: [...page.future, page.strokes].slice(-HISTORY_LIMIT),
          },
        },
      }));
    },

    redo: (key) => {
      const page = get().pages[key];
      if (!page || page.future.length === 0) return;
      const next = page.future[page.future.length - 1];
      writePage(key, next);
      set((state) => ({
        pages: {
          ...state.pages,
          [key]: {
            strokes: next,
            past: [...page.past, page.strokes].slice(-HISTORY_LIMIT),
            future: page.future.slice(0, -1),
          },
        },
      }));
    },

    setTool: (tool) => set({ tool }),
    setColorIndex: (index) => set({ colorIndex: Math.min(Math.max(index, 0), INKS.length - 1) }),
    setWidth: (width) => set({ width }),
    setPanelOffset: (offset) => set({ panelOffset: offset }),
    setPanelDock: (dock) => set({ panelDock: dock }),
  };
});

export function currentInk(colorIndex: number) {
  return INKS[colorIndex]?.value ?? INKS[0].value;
}
