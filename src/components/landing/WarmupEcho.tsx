'use client';

import { cn } from '@/components/ui/cn';
import { formatDuration } from '@/lib/olympiad';
import { useWarmupEcho } from '@/lib/landing/hooks';
import { countCorrect, type WarmupAnswer, type WarmupRun } from '@/lib/landing/warmup';

/** The rise-over-run path as polyline points in the meter's 90 × 40 box. */
function risePoints(answers: WarmupAnswer[]) {
  const points = ['0,40'];
  let rise = 0;
  for (const [index, answer] of answers.entries()) {
    if (answer.status === 'correct') rise += 1;
    points.push(`${30 * (index + 1)},${40 - (40 / 3) * rise}`);
  }
  return points.join(' ');
}

/** The finished warm-up: this page's run if it has one, else the stored one. */
function useFinishedRun(): WarmupRun | null {
  const { live, stored } = useWarmupEcho();
  if (live.done) return live;
  return stored?.done ? stored : null;
}

/** The closing section's line: "Your warm-up: 2 of 3 in 3 min 41 s. The real thing is next." */
export function WarmupEchoLine({ className }: { className?: string }) {
  const run = useFinishedRun();
  if (!run) return null;
  return (
    <p className={cn('font-medium text-gray-900', className)}>
      Your warm-up: {countCorrect(run.answers)} of 3 in {formatDuration(run.totalMs / 1000)}. The real thing is next.
    </p>
  );
}

/** The sign-up screen's chip, with a still copy of the warm-up's rise path. */
export function WarmupChip({ className }: { className?: string }) {
  const run = useFinishedRun();
  if (!run) return null;

  return (
    <span className={cn('inline-flex h-6 items-center gap-1.5 rounded-full bg-gray-100 px-2 text-xs font-medium text-gray-600', className)}>
      <svg viewBox="-2 -2 94 44" className="h-3 w-7 overflow-visible" aria-hidden="true">
        <polyline points={risePoints(run.answers)} fill="none" className="stroke-ink-600" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
      Warm-up: {countCorrect(run.answers)} of 3 · {formatDuration(run.totalMs / 1000)}
    </span>
  );
}
