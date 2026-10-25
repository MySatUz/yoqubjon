import {
  arrowHead,
  boundsOf,
  findStrokeAt,
  hitsStroke,
  isTwoPointKind,
  MARKER_ALPHA,
  MARKER_WIDTH_SCALE,
  MIN_POINT_GAP,
  nextStrokeId,
  sanitizeStroke,
  textFontSize,
  INKS,
  type BoardPoint,
  type Stroke,
  type StrokeKind,
} from '@/components/exam/whiteboard/geometry';
import { EMPTY_PAGE, useBoardStore } from '@/components/exam/whiteboard/boardStore';

/**
 * The canvas engine for one question's page: sizing, painting and the
 * pointer. Plain DOM rather than React state, because a stroke is hundreds of
 * pointer events a second and none of them should cost a render.
 *
 * One engine lives exactly as long as one question is on screen. The React
 * side mounts a fresh canvas per question (it is keyed by the page), so a new
 * question starts on a bitmap that has never held anything - there is no
 * "clear the old drawing" step to forget or to run a frame late, which is how
 * the lambdapi board once left question 10's working over question 11.
 */

/** A backing store is four bytes a pixel; past this, allocating it stops being instant. */
const PIXEL_BUDGET = 16e6;
/** Browsers refuse canvases past a side of 16-32k pixels; stay under the lowest. */
const MAX_SIDE = 16384;
/** Distance between eraser samples, so a fast swipe cannot jump over a thin line. */
const ERASE_STEP = 4;
const LASER_FADE_MS = 700;

type PathPair = { line: Path2D; head: Path2D | null };

/**
 * A committed stroke never changes - a change makes a new array - and its
 * points do not depend on the size of the surface, only on its centre line,
 * which the paint applies as a translation. So its path is built once, ever.
 */
const pathCache = new WeakMap<Stroke, PathPair>();

function buildPath(stroke: Stroke): PathPair {
  const line = new Path2D();
  let head: Path2D | null = null;
  const { points } = stroke;

  if (stroke.kind === 'rect' || stroke.kind === 'ellipse') {
    const rect = boundsOf(stroke);
    const width = rect.right - rect.left;
    const height = rect.bottom - rect.top;
    if (stroke.kind === 'rect') {
      line.rect(rect.left, rect.top, width, height);
    } else {
      line.ellipse(rect.left + width / 2, rect.top + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
    }
    return { line, head };
  }

  const [first] = points;
  line.moveTo(first[0], first[1]);

  if (points.length === 1) {
    // A path of one point draws nothing; a tenth of a pixel brings out the
    // round cap, so a tap leaves a dot instead of reading as a dead control.
    line.lineTo(first[0] + 0.1, first[1]);
    return { line, head };
  }

  if (stroke.kind === 'pen' || stroke.kind === 'marker') {
    // Through the midpoints, with each sampled point as the control: the
    // pointer samples at the display rate, and joining the samples with
    // straight segments shows the corners on every curve.
    for (let i = 1; i < points.length - 1; i += 1) {
      const [x, y] = points[i];
      const [nx, ny] = points[i + 1];
      line.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2);
    }
  }
  const last = points[points.length - 1];
  line.lineTo(last[0], last[1]);

  if (stroke.kind === 'arrow') {
    const shape = arrowHead(first[0], first[1], last[0], last[1], stroke.width);
    if (shape) {
      head = new Path2D();
      head.moveTo(shape.tip[0], shape.tip[1]);
      head.lineTo(shape.left[0], shape.left[1]);
      head.lineTo(shape.right[0], shape.right[1]);
      head.closePath();
    }
  }

  return { line, head };
}

function cachedPath(stroke: Stroke) {
  let path = pathCache.get(stroke);
  if (!path) {
    path = buildPath(stroke);
    pathCache.set(stroke, path);
  }
  return path;
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke, path: PathPair, fontFamily: string) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;

  if (stroke.kind === 'text') {
    const fontSize = textFontSize(stroke.width);
    const [x, y] = stroke.points[0];
    ctx.font = `600 ${fontSize}px ${fontFamily}`;
    ctx.textBaseline = 'middle';
    // A white halo first, so a label that lands on a diagram or on a line of
    // the question stays readable.
    ctx.lineWidth = Math.max(2, fontSize / 6);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.strokeText(stroke.text ?? '', x, y);
    ctx.fillText(stroke.text ?? '', x, y);
    ctx.restore();
    return;
  }

  let width = stroke.width;
  if (stroke.kind === 'marker') {
    ctx.globalAlpha = MARKER_ALPHA;
    width *= MARKER_WIDTH_SCALE;
  }
  ctx.lineWidth = width;
  ctx.stroke(path.line);
  if (path.head) ctx.fill(path.head);
  ctx.restore();
}

export interface Surface {
  setInteractive: (interactive: boolean) => void;
  destroy: () => void;
}

interface SurfaceOptions {
  pageKey: string;
  /** The text tool was pressed here; the React side owns the input field. */
  onTextRequest: (point: BoardPoint) => void;
}

export function createSurface(canvas: HTMLCanvasElement, { pageKey, onTextRequest }: SurfaceOptions): Surface | null {
  const context = canvas.getContext('2d');
  if (!context) return null;
  // Re-declared so the narrowing reaches the hoisted functions below.
  const ctx: CanvasRenderingContext2D = context;

  const fontFamily = getComputedStyle(canvas).fontFamily || 'sans-serif';
  const store = useBoardStore;

  let cssWidth = 0;
  let cssHeight = 0;
  let ratio = 1;
  let interactive = false;
  let destroyed = false;
  let frame = 0;

  let strokes = store.getState().pages[pageKey]?.strokes ?? EMPTY_PAGE.strokes;
  let draft: Stroke | null = null;
  /** An eraser drag works on a copy and lands as one change, so one Undo brings it all back. */
  let erase: { working: Stroke[]; changed: boolean; last: BoardPoint } | null = null;
  /** The one pointer drawing right now; a second finger is ignored, not a second stroke. */
  let activePointer: number | null = null;
  let laser: { x: number; y: number; releasedAt: number | null } | null = null;
  /** The pointer tool is pressed: a finger or a pen has no hover to follow. */
  let pointing = false;

  /* ---------------------------------------------------------------- paint */

  function drawLaser(now: number) {
    if (!laser) return;
    let alpha = 1;
    if (laser.releasedAt !== null) {
      const age = now - laser.releasedAt;
      if (age >= LASER_FADE_MS) {
        laser = null;
        return;
      }
      alpha = 1 - age / LASER_FADE_MS;
    }
    ctx.save();
    ctx.fillStyle = INKS[0].value;
    ctx.globalAlpha = alpha * 0.25;
    ctx.beginPath();
    ctx.arc(laser.x, laser.y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(laser.x, laser.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function paint() {
    if (destroyed || !cssWidth || !cssHeight) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);
    ctx.translate(cssWidth / 2, 0);
    for (const stroke of erase?.working ?? strokes) drawStroke(ctx, stroke, cachedPath(stroke), fontFamily);
    // The draft's points change on every move, so its path is never cached.
    if (draft) drawStroke(ctx, draft, buildPath(draft), fontFamily);
    drawLaser(performance.now());
  }

  /** One paint per frame, however many pointer events arrive inside it. */
  function schedule() {
    if (frame || destroyed) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      paint();
      if (laser && laser.releasedAt !== null) schedule();
    });
  }

  /* --------------------------------------------------------------- sizing */

  function measure() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    const deviceRatio = window.devicePixelRatio || 1;
    const budget = Math.sqrt(PIXEL_BUDGET / (rect.width * rect.height));
    ratio = Math.min(deviceRatio, budget, MAX_SIDE / rect.width, MAX_SIDE / rect.height);
    cssWidth = rect.width;
    cssHeight = rect.height;
    const nextWidth = Math.max(1, Math.round(rect.width * ratio));
    const nextHeight = Math.max(1, Math.round(rect.height * ratio));
    // Assigning either dimension wipes the bitmap, so only when it moved.
    if (canvas.width !== nextWidth) canvas.width = nextWidth;
    if (canvas.height !== nextHeight) canvas.height = nextHeight;
    return true;
  }

  // Repainted in the same callback, not on the next frame: the observer runs
  // after layout and before paint, and the resize above has just emptied the
  // bitmap - a frame's delay would show it blank.
  const observer = new ResizeObserver(() => {
    if (measure()) paint();
  });
  observer.observe(canvas);

  // Dragging the window to a screen with a different pixel density changes
  // nothing the observer sees, and the drawing would go soft or oversized.
  let densityQuery: MediaQueryList | null = null;
  const onDensityChange = () => {
    watchDensity();
    if (measure()) paint();
  };
  function watchDensity() {
    densityQuery?.removeEventListener('change', onDensityChange);
    densityQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    densityQuery.addEventListener('change', onDensityChange);
  }
  watchDensity();

  // Labels painted before the web font arrived would stay in the fallback.
  document.fonts?.ready.then(() => paint()).catch(() => {});

  /* ---------------------------------------------------------------- store */

  // Undo, redo, clear and every committed stroke land here. Painted at once:
  // each is a single change, not a stream of them.
  const unsubscribe = store.subscribe((state) => {
    const next = state.pages[pageKey]?.strokes ?? EMPTY_PAGE.strokes;
    if (next === strokes) return;
    strokes = next;
    paint();
  });

  /* -------------------------------------------------------------- pointer */

  function pointsFrom(event: PointerEvent): BoardPoint[] {
    const rect = canvas.getBoundingClientRect();
    const half = rect.width / 2;
    const toPoint = (item: PointerEvent): BoardPoint => [
      Math.round(Math.min(Math.max(item.clientX - rect.left - half, -half), half) * 10) / 10,
      Math.round(Math.min(Math.max(item.clientY - rect.top, 0), rect.height) * 10) / 10,
    ];
    // The browser hands out one move per frame; the samples in between are
    // what keep a fast curve from turning into a polygon.
    const coalesced = event.getCoalescedEvents?.() ?? [];
    return coalesced.length > 0 ? coalesced.map(toPoint) : [toPoint(event)];
  }

  function eraseAlong(to: BoardPoint) {
    if (!erase) return;
    const [ax, ay] = erase.last;
    const steps = Math.max(1, Math.ceil(Math.hypot(to[0] - ax, to[1] - ay) / ERASE_STEP));
    for (let i = 1; i <= steps; i += 1) {
      const x = ax + ((to[0] - ax) * i) / steps;
      const y = ay + ((to[1] - ay) * i) / steps;
      if (!findStrokeAt(erase.working, x, y)) continue;
      erase.working = erase.working.filter((stroke) => !hitsStroke(stroke, x, y));
      erase.changed = true;
    }
    erase.last = to;
  }

  /** Lands whatever is in progress - on this page, whatever happens next. */
  function finishGesture() {
    activePointer = null;
    pointing = false;
    if (erase) {
      const { working, changed } = erase;
      erase = null;
      if (changed) store.getState().replaceStrokes(pageKey, working);
      else paint();
    }
    if (draft) {
      const stroke = sanitizeStroke(draft);
      draft = null;
      if (stroke) store.getState().addStroke(pageKey, stroke);
      else paint();
    }
  }

  function releaseLaser() {
    if (laser && laser.releasedAt === null) {
      laser.releasedAt = performance.now();
      schedule();
    }
  }

  function moveLaser(point: BoardPoint) {
    laser = { x: point[0], y: point[1], releasedAt: null };
    schedule();
  }

  function onPointerDown(event: PointerEvent) {
    if (!interactive) return;
    // 0 is a mouse's main button, a finger and a pen tip; 5 is the eraser end
    // of a pen, which erases whatever tool is chosen.
    if (event.button !== 0 && event.button !== 5) return;
    if (activePointer !== null) return;

    const { tool, colorIndex, width } = store.getState();
    // BoardCanvas already lets presses through on the cursor; this keeps a
    // surface told otherwise from starting a stroke of no kind.
    if (tool === 'cursor') return;

    // Keeps the press from selecting question text or moving focus away from
    // a label that is about to open.
    event.preventDefault();

    const [point] = pointsFrom(event).slice(-1);

    if (tool === 'text' && event.button !== 5) {
      onTextRequest(point);
      return;
    }

    // Capture keeps a fast stroke alive once the pointer outruns the canvas.
    // It throws if the pointer is already gone, and that must not cost the
    // whole press.
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // drawing continues without the capture
    }
    activePointer = event.pointerId;

    if (tool === 'laser' && event.button !== 5) {
      pointing = true;
      moveLaser(point);
      return;
    }

    if (tool === 'eraser' || event.button === 5) {
      erase = { working: [...strokes], changed: false, last: point };
      eraseAlong(point);
      schedule();
      return;
    }

    draft = {
      id: nextStrokeId(),
      kind: tool as StrokeKind,
      color: INKS[colorIndex]?.value ?? INKS[0].value,
      width,
      points: [point],
    };
    schedule();
  }

  function onPointerMove(event: PointerEvent) {
    if (!interactive) return;

    if (activePointer === null) {
      // Hovering with the pointer tool: the dot follows the mouse, which is
      // what a class watching the projector needs to see.
      if (store.getState().tool === 'laser' && event.pointerType === 'mouse') {
        moveLaser(pointsFrom(event).slice(-1)[0]);
      }
      return;
    }
    if (event.pointerId !== activePointer) return;

    const points = pointsFrom(event);
    if (pointing) {
      moveLaser(points[points.length - 1]);
      return;
    }
    if (erase) {
      for (const point of points) eraseAlong(point);
      schedule();
      return;
    }
    if (!draft) return;

    if (isTwoPointKind(draft.kind)) {
      draft.points[1] = points[points.length - 1];
    } else {
      for (const point of points) {
        const last = draft.points[draft.points.length - 1];
        if (Math.hypot(point[0] - last[0], point[1] - last[1]) >= MIN_POINT_GAP) draft.points.push(point);
      }
    }
    schedule();
  }

  function onPointerUp(event: PointerEvent) {
    if (event.pointerType !== 'mouse') releaseLaser();
    if (event.pointerId !== activePointer) return;
    try {
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    } catch {
      // the capture was never taken
    }
    finishGesture();
  }

  // Alt-Tab or a system gesture in the middle of a stroke ends it here
  // instead of leaving it half-drawn and the pointer locked.
  function onLostCapture(event: PointerEvent) {
    if (event.pointerId === activePointer) finishGesture();
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('lostpointercapture', onLostCapture);
  canvas.addEventListener('pointerleave', releaseLaser);

  if (measure()) paint();

  return {
    setInteractive(next) {
      if (interactive === next) return;
      interactive = next;
      if (!next) {
        finishGesture();
        laser = null;
        paint();
      }
    },

    destroy() {
      // A stroke or an eraser drag still in progress belongs to this page,
      // whatever replaces it - the timer can end a module mid-stroke.
      finishGesture();
      destroyed = true;
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      densityQuery?.removeEventListener('change', onDensityChange);
      unsubscribe();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('lostpointercapture', onLostCapture);
      canvas.removeEventListener('pointerleave', releaseLaser);
    },
  };
}
