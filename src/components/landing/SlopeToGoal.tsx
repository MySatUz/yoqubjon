import { cn } from '@/components/ui/cn';

/**
 * A small line rising to 800 over a baseline that runs the full width of its
 * box, on the sign-in card. Still: AGENTS.md keeps motion to the landing.
 *
 * The SVG has no viewBox, so its units are pixels: the baseline is 100% wide
 * and the rise keeps the same angle at any width. The "800" is HTML text at
 * text-xs: inside a scaled SVG it rendered at 9px, below the type scale.
 */
export default function SlopeToGoal({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn('relative mb-3 h-10', className)}>
      <svg className="absolute inset-0 block h-full w-full overflow-visible">
        <line x1="0" y1="38" x2="100%" y2="38" className="stroke-gray-200" />
        <line x1="1" y1="38" x2="114" y2="5" className="stroke-ink-600" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="114" cy="5" r="3" className="fill-ink-600" />
      </svg>
      <span className="absolute left-31 top-0 text-xs font-medium tabular-nums text-gray-600">800</span>
    </div>
  );
}
