'use client';

import { useEffect, useState, type Ref } from 'react';
import { cn } from '@/components/ui/cn';
import type { WarmupAnswer } from '@/lib/landing/warmup';
import styles from './landing.module.css';

/*
 * Rise over run, one segment per answer, in a 90 × 40 box: a correct answer
 * climbs a third of the height, a wrong or skipped one runs flat. Three
 * correct land exactly in the corner, at 800. The header meter is 9:4 and so
 * is the result plane, which is why the hand-over between them is one even
 * scale with nothing stretched.
 */

const RISE = 40 / 3;
const CLIMB_ANGLE = -23.96; // atan(13.333 / 30)
const CLIMB_LENGTH = 32.83; // hypot(30, 13.333)

interface SegmentShape {
  x: number;
  y: number;
  climbs: boolean;
}

function meterPath(answers: WarmupAnswer[]) {
  const segments: SegmentShape[] = [];
  let rise = 0;
  for (const [index, answer] of answers.entries()) {
    const climbs = answer.status === 'correct';
    segments.push({ x: 30 * index, y: 40 - RISE * rise, climbs });
    if (climbs) rise += 1;
  }
  return { segments, end: { x: 30 * answers.length, y: 40 - RISE * rise } };
}

const dotTone = {
  correct: 'fill-lime-700',
  incorrect: 'fill-red-600',
  skipped: 'fill-mist-400',
} as const;

/** The segments and the end dot, for either the header meter or the result plane. */
export function RiseSegments({
  answers,
  thick = false,
  animateLast = false,
}: {
  answers: WarmupAnswer[];
  /** The result plane draws heavier lines and a smaller dot. */
  thick?: boolean;
  animateLast?: boolean;
}) {
  const { segments, end } = meterPath(answers);
  const last = answers[answers.length - 1];

  return (
    <>
      {segments.map((segment, index) => (
        <Segment
          key={index}
          {...segment}
          strokeWidth={thick ? 3.5 : 2.5}
          animate={animateLast && index === segments.length - 1}
        />
      ))}
      {last && (
        <circle
          // Keyed by count, so every new answer pops its own dot.
          key={answers.length}
          cx={end.x}
          cy={end.y}
          r={thick ? 1.7 : 2.6}
          className={cn(dotTone[last.status], styles.pop)}
        />
      )}
    </>
  );
}

function Segment({ x, y, climbs, strokeWidth, animate }: SegmentShape & { strokeWidth: number; animate: boolean }) {
  const [on, setOn] = useState(!animate);

  // Two frames: the first paints the segment at scale 0, the second lets the
  // transition run from there.
  useEffect(() => {
    if (on) return;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setOn(true));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [on]);

  return (
    <g transform={climbs ? `translate(${x} ${y}) rotate(${CLIMB_ANGLE})` : `translate(${x} ${y})`}>
      <line
        x1={0}
        y1={0}
        x2={climbs ? CLIMB_LENGTH : 30}
        y2={0}
        className={cn(climbs ? 'stroke-board-600' : 'stroke-mist-400', styles.segment, on && styles.segmentOn)}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </g>
  );
}

/** The small meter in the warm-up card's header. */
export default function RiseMeter({
  answers,
  hidden,
  ref,
}: {
  answers: WarmupAnswer[];
  hidden?: boolean;
  ref?: Ref<SVGSVGElement>;
}) {
  return (
    <svg
      ref={ref}
      viewBox="0 0 90 40"
      aria-hidden="true"
      className={cn('h-[25px] w-14 shrink-0 overflow-visible min-[421px]:h-8 min-[421px]:w-18', hidden && 'invisible')}
    >
      <line
        x1={0}
        y1={40}
        x2={90}
        y2={0}
        className="stroke-mist-200"
        strokeWidth={1}
        strokeDasharray="2 3"
        vectorEffect="non-scaling-stroke"
      />
      <RiseSegments answers={answers} animateLast />
    </svg>
  );
}
