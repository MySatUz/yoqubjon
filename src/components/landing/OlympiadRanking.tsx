'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cardClass } from '@/components/ui/Card';
import { cn } from '@/components/ui/cn';
import { formatDuration } from '@/lib/olympiad';
import { useInViewOnce, useReducedMotion } from '@/lib/landing/hooks';
import styles from './landing.module.css';

/*
 * How an olympiad is ranked, shown on four made-up rows labelled "Example":
 * first in the order they finished, then re-sorted the way
 * `rankOlympiadAttempts` sorts — most solved first, time only breaks ties.
 * The re-sort is a FLIP: measure each row, reorder, and slide every row from
 * where it was. No real participant appears on the public page. Times are
 * written as the olympiad's own ranking writes them (formatDuration).
 */

interface Entrant {
  name: string;
  solved: number;
  /** Time spent, in seconds. */
  seconds: number;
  finished: number;
  rank: number;
}

const ENTRANTS: Entrant[] = [
  { name: 'Student A', solved: 19, seconds: 44 * 60 + 5, finished: 4, rank: 1 },
  { name: 'Student B', solved: 18, seconds: 29 * 60 + 45, finished: 2, rank: 2 },
  { name: 'Student C', solved: 18, seconds: 34 * 60 + 10, finished: 3, rank: 3 },
  { name: 'Student D', solved: 17, seconds: 25 * 60 + 30, finished: 1, rank: 4 },
];

const BY_FINISH = [...ENTRANTS].sort((a, b) => a.finished - b.finished);
const BY_RANK = [...ENTRANTS].sort((a, b) => a.rank - b.rank);

const EASE_ENTER = 'cubic-bezier(0.22, 1, 0.36, 1)';
const EASE_MOVE = 'cubic-bezier(0.65, 0, 0.35, 1)';

export default function OlympiadRanking() {
  const reduce = useReducedMotion();
  const [viewRef, inView] = useInViewOnce<HTMLDivElement>(0.4);
  const [ranked, setRanked] = useState(false);
  const [run, setRun] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const before = useRef<Map<string, number> | null>(null);

  // Without motion the table simply shows the ranking.
  const showRanked = ranked || reduce;
  const rows = showRanked ? BY_RANK : BY_FINISH;

  // Phase 1: rows arrive in finishing order, then the re-sort is queued.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!inView || reduce || !list) return;
    const elements = [...list.children] as HTMLElement[];
    elements.forEach((row, index) => {
      row.animate(
        [
          { transform: 'translateX(24px)', opacity: 0 },
          { transform: 'none', opacity: 1 },
        ],
        { duration: 260, delay: index * 90, easing: EASE_ENTER, fill: 'backwards' },
      );
    });
    const timer = window.setTimeout(() => {
      before.current = new Map(elements.map((row) => [row.dataset.name ?? '', row.getBoundingClientRect().top]));
      setRanked(true);
    }, 1560);
    return () => window.clearTimeout(timer);
  }, [inView, reduce, run]);

  // Phase 2: every row slides from where it stood to its place in the ranking.
  useLayoutEffect(() => {
    const list = listRef.current;
    const tops = before.current;
    if (!ranked || !tops || !list) return;
    before.current = null;
    for (const row of [...list.children] as HTMLElement[]) {
      const from = tops.get(row.dataset.name ?? '');
      if (from === undefined) continue;
      const dy = from - row.getBoundingClientRect().top;
      if (dy) row.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 600, easing: EASE_MOVE });
    }
  }, [ranked]);

  const replay = () => {
    setRanked(false);
    setRun((count) => count + 1);
  };

  return (
    <div ref={viewRef} className={cn(cardClass, 'overflow-hidden')}>
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
        <h3 className="text-base font-semibold text-gray-900">How the ranking works</h3>
        <Badge>Example</Badge>
      </div>

      <div ref={listRef} role="table" aria-label="Example ranking">
        {rows.map((entrant) => {
          const moved = entrant.finished - entrant.rank;
          return (
            <div
              key={entrant.name}
              role="row"
              data-name={entrant.name}
              // "29 min 45 s" needs 84px; the rank and arrow columns gave it up.
              className="grid grid-cols-[28px_minmax(0,1fr)_72px_84px_32px] items-center gap-2 border-t border-gray-100 bg-white px-4 py-2.5 text-sm first:border-t-0"
            >
              <span role="cell" className="font-semibold tabular-nums text-gray-900">
                {showRanked ? entrant.rank : '—'}
              </span>
              <span role="cell" className="truncate text-gray-900">
                {entrant.name}
              </span>
              <span role="cell" className="whitespace-nowrap tabular-nums text-gray-600">
                {entrant.solved} solved
              </span>
              <span role="cell" className="whitespace-nowrap tabular-nums text-gray-600">
                {formatDuration(entrant.seconds)}
              </span>
              <span
                role="cell"
                className={cn(
                  'text-right text-xs font-semibold tabular-nums transition-opacity duration-200',
                  moved > 0 ? 'text-green-700' : 'text-gray-500',
                  showRanked ? 'opacity-100' : 'opacity-0',
                )}
              >
                {moved > 0 ? `↑${moved}` : moved < 0 ? `↓${-moved}` : ''}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-4 py-2.5 text-sm text-gray-500">
        <span key={showRanked ? 'ranked' : 'finished'} className={styles.fade}>
          {showRanked ? 'Order in the ranking · Solved first. Time only breaks ties.' : 'Order they finished'}
        </span>
        {/* Outlined: as grey text beside the caption it read as part of it. */}
        {!reduce && (
          <Button variant="secondary" size="sm" onClick={replay}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Replay
          </Button>
        )}
      </div>
    </div>
  );
}
