'use client';

import { cardClass } from '@/components/ui/Card';
import { cn } from '@/components/ui/cn';
import { useInViewOnce, useOnScreen } from '@/lib/landing/hooks';
import styles from './landing.module.css';

/*
 * How the real test routes you: Module 1 runs to a fork, the harder Module 2
 * climbs to 800, the other branch flattens out under a lower ceiling. The
 * upper branch draws itself the first time the figure is seen, then a dot
 * keeps riding it to 800 — only while the figure is on screen.
 *
 * Geometry in a 320 × 180 box: Module 1 at (32, 108), the fork F at
 * (108, 108), 800 at (288, 32) — F → 800 is 195.4 long at −22.89°.
 */
export default function HardBranch() {
  const [viewRef, inView] = useInViewOnce<HTMLElement>(0.4);
  const [screenRef, onScreen] = useOnScreen<HTMLDivElement>();

  return (
    <figure ref={viewRef} className={cn(cardClass, 'm-0 p-4', inView && styles.inView)}>
      <div ref={screenRef} className={cn(!onScreen && styles.paused)}>
        <svg
          viewBox="0 0 320 180"
          role="img"
          aria-label="Module 1 leads to a fork: the harder Module 2 reaches 800, the other branch has a lower ceiling."
          className="block h-auto w-full overflow-visible"
        >
          <line x1="32" y1="108" x2="108" y2="108" className="stroke-gray-400" strokeWidth="2" />
          <g transform="translate(108 108) rotate(14.23)">
            <line x1="0" y1="0" x2="146.5" y2="0" className="stroke-gray-300" strokeWidth="2" />
          </g>
          <line x1="244" y1="134" x2="258" y2="154" className="stroke-gray-300" strokeWidth="2" transform="rotate(-42 251 144)" />
          <text x="206" y="170" fontSize="12" className="fill-gray-500">
            lower ceiling
          </text>
          <g transform="translate(108 108) rotate(-22.89)">
            <line
              x1="0"
              y1="0"
              x2="195.4"
              y2="0"
              className={cn('stroke-ink-600', styles.branchUpper)}
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </g>
          <text x="146" y="58" fontSize="12" fontWeight="600" transform="rotate(-22.89 146 58)" className="fill-ink-700">
            Harder Module 2
          </text>
          <circle cx="32" cy="108" r="6" className="fill-white stroke-gray-500" strokeWidth="2" />
          <text x="8" y="132" fontSize="12" className="fill-gray-600">
            Module 1
          </text>
          <circle cx="288" cy="32" r="7" className={cn('fill-white stroke-ink-600', styles.ring)} strokeWidth="2" />
          <text x="276" y="18" fontSize="12" className={styles.goal}>
            800
          </text>
          <circle r="5" className={cn('fill-ink-600', styles.runner)} />
        </svg>
      </div>
      <figcaption className="mt-2 text-sm text-gray-600">
        This is how the real test routes you. Practice on the hard branch.
      </figcaption>
    </figure>
  );
}
