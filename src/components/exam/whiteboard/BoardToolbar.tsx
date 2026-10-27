"use client";

import React, { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  ArrowUpRight,
  Circle,
  Eraser,
  GripHorizontal,
  GripVertical,
  Highlighter,
  LocateFixed,
  MousePointer2,
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
import {
  EMPTY_PAGE,
  useBoardStore,
  type PanelDock,
  type PanelOffset,
} from '@/components/exam/whiteboard/boardStore';
import { INKS, WIDTHS, type BoardTool } from '@/components/exam/whiteboard/geometry';
import { focusRingClass } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';

const TOOLS: { tool: BoardTool; label: string; hint?: string; Icon: LucideIcon }[] = [
  // First: it is the way back to the page without closing the board.
  { tool: 'cursor', label: 'Cursor', hint: 'Cursor. Clicks reach the page; the drawing stays.', Icon: MousePointer2 },
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

type Wall = Exclude<PanelDock, null>;
type PickerKind = 'ink' | 'width';

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** How much of the bar has to stay on screen, so a drag can always bring it back. */
const KEEP_VISIBLE = 48;
const KEY_STEP = 24;
/** The pointer this near a side of the window, or the bar pushed this far past it, docks the bar there. */
const WALL_ZONE = 24;
/**
 * How far towards a wall the pointer has to travel in this drag before that
 * wall can take the bar. A bar grabbed close to a side - a phone's row starts
 * 8px from it - would otherwise dock on the wiggle of a drag up the screen,
 * and one hanging past a side would dock while being pulled back out.
 */
const THROW = 12;
/** How far a docked bar has to be pulled before it lets go of the wall; less is a press on the grip. */
const UNDOCK_PULL = 24;
/** The margin a bar pulled off a wall keeps from the window's edges. */
const INSET = 8;
const FLYOUT_GAP = 8;
const SNAP_MS = 180;

/**
 * The docked bar stands in a lane clear of the exam header above (`h-14`) and
 * the bottom bar below (`h-16`) - `top-16` and `bottom-18`, 8px off each, the
 * same inset it keeps from the wall.
 */
const LANE_TOP = 64;
const LANE_BOTTOM = 72;

/*
 * The docked column's height, reckoned from the sizes its classes give it, so
 * the layout is right on the first frame instead of corrected after one: 32px
 * cells (`h-8`), a 24px grip (`h-6`), 5px hairlines (`h-px my-0.5`), 2px gaps
 * (`gap-0.5`), and 10px of padding and border.
 */
const DOCKED_CELLS = TOOLS.length + 2 + 3 + 1; // the tools, both pickers, undo/redo/clear, close
const DOCKED_HAIRLINES = 3;
const COLUMN_HEIGHT = 10 + 24 + DOCKED_CELLS * 32 + DOCKED_HAIRLINES * 5 + (DOCKED_CELLS + DOCKED_HAIRLINES) * 2;

const STEPS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/*
 * Ghost cells: this is a toolbar, the one place the system keeps them. The
 * buttons' own focus outline (`focusRingClass`) fits in the bar's 4px of
 * padding. A cell that cannot act is drawn from the palette, never faded: at
 * `opacity-40` the red bin and the inks turned into pastels in no family.
 */
const cellClass = cn(
  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:text-gray-400',
  focusRingClass
);
const plainClass = 'text-gray-600 enabled:hover:bg-gray-100 enabled:hover:text-gray-900';
/**
 * The one "selected" treatment - the same as the exam header's pressed tools.
 * A picked ink or thickness under a tool that has none keeps its place in grey.
 */
const pickedClass =
  'bg-ink-50 text-ink-700 ring-1 ring-inset ring-ink-600 disabled:bg-gray-100 disabled:ring-gray-300';
/** An ink swatch or a thickness bar under a tool that uses neither. */
const mutedInkClass = 'bg-gray-300';
const surfaceClass = 'z-40 rounded-2xl border border-gray-200 bg-white p-1 shadow-lg';

/** Between groups in a row. */
function Divider() {
  return <span aria-hidden className="mx-0.5 h-5 w-px shrink-0 bg-gray-200" />;
}

/** Between groups in a column. */
function Hairline() {
  return <span aria-hidden className="my-0.5 h-px w-5 shrink-0 bg-gray-200" />;
}

/**
 * Picking a colour or a thickness while a label is being typed restyles that
 * label, so these presses must not take the focus away from its field - which
 * would commit it in the old style first.
 */
const keepFocus = (event: React.MouseEvent) => event.preventDefault();

function subscribeToResize(onChange: () => void) {
  window.addEventListener('resize', onChange);
  return () => window.removeEventListener('resize', onChange);
}
const readViewportHeight = () => window.innerHeight;
/** Never called in practice - the board loads with `ssr: false` - and "tall" is the harmless answer. */
const readServerViewportHeight = () => Number.POSITIVE_INFINITY;

function shiftBox(box: Box, dx: number, dy: number): Box {
  return { left: box.left + dx, right: box.right + dx, top: box.top + dy, bottom: box.bottom + dy };
}

/**
 * Pulls the bar back if a drag or a smaller window left it out of reach.
 * `box` is where the bar stands when it is at `to`; `to` itself comes back
 * when nothing has to move.
 */
function clampIntoView(to: PanelOffset, box: Box) {
  let dx = 0;
  let dy = 0;
  if (box.right < KEEP_VISIBLE) dx = KEEP_VISIBLE - box.right;
  else if (box.left > window.innerWidth - KEEP_VISIBLE) dx = window.innerWidth - KEEP_VISIBLE - box.left;
  if (box.top < 0) dy = -box.top;
  else if (box.top > window.innerHeight - KEEP_VISIBLE) dy = window.innerHeight - KEEP_VISIBLE - box.top;
  return dx || dy ? { x: to.x + dx, y: to.y + dy } : to;
}

/**
 * The pointer itself at the wall is the gesture as asked for; the bar's far
 * end pushed past it catches the same throw a moment sooner, and is the only
 * way to reach the right wall without dragging most of the bar off screen
 * first - the grip is at its left end.
 */
function wallFor(pointerX: number, travel: number, box: Box): Wall | null {
  const width = window.innerWidth;
  if (travel <= -THROW && (pointerX <= WALL_ZONE || box.left <= -WALL_ZONE)) return 'left';
  if (travel >= THROW && (pointerX >= width - WALL_ZONE || box.right >= width + WALL_ZONE)) return 'right';
  return null;
}

/**
 * The offset that puts the grip under the pointer, then the whole bar inside
 * the window: pulled off the right wall, a row hanging from a grip at its left
 * end would sit almost entirely past it.
 */
function placeUnder(pointer: { x: number; y: number }, offset: PanelOffset, box: Box, grip: Box): PanelOffset {
  let dx = pointer.x - (grip.left + grip.right) / 2;
  let dy = pointer.y - (grip.top + grip.bottom) / 2;
  dx = Math.max(Math.min(dx, window.innerWidth - INSET - box.right), INSET - box.left);
  dy = Math.max(Math.min(dy, window.innerHeight - INSET - box.bottom), INSET - box.top);
  return { x: offset.x + dx, y: offset.y + dy };
}

/**
 * The bar changing shape is a jump; a short pull towards the wall reads as
 * the bar landing there instead. `translate` and `scale`, never `transform`:
 * that one carries the floating bar's offset.
 */
function playSnap(panel: HTMLElement, dock: PanelDock) {
  if (typeof panel.animate !== 'function') return null;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
  const from = dock === 'left' ? '12px 0' : dock === 'right' ? '-12px 0' : '0 0';
  return panel.animate(
    [
      { opacity: 0.5, translate: from, scale: '0.96' },
      { opacity: 1, translate: '0 0', scale: '1' },
    ],
    { duration: SNAP_MS, easing: 'cubic-bezier(0.2, 0, 0, 1)' }
  );
}

interface DragBase {
  x: number;
  y: number;
  offset: PanelOffset;
  box: Box;
}

interface Drag {
  /** The wall a docked bar is still held against, before the pull that frees it. */
  held: Wall | null;
  origin: { x: number; y: number };
  /** Where the floating bar stood for a pointer at (x, y); null while a bar just pulled off a wall is laid out. */
  base: DragBase | null;
  /** The floating offset from before this drag - where a bar thrown at a wall floats again later. */
  restore: PanelOffset;
  /** The wall the bar docks to if it is let go now. */
  wall: Wall | null;
  /** Takes the drag's listeners off the window without landing it anywhere. */
  stop: () => void;
}

interface Flyout {
  kind: PickerKind;
  /** The trigger's centre line. */
  top: number;
  /** From the side of the window the bar is docked to. */
  inset: number;
}

interface BoardToolbarProps {
  pageKey: string;
  onClose: () => void;
}

/**
 * One row across the foot of the question, above the exam's own bottom bar,
 * wrapping to more rows only on a narrow screen. A block of buttons in the
 * middle of the page would cover the thing being explained; the bar can still
 * be dragged off it by the grip.
 *
 * Thrown against the left or right side of the window, it docks there as a
 * column, clear of the question altogether; dragged off again, it is a row
 * under the pointer. In the column the colours and thicknesses fold into two
 * pickers that open away from the wall, and on a short screen the column
 * splits in two rather than run past the bottom bar.
 *
 * `bottom-20` is the BottomNav's `h-16` plus a 16px gap.
 */
export default function BoardToolbar({ pageKey, onClose }: BoardToolbarProps) {
  const tool = useBoardStore((state) => state.tool);
  const colorIndex = useBoardStore((state) => state.colorIndex);
  const width = useBoardStore((state) => state.width);
  const offset = useBoardStore((state) => state.panelOffset);
  const dock = useBoardStore((state) => state.panelDock);
  const canUndo = useBoardStore((state) => (state.pages[pageKey] ?? EMPTY_PAGE).past.length > 0);
  const canRedo = useBoardStore((state) => (state.pages[pageKey] ?? EMPTY_PAGE).future.length > 0);
  const hasInk = useBoardStore((state) => (state.pages[pageKey] ?? EMPTY_PAGE).strokes.length > 0);
  const { setTool, setColorIndex, setWidth, setPanelOffset, setPanelDock, undo, redo, clear } =
    useBoardStore.getState();

  const viewportHeight = useSyncExternalStore(subscribeToResize, readViewportHeight, readServerViewportHeight);
  const twoColumns = viewportHeight - LANE_TOP - LANE_BOTTOM < COLUMN_HEIGHT;

  const panelRef = useRef<HTMLDivElement>(null);
  const gripRef = useRef<HTMLSpanElement>(null);
  const dragRef = useRef<Drag | null>(null);
  /** The pointer a bar pulled off a wall is laid out under, once it is a row again. */
  const anchorRef = useRef<{ x: number; y: number } | null>(null);
  const shownDockRef = useRef(dock);
  const snapRef = useRef<Animation | null>(null);
  const [preview, setPreview] = useState<Wall | null>(null);

  const [flyout, setFlyout] = useState<Flyout | null>(null);
  const flyoutRef = useRef<HTMLDivElement>(null);
  const flyoutTriggerRef = useRef<HTMLButtonElement | null>(null);
  const focusFlyoutRef = useRef(false);
  const flyoutId = useId();

  useEffect(() => {
    const onResize = () => {
      const { panelOffset: current, panelDock } = useBoardStore.getState();
      // Docked, the bar is placed by the window's own edges.
      const panel = panelRef.current;
      if (panelDock || !panel) return;
      const next = clampIntoView(current, panel.getBoundingClientRect());
      if (next !== current) setPanelOffset(next);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [setPanelOffset]);

  // Before paint, so a bar pulled off a wall is never drawn as a row at its
  // old floating spot first.
  useLayoutEffect(() => {
    const previous = shownDockRef.current;
    shownDockRef.current = dock;
    const panel = panelRef.current;
    if (previous === dock || !panel) return;
    // A snap still playing is in every measurement below - a bar pulled off
    // the wall it has just landed on.
    snapRef.current?.cancel();

    if (!dock) {
      const current = useBoardStore.getState().panelOffset;
      const box = panel.getBoundingClientRect();
      const anchor = anchorRef.current;
      const grip = gripRef.current;
      anchorRef.current = null;
      let next = clampIntoView(current, box);
      if (anchor && grip) {
        next = placeUnder(anchor, current, box, grip.getBoundingClientRect());
        // The drag goes on from here, against the bar's new shape.
        const drag = dragRef.current;
        if (drag) {
          drag.base = {
            x: anchor.x,
            y: anchor.y,
            offset: next,
            box: shiftBox(box, next.x - current.x, next.y - current.y),
          };
        }
      }
      if (next !== current) setPanelOffset(next);
    }
    snapRef.current = playSnap(panel, dock);
  }, [dock, setPanelOffset]);

  useEffect(() => {
    if (!flyout) return;
    if (focusFlyoutRef.current) {
      focusFlyoutRef.current = false;
      const row = flyoutRef.current;
      (row?.querySelector<HTMLElement>('[aria-pressed="true"]') ?? row?.querySelector<HTMLElement>('button'))?.focus();
    }
    // Capture, so a press that starts a stroke or a drag still closes it.
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Node ? event.target : null;
      if (target && (flyoutRef.current?.contains(target) || flyoutTriggerRef.current?.contains(target))) return;
      setFlyout(null);
    };
    // It is placed against its trigger once; anything that moves the trigger closes it.
    const close = () => setFlyout(null);
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('resize', close);
    };
  }, [flyout]);

  const resetPanel = () => {
    setFlyout(null);
    setPanelDock(null);
    setPanelOffset({ x: 0, y: 0 });
  };

  // The listeners go on the window, not the grip: a fast drag outruns the bar
  // and the grip would stop hearing the moves.
  const startDrag = (event: React.PointerEvent) => {
    const panel = panelRef.current;
    // A second finger on the grip is not a second drag.
    if (event.button !== 0 || !event.isPrimary || !panel) return;
    event.preventDefault();
    setFlyout(null);
    // A primary press cannot start while another is held, so a drag still on
    // the books lost its release to a dialog or a window switch. Left in
    // place, it would keep every new press on the grip from moving the bar.
    dragRef.current?.stop();

    const { panelDock, panelOffset } = useBoardStore.getState();
    const drag: Drag = {
      held: panelDock,
      origin: { x: event.clientX, y: event.clientY },
      base: panelDock
        ? null
        : { x: event.clientX, y: event.clientY, offset: panelOffset, box: panel.getBoundingClientRect() },
      restore: panelOffset,
      wall: null,
      stop: () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', end);
        window.removeEventListener('pointercancel', end);
        if (dragRef.current === drag) dragRef.current = null;
        showWall(null);
      },
    };
    dragRef.current = drag;

    const showWall = (wall: Wall | null) => {
      if (drag.wall === wall) return;
      drag.wall = wall;
      setPreview(wall);
    };

    // A second finger - drawing on the question, say - is not this drag.
    const { pointerId } = event;

    const move = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      const pointer = { x: moveEvent.clientX, y: moveEvent.clientY };
      if (drag.held) {
        // Away from the wall or along it; a push further into the wall is
        // still a bar held against it.
        const away = drag.held === 'left' ? pointer.x - drag.origin.x : drag.origin.x - pointer.x;
        if (Math.max(away, Math.abs(pointer.y - drag.origin.y)) < UNDOCK_PULL) return;
        // Off the wall: a row again, laid out under the pointer by the effect above.
        drag.held = null;
        anchorRef.current = pointer;
        setPanelDock(null);
        return;
      }
      if (!drag.base) {
        anchorRef.current = pointer;
        return;
      }
      const dx = pointer.x - drag.base.x;
      const dy = pointer.y - drag.base.y;
      setPanelOffset({ x: drag.base.offset.x + dx, y: drag.base.offset.y + dy });
      showWall(wallFor(pointer.x, dx, shiftBox(drag.base.box, dx, dy)));
    };

    const end = (endEvent: PointerEvent) => {
      if (endEvent.pointerId !== pointerId) return;
      const { held, base, wall } = drag;
      drag.stop();
      // A press on a docked bar's grip, not a pull.
      if (held) return;
      if (wall) {
        // The offset goes back to where the bar floated before it was thrown:
        // the spot it ended on is off the side of the window.
        setPanelOffset(drag.restore);
        setPanelDock(wall);
        return;
      }
      // Still being laid out as a row; the effect places it inside the window.
      if (!base) return;
      const current = useBoardStore.getState().panelOffset;
      setPanelOffset(clampIntoView(current, shiftBox(base.box, current.x - base.offset.x, current.y - base.offset.y)));
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  };

  // Without a keyboard route, a bar parked over the very line being explained
  // stays there for anyone without a mouse. Shift and a sideways arrow is the
  // keyboard's throw at that wall.
  const onGripKey = (event: React.KeyboardEvent) => {
    const sideways: Wall | null = event.key === 'ArrowLeft' ? 'left' : event.key === 'ArrowRight' ? 'right' : null;
    if (event.shiftKey && sideways) {
      event.preventDefault();
      setFlyout(null);
      setPanelDock(sideways);
      return;
    }
    if (event.key === 'Home' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      resetPanel();
      return;
    }
    const step = STEPS[event.key];
    if (!step) return;
    event.preventDefault();
    if (dock) {
      // Docked, the arrow away from the wall lets go of it; the others have
      // nowhere to take a bar centred on its side.
      if (sideways && sideways !== dock) {
        setFlyout(null);
        setPanelDock(null);
      }
      return;
    }
    const panel = panelRef.current;
    if (!panel) return;
    const dx = step[0] * KEY_STEP;
    const dy = step[1] * KEY_STEP;
    const to = { x: offset.x + dx, y: offset.y + dy };
    setPanelOffset(clampIntoView(to, shiftBox(panel.getBoundingClientRect(), dx, dy)));
  };

  const toggleFlyout = (kind: PickerKind, event: React.MouseEvent<HTMLButtonElement>) => {
    const panel = panelRef.current;
    if (flyout?.kind === kind || !panel || !dock) {
      setFlyout(null);
      return;
    }
    const trigger = event.currentTarget;
    const at = trigger.getBoundingClientRect();
    const box = panel.getBoundingClientRect();
    flyoutTriggerRef.current = trigger;
    // A press from the keyboard is a click with no clicks counted, and takes
    // the focus into the row; a mouse press leaves it where it was.
    focusFlyoutRef.current = event.detail === 0;
    setFlyout({
      kind,
      top: at.top + at.height / 2,
      // Out of the side away from the wall, beside the bar rather than over it.
      inset: dock === 'left' ? box.right + FLYOUT_GAP : window.innerWidth - box.left + FLYOUT_GAP,
    });
  };

  const closeFlyout = () => {
    // Back to the trigger after a pick from the keyboard; a mouse pick never
    // moved the focus.
    if (flyoutRef.current?.contains(document.activeElement)) flyoutTriggerRef.current?.focus();
    setFlyout(null);
  };

  const onFlyoutKey = (event: React.KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    closeFlyout();
  };

  // Open while the focus is on the trigger or in the row; tabbing past both
  // closes it. A mouse never moves the focus here, so this is keyboard only.
  const onFlyoutBlur = (event: React.FocusEvent) => {
    const next = event.relatedTarget;
    if (next instanceof Node && (flyoutRef.current?.contains(next) || flyoutTriggerRef.current?.contains(next))) return;
    setFlyout(null);
  };

  // The cursor, the pointer and the eraser have neither colour nor thickness.
  // The rows go inert, and grey, rather than away: a bar that changes size
  // under the hand is how the wrong button gets pressed.
  const inkless = tool === 'cursor' || tool === 'laser' || tool === 'eraser';
  const ink = INKS[colorIndex] ?? INKS[0];

  const inkDot = (value: string) => (
    <span
      className={cn('h-4 w-4 rounded-full ring-1 ring-inset ring-gray-900/15', inkless && mutedInkClass)}
      style={inkless ? undefined : { backgroundColor: value }}
    />
  );
  // The bar is the thickness and the ink that will land on the page.
  const widthBar = (value: number) => (
    <span
      className={cn('w-4 rounded-full', inkless && mutedInkClass)}
      style={{ height: value, backgroundColor: inkless ? undefined : ink.value }}
    />
  );

  const inkButtons = (inFlyout = false) =>
    INKS.map((item, index) => (
      <button
        key={item.value}
        type="button"
        aria-label={`${item.name} ink`}
        aria-pressed={colorIndex === index}
        title={`${item.name} ink`}
        disabled={inkless}
        onMouseDown={keepFocus}
        onClick={() => {
          setColorIndex(index);
          if (inFlyout) closeFlyout();
        }}
        className={`${cellClass} ${colorIndex === index ? pickedClass : 'enabled:hover:bg-gray-100'}`}
      >
        {inkDot(item.value)}
      </button>
    ));

  const widthButtons = (inFlyout = false) =>
    WIDTHS.map((item) => (
      <button
        key={item}
        type="button"
        aria-label={`Thickness ${item}`}
        aria-pressed={width === item}
        title={`Thickness ${item}`}
        disabled={inkless}
        onMouseDown={keepFocus}
        onClick={() => {
          setWidth(item);
          if (inFlyout) closeFlyout();
        }}
        className={`${cellClass} ${width === item ? pickedClass : 'enabled:hover:bg-gray-100'}`}
      >
        {widthBar(item)}
      </button>
    ));

  /** One cell standing for a whole row of choices, which opens beside the docked bar. */
  const picker = (kind: PickerKind) => {
    const open = dock !== null && !inkless && flyout?.kind === kind ? flyout : null;
    const label = kind === 'ink' ? 'Ink' : 'Thickness';
    return (
      <>
        <button
          type="button"
          aria-label={kind === 'ink' ? `Ink: ${ink.name}` : `Thickness ${width}`}
          aria-expanded={Boolean(open)}
          aria-controls={open ? flyoutId : undefined}
          title={label}
          disabled={inkless}
          onMouseDown={keepFocus}
          onClick={(event) => toggleFlyout(kind, event)}
          onBlur={open ? onFlyoutBlur : undefined}
          onKeyDown={(event) => {
            if (open && event.key === 'Escape') {
              event.preventDefault();
              setFlyout(null);
            }
          }}
          className={`${cellClass} ${open ? 'bg-gray-100' : 'enabled:hover:bg-gray-100'}`}
        >
          {kind === 'ink' ? inkDot(ink.value) : widthBar(width)}
        </button>
        {open && (
          <div
            ref={flyoutRef}
            id={flyoutId}
            role="group"
            aria-label={label}
            onKeyDown={onFlyoutKey}
            onBlur={onFlyoutBlur}
            className={`fixed flex -translate-y-1/2 items-center gap-0.5 ${surfaceClass}`}
            style={dock === 'left' ? { top: open.top, left: open.inset } : { top: open.top, right: open.inset }}
          >
            {kind === 'ink' ? inkButtons(true) : widthButtons(true)}
          </div>
        )}
      </>
    );
  };

  const grip = (
    <span
      ref={gripRef}
      role="button"
      tabIndex={0}
      aria-label="Move the toolbar"
      aria-keyshortcuts="Shift+ArrowLeft Shift+ArrowRight"
      title={
        dock
          ? 'Drag off the side to float it. Double-click to put it back.'
          : 'Drag to move, or into a side of the window to dock it there. Double-click to put it back.'
      }
      onPointerDown={startDrag}
      onKeyDown={onGripKey}
      onDoubleClick={resetPanel}
      className={cn(
        'inline-flex shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 active:cursor-grabbing',
        focusRingClass,
        dock ? 'h-6 w-full' : 'h-8 w-6'
      )}
    >
      {dock ? <GripHorizontal className="h-4 w-4" /> : <GripVertical className="h-4 w-4" />}
    </span>
  );

  const toolButtons = TOOLS.map(({ tool: item, label, hint, Icon }) => (
    <button
      key={item}
      type="button"
      aria-label={label}
      aria-pressed={tool === item}
      title={hint ?? label}
      onClick={() => {
        setFlyout(null);
        setTool(item);
      }}
      className={`${cellClass} ${tool === item ? pickedClass : plainClass}`}
    >
      <Icon className="h-4 w-4" />
    </button>
  ));

  const historyButtons = (
    <>
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
    </>
  );

  const closeButton = (
    <button
      type="button"
      aria-label="Close the whiteboard"
      title="Close the whiteboard. The drawing stays on the question."
      onClick={onClose}
      className={`${cellClass} ${plainClass}`}
    >
      <X className="h-4 w-4" />
    </button>
  );

  // Everything after the tools, as it stands in a column.
  const dockedRest = (
    <>
      {picker('ink')}
      {picker('width')}
      <Hairline />
      {historyButtons}
      <Hairline />
      {closeButton}
    </>
  );

  let body: React.ReactNode;
  if (!dock) {
    body = (
      <>
        {toolButtons}
        <Divider />
        {inkButtons()}
        <Divider />
        {widthButtons()}
        <Divider />
        {historyButtons}
        <Divider />
        {closeButton}
      </>
    );
  } else if (twoColumns) {
    body = (
      <div className="flex items-start gap-0.5">
        <div className="flex flex-col gap-0.5">{toolButtons}</div>
        <span aria-hidden className="mx-0.5 w-px shrink-0 self-stretch bg-gray-200" />
        <div className="flex flex-col items-center gap-0.5">{dockedRest}</div>
      </div>
    );
  } else {
    body = (
      <>
        {toolButtons}
        <Hairline />
        {dockedRest}
      </>
    );
  }

  return (
    <>
      {/* The landing guide: where the bar docks if it is let go now. */}
      {(['left', 'right'] as const).map((side) => (
        <span
          key={side}
          aria-hidden
          className={`pointer-events-none fixed bottom-18 top-16 z-40 w-1 rounded-full bg-ink-600 transition-opacity duration-150 motion-reduce:transition-none ${
            side === 'left' ? 'left-0.5' : 'right-0.5'
          } ${preview === side ? 'opacity-100' : 'opacity-0'}`}
        />
      ))}
      <div
        ref={panelRef}
        role="toolbar"
        aria-label="Whiteboard"
        aria-orientation={dock ? 'vertical' : 'horizontal'}
        // Centred in its lane by `my-auto` on a box as tall as its content,
        // so `transform` stays free for the snap. The lane is 8.5rem short of
        // the window; past that the column scrolls rather than overflow.
        className={
          dock
            ? `fixed bottom-18 top-16 my-auto flex h-fit max-h-[calc(100dvh-8.5rem)] w-max flex-col items-center gap-0.5 overflow-y-auto overscroll-contain ${
                dock === 'left' ? 'left-2' : 'right-2'
              } ${surfaceClass}`
            : `fixed inset-x-0 bottom-20 mx-auto flex w-max max-w-[calc(100vw-1rem)] flex-wrap items-center justify-center gap-0.5 ${surfaceClass}`
        }
        style={dock ? undefined : { transform: `translate(${offset.x}px, ${offset.y}px)` }}
        onScroll={flyout ? () => setFlyout(null) : undefined}
      >
        {grip}
        {body}
      </div>
    </>
  );
}
