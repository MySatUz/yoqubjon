'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowDown } from 'lucide-react';
import { buttonClass, linkClass } from '@/components/ui/Button';
import { insetClass } from '@/components/ui/Card';
import { cn } from '@/components/ui/cn';
import { formatDuration } from '@/lib/olympiad';
import {
  challengeLink,
  countCorrect,
  verdictFor,
  type WarmupAnswer,
} from '@/lib/landing/warmup';
import { RiseSegments } from './RiseMeter';
import styles from './landing.module.css';

/**
 * The card in result mode. It refuses to name a score: three questions are a
 * slope, not a measurement. It shows only what was measured — correct and
 * time — and says where a score estimate comes from, rather than drawing an
 * empty score for the free module to fill in.
 *
 * The header meter grows into the plane here (FLIP): `from` is the meter's box
 * measured just before the switch, and the plane starts drawn over it at the
 * same size, then eases out to its own. Both are 9:4, so the scale is even.
 */
export default function WarmupResult({
  answers,
  totalMs,
  from,
  reduce,
}: {
  answers: WarmupAnswer[];
  totalMs: number;
  from: DOMRect | null;
  reduce: boolean;
}) {
  const correct = countCorrect(answers);
  const planeRef = useRef<HTMLDivElement>(null);
  const [settled, setSettled] = useState(false);

  useLayoutEffect(() => {
    const plane = planeRef.current;
    if (!plane || !from || reduce) return;
    const last = plane.getBoundingClientRect();
    if (!last.width) return;
    plane.style.transition = 'none';
    plane.style.transform = `translate(${from.left - last.left}px, ${from.top - last.top}px) scale(${from.width / last.width})`;
    void plane.getBoundingClientRect();
    plane.style.transition = 'transform 600ms cubic-bezier(0.2, 0.8, 0.2, 1)';
    plane.style.transform = 'none';
  }, [from, reduce]);

  // Once the plane has landed: a clean run lights "800"; otherwise the dashed
  // rest of the line shows how far a full module still goes.
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(true), reduce ? 0 : 650);
    return () => window.clearTimeout(timer);
  }, [reduce]);

  const stats = [
    { label: 'Correct', value: `${correct} of 3` },
    { label: 'Time', value: formatDuration(totalMs / 1000) },
  ];

  return (
    <div>
      <p className="mb-4 mt-0.5 text-3xl font-semibold leading-[1.1] tracking-tight text-mist-900">
        That’s a slope.
        <br />
        Not a score.
      </p>

      <div ref={planeRef} className="relative aspect-[9/4] w-full origin-top-left rounded-xl border border-mist-100 bg-mist-50">
        <svg viewBox="-4 -6 98 50" preserveAspectRatio="none" aria-hidden="true" className="block size-full overflow-visible">
          <line
            x1={0}
            y1={40}
            x2={90}
            y2={0}
            className={cn('stroke-mist-300 transition-opacity duration-300', settled && correct < 3 ? 'opacity-100' : 'opacity-0')}
            strokeWidth={1}
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
          <RiseSegments answers={answers} thick />
        </svg>
        <span
          className={cn(
            'absolute right-1.5 top-1 text-xs font-semibold tabular-nums',
            settled && correct === 3 ? cn('text-board-600', styles.pulse) : 'text-mist-500',
          )}
        >
          800
        </span>
        {correct < 3 && (
          <span
            className={cn(
              'absolute bottom-1.5 right-2 text-xs text-mist-500 transition-opacity duration-300',
              settled ? 'opacity-100' : 'opacity-0',
            )}
          >
            The rest is a full module
          </span>
        )}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2">
        {stats.map((stat, index) => (
          <div
            key={stat.label}
            className={cn(insetClass, 'min-w-0 px-3 py-2', styles.fadeUpSlow)}
            style={{ animationDelay: `${450 + index * 60}ms` }}
          >
            <dt className="text-xs text-mist-500">{stat.label}</dt>
            <dd className="whitespace-nowrap text-xl font-semibold tracking-tight tabular-nums text-mist-900">
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>

      {/* Where a score comes from, instead of an empty one: the owner's rule is
          no score on screen before there is one. */}
      <p className="mt-4 text-base leading-6 text-mist-600">
        {verdictFor(correct)} One full test gives you a score estimate on the 200–800 scale.
      </p>

      <div className="mt-4 grid gap-2">
        <Link href="/register?from=warmup" className={buttonClass({ size: 'lg', block: true })}>
          Start my free module
        </Link>
        <a
          href={challengeLink(correct, totalMs)}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClass({ variant: 'secondary', size: 'lg', block: true })}
        >
          Challenge a friend
        </a>
        <a
          href="#review"
          // An underlined link, as every link in text is; h-10 gives it a
          // finger-sized target without making it a third button.
          className={cn(linkClass, 'inline-flex h-10 items-center gap-1 justify-self-center px-2 text-sm')}
        >
          See my review
          <ArrowDown className="h-4 w-4" aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}
