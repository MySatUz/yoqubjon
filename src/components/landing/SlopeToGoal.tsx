'use client';

import { cn } from '@/components/ui/cn';
import { useInViewOnce } from '@/lib/landing/hooks';
import styles from './landing.module.css';

/**
 * A small line rising to 800 over a baseline that runs the full width of its
 * box. Still by default: the sign-in card shows it, and AGENTS.md keeps motion
 * to the landing. With `animate` — the landing's closing section — the line
 * draws itself once, the first time it is seen, and under reduced motion it is
 * simply there.
 *
 * The SVG has no viewBox, so its units are pixels: the baseline is 100% wide
 * and the rise keeps the same angle at any width. The "800" is HTML text at
 * text-xs: inside a scaled SVG it rendered at 9px, below the type scale.
 */
export default function SlopeToGoal({ animate = false, className }: { animate?: boolean; className?: string }) {
  const [ref, inView] = useInViewOnce<HTMLDivElement>(0.6);

  return (
    <div ref={ref} aria-hidden="true" className={cn('relative mb-3 h-10', animate && inView && styles.inView, className)}>
      <svg className="absolute inset-0 block h-full w-full overflow-visible">
        <line x1="0" y1="38" x2="100%" y2="38" className="stroke-mist-200" />
        <line
          x1="1"
          y1="38"
          x2="114"
          y2="5"
          pathLength={1}
          className={cn('stroke-board-600', animate && styles.drawOnView)}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle cx="114" cy="5" r="3" className={cn('fill-board-600', animate && styles.dotOnView)} />
      </svg>
      <span className="absolute left-31 top-0 text-xs font-medium tabular-nums text-mist-600">800</span>
    </div>
  );
}
