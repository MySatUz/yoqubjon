'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/components/ui/cn';
import { useOnScreen } from '@/lib/landing/hooks';
import styles from './landing.module.css';

/*
 * Desktop only: a dot field behind the warm-up card, and one "slope" line that
 * rises from the bottom edge, passes behind the card and ends at 800 in the
 * top-right corner, drawing itself on a loop. Nothing sits behind the text.
 *
 * The line is laid out in real pixels — the SVG's viewBox is its measured box,
 * not a stretched one — so its angle and stroke stay true at any width. The
 * loop stops while the hero is off screen.
 */
export default function HeroBackdrop() {
  const [ref, onScreen] = useOnScreen<HTMLDivElement>();
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      // Hidden on phones, where the box measures zero: draw nothing.
      setSize(width > 0 && height > 0 ? { width, height } : null);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  const line = size && {
    x1: size.width * 0.42,
    y1: size.height,
    x2: size.width * 0.985,
    y2: size.height * 0.07,
  };

  return (
    <div ref={ref} aria-hidden="true" className={cn('pointer-events-none absolute inset-0 hidden lg:block', !onScreen && styles.paused)}>
      <svg className="absolute right-0 top-0 h-full w-[44%] text-gray-300">
        <defs>
          <pattern id="hero-dots" width="14" height="14" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.2" fill="currentColor" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hero-dots)" />
      </svg>

      {size && line && (
        <>
          <svg viewBox={`0 0 ${size.width} ${size.height}`} className="absolute inset-0 h-full w-full overflow-visible">
            <line {...line} className="stroke-ink-100" strokeWidth="2" />
            <line {...line} pathLength={1} className={cn('stroke-ink-600', styles.heroDraw)} strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span
            className={cn('absolute flex items-center gap-1.5 text-sm font-semibold tabular-nums text-ink-600', styles.heroGoal)}
            style={{ left: line.x2 + 5, top: line.y2 }}
          >
            800
            <i className={cn('h-2.5 w-2.5 rounded-full bg-ink-600', styles.heroGoalDot)} />
          </span>
        </>
      )}
    </div>
  );
}
