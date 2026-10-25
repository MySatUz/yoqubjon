/**
 * The model and the maths behind the exam whiteboard, with nothing that
 * touches the DOM - the half that can be read end to end without a browser.
 *
 * A point is CSS pixels on the drawing surface, measured from the top of the
 * surface and from its vertical centre line, not from its left edge. The
 * question column is centred in the surface and keeps its width on any screen
 * wider than it, so this is the one origin that stays glued to the text when
 * the window changes: moving the lesson from a laptop to a projector widens
 * the surface on both sides, the text stays where it was, and so does every
 * arrow pointing at it. Fractions of the box - what the lambdapi board
 * stores - stretch the drawing with the window while the text does not move,
 * and the arrows end up a word or two off.
 */

export type BoardPoint = [number, number];

export const STROKE_KINDS = ['pen', 'marker', 'line', 'arrow', 'rect', 'ellipse', 'text'] as const;
export type StrokeKind = (typeof STROKE_KINDS)[number];
/** `cursor` draws nothing: it hands the page under the drawing back to the pointer. */
export type BoardTool = StrokeKind | 'cursor' | 'laser' | 'eraser';

export interface Stroke {
  id: string;
  kind: StrokeKind;
  color: string;
  width: number;
  points: BoardPoint[];
  text?: string;
}

/**
 * Ink, from the five colour families the design system allows (AGENTS.md):
 * red-600, board-600, lime-700, amber-600 and mist-900. Hex rather than
 * Tailwind's oklch values because these go to a canvas, and a stored stroke is
 * only ever given a colour from this list.
 */
export const INKS = [
  { name: 'Red', value: '#dc2626' },
  { name: 'Green', value: '#0d6657' },
  { name: 'Lime', value: '#497d00' },
  { name: 'Amber', value: '#d97706' },
  { name: 'Black', value: '#161b1d' },
] as const;

/**
 * Inks this list used to hold, and the one each is drawn in now. Each left
 * with the palette it came from - blue-600 and then indigo-600 with the old
 * accents, emerald and slate with indigo - and a stroke drawn in one before
 * the change, read back from the tab's storage, takes its successor rather
 * than turning red.
 */
const RETIRED_INKS: Record<string, string> = {
  '#2563eb': '#0d6657',
  '#4f46e5': '#0d6657',
  '#059669': '#497d00',
  '#0f172a': '#161b1d',
};

/** Three, not five: a fourth choice on a switch nobody explains is noise. */
export const WIDTHS = [2, 4, 8] as const;

/**
 * Far more than anyone draws over one question, and far fewer than the count
 * at which repainting the whole list on every pointer move starts to stutter.
 */
export const MAX_STROKES = 400;
export const MAX_TEXT_LENGTH = 120;

/** The highlighter is the same ink at low alpha and triple width. */
export const MARKER_ALPHA = 0.32;
export const MARKER_WIDTH_SCALE = 3.5;

/** How near the eraser has to come; the width term keeps fat strokes easy to hit. */
const ERASE_SLACK = 10;

/** Nothing legitimate lies further out than this; anything stored past it is junk. */
const MAX_COORD = 20000;

/** Freehand points closer than this to the previous one add bytes, not shape. */
export const MIN_POINT_GAP = 1;

const TWO_POINT_KINDS: readonly StrokeKind[] = ['line', 'arrow', 'rect', 'ellipse'];

export function isTwoPointKind(kind: StrokeKind) {
  return TWO_POINT_KINDS.includes(kind);
}

/** A tenth of a pixel is finer than any screen draws, and halves the stored size. */
function round(value: number) {
  return Math.round(value * 10) / 10;
}

function clampCoord(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return round(Math.min(Math.max(value, -MAX_COORD), MAX_COORD));
}

function sanitizePoints(points: unknown): BoardPoint[] {
  if (!Array.isArray(points)) return [];
  const clean: BoardPoint[] = [];
  for (const point of points) {
    if (!Array.isArray(point)) continue;
    const x = clampCoord(point[0]);
    const y = clampCoord(point[1]);
    if (x !== null && y !== null) clean.push([x, y]);
  }
  return clean;
}

/**
 * Every stroke passes through here before it is kept - the ones the pointer
 * just drew and the ones read back from sessionStorage after a reload, which
 * anyone can edit. One validator for both is cheaper to keep honest than two.
 */
export function sanitizeStroke(raw: unknown): Stroke | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;

  const kind = STROKE_KINDS.find((item) => item === source.kind);
  if (!kind) return null;

  let points = sanitizePoints(source.points);
  if (points.length === 0) return null;
  if (isTwoPointKind(kind)) {
    points = [points[0], points[points.length - 1]];
    // A press with no drag: a rectangle of no size draws nothing, and an
    // invisible stroke would still be the thing the next Undo removes.
    const [[ax, ay], [bx, by]] = points;
    if (Math.hypot(bx - ax, by - ay) < 2) return null;
  }
  if (kind === 'text') points = [points[0]];

  const named = typeof source.color === 'string' ? RETIRED_INKS[source.color] ?? source.color : null;
  const color = INKS.find((ink) => ink.value === named)?.value ?? INKS[0].value;
  const width = WIDTHS.find((item) => item === source.width) ?? WIDTHS[1];

  const stroke: Stroke = {
    id: typeof source.id === 'string' && source.id ? source.id.slice(0, 64) : nextStrokeId(),
    kind,
    color,
    width,
    points,
  };

  if (kind === 'text') {
    const text = String(source.text ?? '').trim().slice(0, MAX_TEXT_LENGTH);
    if (!text) return null;
    stroke.text = text;
  }

  return stroke;
}

let strokeSequence = 0;

export function nextStrokeId() {
  strokeSequence += 1;
  return `${Date.now().toString(36)}-${strokeSequence}`;
}

/** Trims from the head, so stroke 401 pushes out stroke 1 instead of failing. */
export function appendStroke(strokes: readonly Stroke[], stroke: Stroke) {
  return [...strokes, stroke].slice(-MAX_STROKES);
}

/* ------------------------------------------------------------------------
   Pixel maths, all in surface coordinates.
   ------------------------------------------------------------------------ */

export function distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.min(Math.max(((px - ax) * dx + (py - ay) * dy) / lengthSquared, 0), 1);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function boundsOf(stroke: Stroke) {
  const [ax, ay] = stroke.points[0];
  const [bx, by] = stroke.points[stroke.points.length - 1];
  return {
    left: Math.min(ax, bx),
    top: Math.min(ay, by),
    right: Math.max(ax, bx),
    bottom: Math.max(ay, by),
  };
}

/** The head is capped at four tenths of the shaft, or a short arrow is all head. */
export function arrowHead(ax: number, ay: number, bx: number, by: number, width: number) {
  const length = Math.hypot(bx - ax, by - ay);
  if (length === 0) return null;
  const size = Math.min(8 + width * 2.5, length * 0.4);
  const angle = Math.atan2(by - ay, bx - ax);
  const spread = Math.PI / 7;
  return {
    tip: [bx, by] as BoardPoint,
    left: [bx - size * Math.cos(angle - spread), by - size * Math.sin(angle - spread)] as BoardPoint,
    right: [bx - size * Math.cos(angle + spread), by - size * Math.sin(angle + spread)] as BoardPoint,
  };
}

/** The width switch sets the type size too, rather than a fourth knob on the bar. */
export function textFontSize(width: number) {
  return 12 + width * 2.5;
}

/** Estimated, not measured: a few pixels either way only decide whether the eraser bites. */
function textBox(stroke: Stroke) {
  const [x, y] = stroke.points[0];
  const fontSize = textFontSize(stroke.width);
  const width = Math.max(fontSize * 0.55, (stroke.text ?? '').length * fontSize * 0.55);
  const height = fontSize * 1.2;
  return { left: x, top: y - height / 2, right: x + width, bottom: y + height / 2 };
}

function distanceToRectOutline(px: number, py: number, rect: ReturnType<typeof boundsOf>) {
  return Math.min(
    distanceToSegment(px, py, rect.left, rect.top, rect.right, rect.top),
    distanceToSegment(px, py, rect.right, rect.top, rect.right, rect.bottom),
    distanceToSegment(px, py, rect.right, rect.bottom, rect.left, rect.bottom),
    distanceToSegment(px, py, rect.left, rect.bottom, rect.left, rect.top)
  );
}

export function hitsStroke(stroke: Stroke, px: number, py: number) {
  const drawnWidth = stroke.kind === 'marker' ? stroke.width * MARKER_WIDTH_SCALE : stroke.width;
  const threshold = ERASE_SLACK + drawnWidth / 2;

  if (stroke.kind === 'text') {
    const box = textBox(stroke);
    return px >= box.left && px <= box.right && py >= box.top && py <= box.bottom;
  }

  if (stroke.kind === 'rect') {
    return distanceToRectOutline(px, py, boundsOf(stroke)) <= threshold;
  }

  if (stroke.kind === 'ellipse') {
    // Distance to the outline, never the area: both shapes are drawn
    // unfilled, and an eraser that swallows one when it passes through its
    // empty middle looks like a bug.
    const rect = boundsOf(stroke);
    const rx = (rect.right - rect.left) / 2;
    const ry = (rect.bottom - rect.top) / 2;
    if (rx <= 0 || ry <= 0) return distanceToRectOutline(px, py, rect) <= threshold;
    const nx = (px - (rect.left + rx)) / rx;
    const ny = (py - (rect.top + ry)) / ry;
    return Math.abs(Math.hypot(nx, ny) - 1) * Math.min(rx, ry) <= threshold;
  }

  const { points } = stroke;
  if (points.length === 1) {
    return Math.hypot(px - points[0][0], py - points[0][1]) <= threshold;
  }
  for (let i = 1; i < points.length; i += 1) {
    const [ax, ay] = points[i - 1];
    const [bx, by] = points[i];
    if (distanceToSegment(px, py, ax, ay, bx, by) <= threshold) return true;
  }
  return false;
}

/** Back to front: the eraser takes the stroke lying on top, the one drawn last. */
export function findStrokeAt(strokes: readonly Stroke[], px: number, py: number) {
  for (let i = strokes.length - 1; i >= 0; i -= 1) {
    if (hitsStroke(strokes[i], px, py)) return strokes[i];
  }
  return null;
}
