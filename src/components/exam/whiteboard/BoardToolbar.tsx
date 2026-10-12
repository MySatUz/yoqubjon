"use client";

import React, { useCallback, useEffect, useRef } from 'react';
import {
  ArrowUpRight,
  Circle,
  Eraser,
  GripVertical,
  Highlighter,
  LocateFixed,
  Pencil,
  Redo2,
  Slash,
  Square,
  Trash2,
  Type,
  Undo2,
  X,
  type LucideIcon,
} from 'lucide-react';
import { EMPTY_PAGE, useBoardStore, type PanelOffset } from '@/components/exam/whiteboard/boardStore';
import { INKS, WIDTHS, type BoardTool } from '@/components/exam/whiteboard/geometry';

const TOOLS: { tool: BoardTool; label: string; Icon: LucideIcon }[] = [
  { tool: 'pen', label: 'Pen', Icon: Pencil },
  { tool: 'marker', label: 'Highlighter', Icon: Highlighter },
  { tool: 'line', label: 'Line', Icon: Slash },
  { tool: 'arrow', label: 'Arrow', Icon: ArrowUpRight },
  { tool: 'rect', label: 'Rectangle', Icon: Square },
  { tool: 'ellipse', label: 'Ellipse', Icon: Circle },
  { tool: 'text', label: 'Text label', Icon: Type },
  { tool: 'laser', label: 'Laser pointer', Icon: LocateFixed },
  { tool: 'eraser', label: 'Eraser', Icon: Eraser },
];

/** How much of the bar has to stay on screen, so a drag can always bring it back. */
const KEEP_VISIBLE = 48;
const KEY_STEP = 24;

const cellClass =
  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-40';
const plainClass = 'text-slate-600 enabled:hover:bg-slate-100 enabled:hover:text-slate-900';

function Divider() {
  return <span aria-hidden className="mx-0.5 h-5 w-px shrink-0 bg-slate-200" />;
}

/**
 * Picking a colour or a thickness while a label is being typed restyles that
 * label, so these presses must not take the focus away from its field - which
 * would commit it in the old style first.
 */
const keepFocus = (event: React.MouseEvent) => event.preventDefault();

interface BoardToolbarProps {
  pageKey: string;
  onClose: () => void;
}

/**
 * One row across the foot of the question, above the exam's own bottom bar,
 * wrapping to more rows only on a narrow screen. A block of buttons in the
 * middle of the page would cover the thing being explained; the bar can still
 * be dragged off it by the grip.
 */
export default function BoardToolbar({ pageKey, onClose }: BoardToolbarProps) {
  const tool = useBoardStore((state) => state.tool);
  const colorIndex = useBoardStore((state) => state.colorIndex);
  const width = useBoardStore((state) => state.width);
  const offset = useBoardStore((state) => state.panelOffset);
  const canUndo = useBoardStore((state) => (state.pages[pageKey] ?? EMPTY_PAGE).past.length > 0);
  const canRedo = useBoardStore((state) => (state.pages[pageKey] ?? EMPTY_PAGE).future.length > 0);
  const hasInk = useBoardStore((state) => (state.pages[pageKey] ?? EMPTY_PAGE).strokes.length > 0);
  const { setTool, setColorIndex, setWidth, setPanelOffset, undo, redo, clear } = useBoardStore.getState();

  const panelRef = useRef<HTMLDivElement>(null);

  /** Pulls the bar back if a drag or a smaller window left it out of reach. */
  const clampIntoView = useCallback((from: PanelOffset) => {
    const panel = panelRef.current;
    if (!panel) return from;
    const rect = panel.getBoundingClientRect();
    let dx = 0;
    let dy = 0;
    if (rect.right < KEEP_VISIBLE) dx = KEEP_VISIBLE - rect.right;
    else if (rect.left > window.innerWidth - KEEP_VISIBLE) dx = window.innerWidth - KEEP_VISIBLE - rect.left;
    if (rect.top < 0) dy = -rect.top;
    else if (rect.top > window.innerHeight - KEEP_VISIBLE) dy = window.innerHeight - KEEP_VISIBLE - rect.top;
    return dx || dy ? { x: from.x + dx, y: from.y + dy } : from;
  }, []);

  useEffect(() => {
    const onResize = () => {
      const current = useBoardStore.getState().panelOffset;
      const next = clampIntoView(current);
      if (next !== current) setPanelOffset(next);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [clampIntoView, setPanelOffset]);

  // The listeners go on the window, not the grip: a fast drag outruns the bar
  // and the grip would stop hearing the moves.
  const startDrag = (event: React.PointerEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const start = { x: event.clientX, y: event.clientY, offset: useBoardStore.getState().panelOffset };
    const move = (moveEvent: PointerEvent) => {
      setPanelOffset({
        x: start.offset.x + moveEvent.clientX - start.x,
        y: start.offset.y + moveEvent.clientY - start.y,
      });
    };
    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      setPanelOffset(clampIntoView(useBoardStore.getState().panelOffset));
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  };

  // Without a keyboard route, a bar parked over the very line being explained
  // stays there for anyone without a mouse.
  const onGripKey = (event: React.KeyboardEvent) => {
    const steps: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const step = steps[event.key];
    if (step) {
      event.preventDefault();
      setPanelOffset(clampIntoView({ x: offset.x + step[0] * KEY_STEP, y: offset.y + step[1] * KEY_STEP }));
    } else if (event.key === 'Home' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setPanelOffset({ x: 0, y: 0 });
    }
  };

  // The pointer and the eraser have neither colour nor thickness. The rows go
  // inert rather than away: a bar that changes size under the hand is how the
  // wrong button gets pressed.
  const inkless = tool === 'laser' || tool === 'eraser';

  return (
    <div
      ref={panelRef}
      role="toolbar"
      aria-label="Whiteboard"
      className="fixed inset-x-0 bottom-20 z-40 mx-auto flex w-max max-w-[calc(100vw-1rem)] flex-wrap items-center justify-center gap-0.5 rounded-2xl border border-slate-200 bg-white p-1 shadow-lg"
      style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
    >
      <span
        role="button"
        tabIndex={0}
        aria-label="Move the toolbar"
        title="Drag to move. Double-click to put it back."
        onPointerDown={startDrag}
        onKeyDown={onGripKey}
        onDoubleClick={() => setPanelOffset({ x: 0, y: 0 })}
        className="inline-flex h-8 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-xl text-slate-400 outline-none focus-visible:ring-2 focus-visible:ring-blue-600 active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </span>

      {TOOLS.map(({ tool: item, label, Icon }) => (
        <button
          key={item}
          type="button"
          aria-label={label}
          aria-pressed={tool === item}
          title={label}
          onClick={() => setTool(item)}
          className={`${cellClass} ${
            tool === item ? 'bg-blue-600 text-white hover:bg-blue-700' : plainClass
          }`}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}

      <Divider />

      {INKS.map((ink, index) => (
        <button
          key={ink.value}
          type="button"
          aria-label={`${ink.name} ink`}
          aria-pressed={colorIndex === index}
          title={`${ink.name} ink`}
          disabled={inkless}
          onMouseDown={keepFocus}
          onClick={() => setColorIndex(index)}
          className={`${cellClass} ${colorIndex === index ? 'bg-blue-50 ring-1 ring-inset ring-blue-600' : 'enabled:hover:bg-slate-100'}`}
        >
          <span className="h-4 w-4 rounded-full ring-1 ring-inset ring-slate-900/15" style={{ backgroundColor: ink.value }} />
        </button>
      ))}

      <Divider />

      {WIDTHS.map((item) => (
        <button
          key={item}
          type="button"
          aria-label={`Thickness ${item}`}
          aria-pressed={width === item}
          title={`Thickness ${item}`}
          disabled={inkless}
          onMouseDown={keepFocus}
          onClick={() => setWidth(item)}
          className={`${cellClass} ${width === item ? 'bg-blue-50 ring-1 ring-inset ring-blue-600' : 'enabled:hover:bg-slate-100'}`}
        >
          {/* The bar is the thickness and the ink that will land on the page. */}
          <span
            className="w-4 rounded-full"
            style={{ height: item, backgroundColor: INKS[colorIndex]?.value ?? INKS[0].value }}
          />
        </button>
      ))}

      <Divider />

      <button
        type="button"
        aria-label="Undo"
        title="Undo (Ctrl+Z)"
        disabled={!canUndo}
        onClick={() => undo(pageKey)}
        className={`${cellClass} ${plainClass}`}
      >
        <Undo2 className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label="Redo"
        title="Redo (Ctrl+Shift+Z)"
        disabled={!canRedo}
        onClick={() => redo(pageKey)}
        className={`${cellClass} ${plainClass}`}
      >
        <Redo2 className="h-4 w-4" />
      </button>
      {/* Undo brings a cleared page back, so this asks nothing first. */}
      <button
        type="button"
        aria-label="Clear this question's drawing"
        title="Clear this question's drawing"
        disabled={!hasInk}
        onClick={() => clear(pageKey)}
        className={`${cellClass} text-red-600 enabled:hover:bg-red-50`}
      >
        <Trash2 className="h-4 w-4" />
      </button>

      <Divider />

      <button
        type="button"
        aria-label="Close the whiteboard"
        title="Close the whiteboard. The drawing stays on the question."
        onClick={onClose}
        className={`${cellClass} ${plainClass}`}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
