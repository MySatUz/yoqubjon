'use client';

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { cn } from '@/components/ui/cn';
import { MINUS } from '@/lib/landing/warmup';
import { Var } from './MathText';
import styles from './landing.module.css';
import math from './math.module.css';

/*
 * Q3's figure: y = x² + 8 and a line through P(0, 4). Once the student
 * answers, the line swings into the right-hand tangent (m = 4), a second line
 * swings into the left-hand one (m = −4), and the trap — "all possible
 * values" — is on screen instead of in a paragraph. Then the line can be
 * dragged.
 *
 * Plot space: x ∈ [−5, 5], y ∈ [0, 26] in a 320 × 208 plot, 32 px per unit
 * across and 8 px per unit up. A slope m therefore shows on screen as m / 4,
 * so both tangents sit at exactly ±45°. The box is 226 tall: the x-axis
 * numbers sit under the axis, at 12 units — about 12px on a phone, where the
 * figure is drawn at roughly 1:1.
 *
 * The swing and the drag write the SVG directly — one requestAnimationFrame
 * loop setting transforms, attributes and text — instead of re-rendering the
 * card sixty times a second. React owns the structure and never changes what
 * the loop writes.
 */

const X = (x: number) => 160 + 32 * x;
const Y = (y: number) => 208 - 8 * y;
const angleOf = (m: number) => (-Math.atan(m / 4) * 180) / Math.PI;

const VIEW_HEIGHT = 226;

type Point = [number, number];
interface Contacts {
  kind: 'touch' | 'miss' | 'cross';
  points: Point[];
}

/** Where y = mx + 4 meets the parabola: x² − mx + 4 = 0. */
function contacts(m: number): Contacts {
  if (Math.abs(Math.abs(m) - 4) < 0.06) return { kind: 'touch', points: [[Math.sign(m) * 2, 12]] };
  const discriminant = m * m - 16;
  if (discriminant < 0) return { kind: 'miss', points: [] };
  const root = Math.sqrt(discriminant);
  return {
    kind: 'cross',
    points: [(m - root) / 2, (m + root) / 2]
      .map((x): Point => [x, m * x + 4])
      .filter(([x, y]) => x >= -5 && x <= 5 && y >= 0 && y <= 26),
  };
}

const NBSP = String.fromCharCode(0xa0);

const signed = (value: number) => `${value < 0 ? MINUS : ''}${Math.abs(value).toFixed(1)}`;

function describe(m: number, found: Contacts) {
  const verb = found.kind === 'touch' ? 'touches once' : found.kind === 'miss' ? 'misses' : 'crosses twice';
  return `m = ${signed(m)} · ${verb}`;
}

/** A damped swing from one slope to another: overshoot, undershoot, settle. */
const swing = (from: number, to: number, t: number, tau: number, period: number) =>
  to + (from - to) * Math.exp(-t / tau) * Math.cos((2 * Math.PI * t) / period);

// The captions speak to the answer the student chose.
const FIRST_LINE: Record<string, string> = {
  C: 'That’s the one you found.',
  D: 'This is m = 4.',
  A: 'One slope is 4.',
  B: 'm = 4…',
};
const SECOND_LINE: Record<string, string> = {
  C: 'And the one you didn’t.',
  D: `This is the other one: m = ${MINUS}4.`,
  A: `The other is ${MINUS}4. Product ${MINUS}16, sum 0.`,
  B: `…and m = ${MINUS}4. You saw both.`,
};

interface FigureNodes {
  svg: SVGSVGElement;
  first: SVGGElement;
  second: SVGGElement;
  dots: SVGCircleElement[];
  handle: SVGGElement;
  captionA: HTMLElement;
  captionB: HTMLElement;
}

function nodesOf(figure: HTMLElement): FigureNodes {
  const pick = <T extends Element>(name: string) => figure.querySelector(`[data-part="${name}"]`) as T;
  return {
    svg: pick<SVGSVGElement>('svg'),
    first: pick<SVGGElement>('first'),
    second: pick<SVGGElement>('second'),
    dots: [...figure.querySelectorAll<SVGCircleElement>('[data-part="dot"]')],
    handle: pick<SVGGElement>('handle'),
    captionA: pick<HTMLElement>('caption-a'),
    captionB: pick<HTMLElement>('caption-b'),
  };
}

function setLine(group: SVGGElement, m: number) {
  // An SVG transform attribute, so the rotation is about the group's own
  // origin, P.
  group.setAttribute('transform', `rotate(${angleOf(m)})`);
}

/** Touch points are filled green, crossings hollow; returns what this slope does. */
function drawPoints(nodes: FigureNodes, m: number, fixed: Point[]) {
  const found = contacts(m);
  const shown: { point: Point; touch: boolean }[] = fixed.map((point) => ({ point, touch: true }));
  if (found.kind === 'touch' && !fixed.some(([x]) => x === found.points[0][0])) {
    shown.push({ point: found.points[0], touch: true });
  }
  if (found.kind === 'cross') shown.push(...found.points.map((point) => ({ point, touch: false })));

  nodes.dots.forEach((dot, index) => {
    const item = shown[index];
    if (!item) {
      dot.setAttribute('visibility', 'hidden');
      return;
    }
    dot.setAttribute('visibility', 'visible');
    dot.setAttribute('cx', String(X(item.point[0])));
    dot.setAttribute('cy', String(Y(item.point[1])));
    dot.setAttribute('class', item.touch ? 'fill-green-700 stroke-green-700' : 'fill-white stroke-gray-900');
  });
  nodes.captionA.textContent = describe(m, found);
  return found;
}

/** The handle rides the line 88 px from P, on whichever side the line rises. */
function placeHandle(nodes: FigureNodes, m: number) {
  const angle = Math.atan(m / 4);
  const side = m >= 0 ? 1 : -1;
  const x = 160 + side * 88 * Math.cos(angle);
  const y = 176 - side * 88 * Math.sin(angle);
  nodes.handle.setAttribute('transform', `translate(${x} ${y})`);
}

const KEY_STEPS: Record<string, number> = { ArrowRight: 0.1, ArrowUp: 0.1, ArrowLeft: -0.1, ArrowDown: -0.1, PageUp: 1, PageDown: -1 };

export default function TangentFigure({
  checked,
  given,
  reduce,
  onSettled,
}: {
  checked: boolean;
  given: string | null;
  reduce: boolean;
  /** Called once both tangents are drawn; the result button waits for it. */
  onSettled: () => void;
}) {
  const figureRef = useRef<HTMLDivElement>(null);
  const live = useRef({ m: 4, fixed: [] as Point[], dragging: false, touched: false });
  const [settled, setSettled] = useState(false);
  const [hint, setHint] = useState(true);

  useEffect(() => {
    const figure = figureRef.current;
    if (!checked || !figure) return;

    const nodes = nodesOf(figure);
    const state = live.current;
    const firstLine = FIRST_LINE[given ?? ''] ?? 'This is m = 4.';
    const secondLine = SECOND_LINE[given ?? ''] ?? `And the other one: m = ${MINUS}4.`;
    let frame = 0;
    let finished = false;

    const finish = () => {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(frame);
      state.fixed = [[2, 12], [-2, 12]];
      state.m = 4;
      setLine(nodes.first, 4);
      setLine(nodes.second, -4);
      nodes.second.style.opacity = '1';
      drawPoints(nodes, -4, state.fixed);
      nodes.captionA.textContent = `m = 4 and m = ${MINUS}4 · both touch`;
      nodes.captionB.textContent = secondLine;
      placeHandle(nodes, 4);
      setSettled(true);
      onSettled();
    };

    // Phase A swings the first line from flat into m = 4; a short hold; phase
    // B swings the second line from there into m = −4. A tap skips to the end.
    const started = performance.now();
    const step = (now: number) => {
      const t = now - started;
      if (t < 1600) {
        const m = swing(0, 4, t / 1000, 0.35, 0.9);
        setLine(nodes.first, m);
        drawPoints(nodes, m, state.fixed);
      } else if (t < 1900) {
        setLine(nodes.first, 4);
        state.fixed = [[2, 12]];
        drawPoints(nodes, 4, state.fixed);
        nodes.captionB.textContent = firstLine;
      } else if (t < 3200) {
        nodes.second.style.opacity = '1';
        const m = swing(4, -4, (t - 1900) / 1000, 0.3, 0.8);
        setLine(nodes.second, m);
        drawPoints(nodes, m, state.fixed);
      } else {
        finish();
        return;
      }
      frame = requestAnimationFrame(step);
    };

    figure.addEventListener('click', finish);
    frame = requestAnimationFrame(reduce ? finish : step);
    return () => {
      cancelAnimationFrame(frame);
      figure.removeEventListener('click', finish);
    };
  }, [checked, given, reduce, onSettled]);

  const setSlope = (value: number, snapWithin = 0) => {
    const figure = figureRef.current;
    if (!figure) return;
    const nodes = nodesOf(figure);
    const state = live.current;

    let next = Math.max(-8, Math.min(8, value));
    // A drag sticks within ±0.12 of a tangent, close enough to find by hand.
    // The keys move in exact 0.1 steps and land on ±4 by themselves, so they
    // never snap: a snap wider than one step would hold them at m = 4.
    const snap = snapWithin > 0 ? [4, -4].find((target) => Math.abs(next - target) < snapWithin) : undefined;
    if (snap !== undefined) {
      if (Math.abs(state.m - snap) > 0.01 && !reduce) navigator.vibrate?.(12);
      next = snap;
    }
    state.m = next;

    // The first drag clears the two drawn tangents: now it is the student's line.
    if (!state.touched) {
      state.touched = true;
      state.fixed = [];
      nodes.second.style.opacity = '0';
      setHint(false);
    }

    placeHandle(nodes, next);
    setLine(nodes.first, next);
    const found = drawPoints(nodes, next, state.fixed);
    nodes.captionB.textContent = `m² ${MINUS} 16 = ${signed(next * next - 16)}`;
    nodes.handle.setAttribute('aria-valuenow', next.toFixed(1));
    nodes.handle.setAttribute('aria-valuetext', describe(next, found));
  };

  const onPointerMove = (event: PointerEvent<SVGGElement>) => {
    const figure = figureRef.current;
    if (!live.current.dragging || !figure) return;
    const box = nodesOf(figure).svg.getBoundingClientRect();
    const px = ((event.clientX - box.left) * 320) / box.width;
    const py = ((event.clientY - box.top) * VIEW_HEIGHT) / box.height;
    const dx = px - 160;
    const dy = Math.max(176 - py, 4);
    if (Math.abs(dx) < 6) return;
    // Screen slope dy/dx is m · 8/32, so m is four times it.
    setSlope((4 * dy) / dx, 0.12);
  };

  const onKeyDown = (event: KeyboardEvent<SVGGElement>) => {
    const step = KEY_STEPS[event.key];
    if (step !== undefined) {
      event.preventDefault();
      setSlope(Math.round((live.current.m + step) * 10) / 10);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      setSlope(event.key === 'Home' ? -8 : 8);
    }
  };

  return (
    <>
      <div ref={figureRef} className="relative mt-3 overflow-hidden rounded-xl border border-gray-100 bg-white">
        <svg
          data-part="svg"
          viewBox={`0 0 320 ${VIEW_HEIGHT}`}
          role="img"
          aria-label="Parabola y equals x squared plus 8, and a line through (0, 4) with slope m."
          className="block h-auto w-full touch-pan-y"
        >
          <defs>
            <clipPath id="warmup-plot">
              <rect x="0" y="0" width="320" height="208" />
            </clipPath>
            <pattern id="warmup-grid" width="32" height="32" patternUnits="userSpaceOnUse" x="0" y="16">
              <path d="M32 0H0V32" fill="none" className="stroke-gray-100" />
            </pattern>
          </defs>
          <rect width="320" height="208" fill="url(#warmup-grid)" />
          <line x1="0" y1="208" x2="320" y2="208" className="stroke-gray-300" />
          <line x1="160" y1="0" x2="160" y2="212" className="stroke-gray-300" />
          {[-4, -2, 2, 4].map((x) => (
            <g key={x}>
              <line x1={X(x)} y1="205" x2={X(x)} y2="211" className="stroke-gray-300" />
              <text x={X(x)} y="223" fontSize="12" textAnchor="middle" className="fill-gray-500 tabular-nums">
                {x < 0 ? `${MINUS}${-x}` : x}
              </text>
            </g>
          ))}
          {/* Above the vertex: beside it, the 8 sat on the curve. */}
          <text x="166" y={Y(8) - 6} fontSize="12" className="fill-gray-500 tabular-nums">8</text>
          <text x="166" y={Y(16) + 4} fontSize="12" className="fill-gray-500 tabular-nums">16</text>

          {/* y = x² + 8 on x ∈ [−4, 4] is exactly this quadratic Bézier; its
              midpoint (160, 144) is the vertex (0, 8). */}
          <path d="M32 16 Q160 272 288 16" fill="none" className="stroke-gray-900" strokeWidth="2" />
          {/* SVG text in KaTeX's faces, like MathText's Var and MathRun. */}
          <text x="176" y="52" fontSize="14" className={cn('fill-gray-900', math.upright)}>
            <tspan className={math.variable}>y</tspan> = <tspan className={math.variable}>x</tspan>² + 8
          </text>

          <g clipPath="url(#warmup-plot)">
            <g transform="translate(160 176)">
              <g data-part="second" opacity={0} className="transition-opacity duration-200">
                <line x1="-260" y1="0" x2="260" y2="0" className="stroke-ink-600" strokeWidth="2.5" strokeDasharray="6 5" strokeLinecap="round" />
              </g>
              <g data-part="first">
                <line
                  x1="-260"
                  y1="0"
                  x2="260"
                  y2="0"
                  className="stroke-ink-600"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={checked ? undefined : '5 6'}
                />
              </g>
            </g>
            {[0, 1, 2, 3].map((index) => (
              <circle key={index} data-part="dot" r="5" strokeWidth="2" visibility="hidden" />
            ))}
          </g>

          <circle cx="160" cy="176" r="5" className="fill-white stroke-ink-600" strokeWidth="2.5" />
          <text x="118" y="190" fontSize="13" textAnchor="end" className={cn('fill-gray-600', math.upright)}>
            <tspan className={math.variable}>y</tspan> = <tspan className={math.variable}>mx</tspan> + 4
          </text>

          <g
            data-part="handle"
            role="slider"
            tabIndex={settled ? 0 : -1}
            aria-label="Slope m"
            aria-valuemin={-8}
            aria-valuemax={8}
            aria-valuenow={4}
            aria-valuetext="m = 4.0 · touches once"
            className="group cursor-grab touch-none focus:outline-hidden active:cursor-grabbing"
            style={{ display: settled ? undefined : 'none' }}
            onPointerDown={(event) => {
              live.current.dragging = true;
              event.currentTarget.setPointerCapture(event.pointerId);
              event.preventDefault();
            }}
            onPointerMove={onPointerMove}
            onPointerUp={() => {
              live.current.dragging = false;
            }}
            onPointerCancel={() => {
              live.current.dragging = false;
            }}
            onKeyDown={onKeyDown}
          >
            {/* 44 px of target around an 8 px knob. */}
            <circle r="22" fill="transparent" />
            <circle r="8" className="fill-white stroke-ink-600" strokeWidth="3" />
            {/* Keyboard focus: a ring clear of the knob, the SVG form of
                focusRingClass. A thicker knob edge alone was easy to miss. */}
            <circle r="13" className="fill-none stroke-ink-600 opacity-0 group-focus-visible:opacity-100" strokeWidth="2" />
          </g>
        </svg>

        {settled && hint && (
          <span className="pointer-events-none absolute left-2 top-2 rounded-md bg-white px-1.5 py-0.5 text-xs text-gray-600">
            Drag the line. Find both touches.
          </span>
        )}

        <div className="flex min-h-8 justify-between gap-2 border-t border-gray-100 px-3 py-1.5 text-sm tabular-nums text-gray-600">
          <span data-part="caption-a" className="whitespace-nowrap">Line through (0,{NBSP}4)</span>
          <span data-part="caption-b" className="text-right" />
        </div>
      </div>

      {settled && (
        <p className={cn('mt-3 text-sm leading-6 text-gray-900', styles.fadeUpSlow)}>
          <Var>x</Var>² + 8 = <Var>mx</Var> + 4 → <Var>x</Var>² {MINUS} <Var>mx</Var> + 4 = 0. One point means
          discriminant 0: <Var>m</Var>² {MINUS} 16 = 0. <span className="font-semibold">Sum: 0.</span>
        </p>
      )}
    </>
  );
}
