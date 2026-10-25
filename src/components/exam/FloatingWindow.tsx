"use client";

import React, { useEffect, useRef, useState } from 'react';
import { GripHorizontal, Maximize2, Minimize2, X } from 'lucide-react';
import { iconButtonClass } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import {
  PHONE_MAX_WIDTH,
  BOTTOM_BAR_HEIGHT,
  TOP_BAR_HEIGHT,
  bringWindowToFront,
  readSavedWindow,
  saveWindow,
  setWindowFootprint,
  useIsFrontWindow,
  useViewport,
  type Rect,
  type SavedWindow,
  type WindowId,
} from '@/components/exam/examWindows';

/** Where a window first opens: this far from the screen edge and from the bars. */
const OPEN_MARGIN_X = 24;
const OPEN_MARGIN_Y = 16;
/** Share of the screen's width an expanded window takes. */
const EXPANDED_SHARE = 0.6;
/**
 * Share of the screen's height a bottom sheet first takes on a phone: half,
 * so the question stays readable above it.
 */
const SHEET_SHARE = 0.5;
const SHEET_MIN_HEIGHT = 160;
/** How far a press has to travel before it moves or resizes the window. */
const DRAG_THRESHOLD = 3;

interface FloatingWindowProps {
  id: WindowId;
  title: string;
  isOpen: boolean;
  onClose: () => void;
  closeLabel: string;
  /** The edge it first opens against. */
  side: 'left' | 'right';
  defaultWidth: number;
  minWidth?: number;
  minHeight?: number;
  children: React.ReactNode;
}

type Interaction =
  | { kind: 'move' | 'resize'; pointerId: number; startX: number; startY: number; origin: Rect; moved: boolean }
  | { kind: 'sheet'; pointerId: number; startY: number; originHeight: number };

/** Between the two bars, the full width of the screen. */
type Area = { top: number; bottom: number; width: number };

function areaOf(viewport: { width: number; height: number }): Area {
  return {
    top: TOP_BAR_HEIGHT,
    bottom: Math.max(TOP_BAR_HEIGHT, viewport.height - BOTTOM_BAR_HEIGHT),
    width: viewport.width,
  };
}

/**
 * Inside the area, and no smaller than the minimum unless the screen itself
 * is. The bars stay uncovered, so Next and Finish are always in reach.
 */
function fitRect(rect: Rect, area: Area, minWidth: number, minHeight: number): Rect {
  const areaHeight = area.bottom - area.top;
  const width = Math.min(Math.max(rect.width, Math.min(minWidth, area.width)), area.width);
  const height = Math.min(Math.max(rect.height, Math.min(minHeight, areaHeight)), areaHeight);
  return {
    x: Math.min(Math.max(rect.x, 0), area.width - width),
    y: Math.min(Math.max(rect.y, area.top), area.bottom - height),
    width,
    height,
  };
}

function openingRect(side: 'left' | 'right', defaultWidth: number, area: Area): Rect {
  const width = Math.min(defaultWidth, area.width - 2 * OPEN_MARGIN_X);
  return {
    x: side === 'left' ? OPEN_MARGIN_X : area.width - width - OPEN_MARGIN_X,
    y: area.top + OPEN_MARGIN_Y,
    width,
    height: area.bottom - area.top - 2 * OPEN_MARGIN_Y,
  };
}

/** Full height, ~60% of the width, against whichever edge the window is nearer. */
function expandedRect(rect: Rect, area: Area): Rect {
  const width = Math.min(
    Math.max(rect.width, Math.round(area.width * EXPANDED_SHARE)),
    area.width - 2 * OPEN_MARGIN_X
  );
  const isOnLeft = rect.x + rect.width / 2 < area.width / 2;
  return {
    x: isOnLeft ? OPEN_MARGIN_X : area.width - width - OPEN_MARGIN_X,
    y: area.top + OPEN_MARGIN_Y,
    width,
    height: area.bottom - area.top - 2 * OPEN_MARGIN_Y,
  };
}

function fitSheetHeight(height: number, area: Area) {
  const areaHeight = area.bottom - area.top;
  return Math.round(Math.min(Math.max(height, Math.min(SHEET_MIN_HEIGHT, areaHeight)), areaHeight));
}

/**
 * A non-modal tool window over the exam, like Bluebook's: dragged by its title
 * bar, resized from its bottom-right corner, expanded to ~60% of the width and
 * back. Below `md` it is a full-width bottom sheet over the answers instead,
 * resized by its handle. Where it sits and how big it is are remembered for
 * the browser tab.
 *
 * One element tree in every mode, and `hidden` when closed rather than
 * unmounted by the window itself: moving an iframe in the DOM reloads it, and
 * the calculator's Desmos must never reload (see `SplitScreen`). The optional
 * pieces are conditional siblings, which keep `children` in the same slot.
 */
export default function FloatingWindow({
  id,
  title,
  isOpen,
  onClose,
  closeLabel,
  side,
  defaultWidth,
  minWidth = 360,
  minHeight = 420,
  children,
}: FloatingWindowProps) {
  const viewport = useViewport();
  const isFront = useIsFrontWindow(id);
  const [placement, setPlacement] = useState<SavedWindow>(() => readSavedWindow(id));
  const [isInteracting, setIsInteracting] = useState(false);
  const interactionRef = useRef<Interaction | null>(null);

  // What is drawn is always re-fitted to the screen as it is now, while the
  // placement the student chose is kept: a window pushed in by a narrower
  // screen goes back where it was when the screen grows again.
  const isPhone = viewport.width <= PHONE_MAX_WIDTH;
  const area = areaOf(viewport);
  const restored = fitRect(
    placement.rect ?? openingRect(side, defaultWidth, area),
    area,
    minWidth,
    minHeight
  );
  const shown = placement.expanded
    ? fitRect(expandedRect(restored, area), area, minWidth, minHeight)
    : restored;
  const sheetHeight = fitSheetHeight(
    placement.sheetHeight ?? viewport.height * SHEET_SHARE,
    area
  );

  useEffect(() => {
    if (isOpen) bringWindowToFront(id);
  }, [id, isOpen]);

  // The question column moves out of the way once a drag or resize lands,
  // not on every pointer move.
  useEffect(() => {
    if (!isOpen) {
      setWindowFootprint(id, null);
      return;
    }
    if (isInteracting) return;
    setWindowFootprint(
      id,
      isPhone
        ? { kind: 'sheet', height: sheetHeight }
        : { kind: 'window', left: shown.x, right: shown.x + shown.width }
    );
  }, [id, isInteracting, isOpen, isPhone, sheetHeight, shown.width, shown.x]);

  useEffect(() => () => setWindowFootprint(id, null), [id]);

  useEffect(() => {
    if (!isInteracting) saveWindow(id, placement);
  }, [id, isInteracting, placement]);

  const beginInteraction = (event: React.PointerEvent<HTMLElement>, interaction: Interaction) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    interactionRef.current = interaction;
    setIsInteracting(true);
  };

  const handleTitlePointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    if (event.target instanceof Element && event.target.closest('button')) return;

    if (isPhone) {
      beginInteraction(event, {
        kind: 'sheet',
        pointerId: event.pointerId,
        startY: event.clientY,
        originHeight: sheetHeight,
      });
      return;
    }

    beginInteraction(event, {
      kind: 'move',
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: shown,
      moved: false,
    });
  };

  const handleSheetPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    beginInteraction(event, {
      kind: 'sheet',
      pointerId: event.pointerId,
      startY: event.clientY,
      originHeight: sheetHeight,
    });
  };

  const handleResizePointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    beginInteraction(event, {
      kind: 'resize',
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: shown,
      moved: false,
    });
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const interaction = interactionRef.current;
    if (!interaction || interaction.pointerId !== event.pointerId) return;

    if (interaction.kind === 'sheet') {
      const height = interaction.originHeight - (event.clientY - interaction.startY);
      setPlacement((current) => ({ ...current, sheetHeight: fitSheetHeight(height, area) }));
      return;
    }

    const { origin } = interaction;
    const dx = event.clientX - interaction.startX;
    const dy = event.clientY - interaction.startY;
    // A press that stays put - a click to bring the window forward, or the
    // double-click that restores it - must leave an expanded window expanded.
    if (!interaction.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    interaction.moved = true;
    const next =
      interaction.kind === 'move'
        ? { ...origin, x: origin.x + dx, y: origin.y + dy }
        : {
            ...origin,
            // The corner stops at the edge instead of pushing the window off it.
            width: Math.min(origin.width + dx, area.width - origin.x),
            height: Math.min(origin.height + dy, area.bottom - origin.y),
          };
    // Moving or resizing an expanded window picks it up at the size it is
    // drawn (`origin` is what was on screen), and it is no longer expanded.
    setPlacement((current) => ({ ...current, rect: fitRect(next, area, minWidth, minHeight), expanded: false }));
  };

  const endInteraction = (event: React.PointerEvent<HTMLElement>) => {
    const interaction = interactionRef.current;
    if (!interaction || interaction.pointerId !== event.pointerId) return;
    interactionRef.current = null;
    setIsInteracting(false);
  };

  const pointerHandlers = {
    onPointerMove: handlePointerMove,
    onPointerUp: endInteraction,
    onPointerCancel: endInteraction,
    onLostPointerCapture: endInteraction,
  };

  const toggleExpanded = () => {
    setPlacement((current) => ({ ...current, expanded: !current.expanded }));
  };

  return (
    <div
      role="dialog"
      aria-label={title}
      onPointerDownCapture={() => bringWindowToFront(id)}
      onFocusCapture={() => bringWindowToFront(id)}
      style={
        isPhone
          ? { bottom: BOTTOM_BAR_HEIGHT, height: sheetHeight }
          : { left: shown.x, top: shown.y, width: shown.width, height: shown.height }
      }
      // Under the bars (z-50) and under the whiteboard's toolbar (z-40, and
      // later in the page); the window used last sits over the other one.
      className={cn(
        isOpen ? 'fixed flex flex-col overflow-hidden border-mist-200 bg-white shadow-lg' : 'hidden',
        isFront ? 'z-40' : 'z-30',
        isPhone ? 'inset-x-0 rounded-t-2xl border-t' : 'rounded-2xl border'
      )}
    >
      {isPhone && (
        <div
          aria-hidden
          onPointerDown={handleSheetPointerDown}
          {...pointerHandlers}
          className="flex h-5 shrink-0 cursor-ns-resize touch-none items-center justify-center"
        >
          <span className="h-1 w-10 rounded-full bg-mist-300" />
        </div>
      )}

      <div
        onPointerDown={handleTitlePointerDown}
        onDoubleClick={(event) => {
          if (isPhone || (event.target instanceof Element && event.target.closest('button'))) return;
          toggleExpanded();
        }}
        {...pointerHandlers}
        className={cn(
          'relative flex h-11 shrink-0 touch-none select-none items-center justify-between gap-2 border-b border-mist-200 pl-4 pr-1.5',
          isPhone ? 'cursor-ns-resize bg-white' : 'cursor-move bg-mist-50'
        )}
      >
        <h2 className="truncate text-sm font-semibold text-mist-900">{title}</h2>
        {!isPhone && (
          <GripHorizontal
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 text-mist-400"
          />
        )}
        <div className="flex shrink-0 items-center gap-0.5">
          {!isPhone && (
            <button
              type="button"
              onClick={toggleExpanded}
              aria-label={placement.expanded ? 'Restore size' : 'Expand'}
              title={placement.expanded ? 'Restore size' : 'Expand'}
              className={iconButtonClass({ size: 'sm' })}
            >
              {placement.expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            title={closeLabel}
            className={iconButtonClass({ size: 'sm' })}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        {children}
        {/* An iframe under the pointer would swallow the rest of a drag. */}
        {isInteracting && <div className="absolute inset-0" />}
      </div>

      {!isPhone && (
        <div
          aria-hidden
          onPointerDown={handleResizePointerDown}
          {...pointerHandlers}
          className="absolute bottom-0 right-0 z-10 flex h-5 w-5 cursor-nwse-resize touch-none items-end justify-end p-1 text-mist-400"
        >
          <svg viewBox="0 0 10 10" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M9 3 3 9M9 7 7 9" />
          </svg>
        </div>
      )}
    </div>
  );
}
