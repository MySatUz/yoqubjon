import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/components/ui/cn';
import { focusRingClass } from '@/components/ui/Button';

/**
 * Initial-letter avatar. Always round, always neutral. Hidden from screen
 * readers by default: it sits beside the name it is the first letter of, and
 * a lone "A" read before "Aziza" is noise. Pass `aria-hidden={false}` only
 * where the avatar stands alone and has a label of its own.
 */
export function Avatar({
  name,
  size = 'md',
  className,
  'aria-hidden': ariaHidden = true,
}: {
  name?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  'aria-hidden'?: boolean;
}) {
  const initial = name?.trim()?.[0] || 'U';
  const sizeClass = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-12 w-12 text-base' }[size];

  return (
    <span
      aria-hidden={ariaHidden || undefined}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-gray-200 font-medium uppercase text-gray-700',
        sizeClass,
        className,
      )}
    >
      {initial}
    </span>
  );
}

/**
 * The circle an entry icon sits in — on a card that is a link, in a short list
 * of places, in an empty state: a ink-600 icon on ink-50, the calm version
 * of the sidebar's active socket. Wrap the bare lucide icon: `<span
 * className={iconCircleClass}><Users /></span>`; the svg is sized here. Not for
 * icons in buttons, status icons or rows of long lists — see AGENTS.md, "Icons".
 */
export const iconCircleClass =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-50 text-ink-600 [&_svg]:h-4.5 [&_svg]:w-4.5';

/**
 * Segmented control / tabs, for two to four options on one line (more is a
 * row of chips, below). Wrap the items in `segmentedClass`, give each item
 * `segmentClass(active)` — works on <button> and <Link> alike.
 * On a coarse pointer the items step up to h-9, so the control is 40px tall,
 * level with a `sm` button there (Button.tsx) and big enough for a finger.
 *
 * The track's edge is gray-300, the edge of every other control (inputs,
 * secondary buttons, chips): with gray-200 the track vanished on the
 * gray-100 canvas and the idle options read as two words of grey text.
 */
export const segmentedClass = 'inline-flex rounded-lg bg-gray-100 p-0.5 ring-1 ring-inset ring-gray-400';

export function segmentClass(active: boolean, className?: string) {
  return cn(
    'inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 text-sm font-medium transition-colors pointer-coarse:h-9',
    focusRingClass,
    active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
    className,
  );
}

/**
 * Filter and choice chips: a wrapping row of options that each look like a
 * button. Use them instead of a segmented control when there are more than
 * four options (courses, statuses): a segmented control that wraps onto a
 * second line reads as two lines of grey text. A chip is a pill with a
 * gray-400 edge, so it is never mistaken for a status badge (flat, square
 * corners); the chosen one turns board and leads with a check -
 * `<ChipCheck active={…} />` as its first child - so the choice is not told by
 * colour alone. Wrap them in `chipGroupClass`; each item gets
 * `chipClass(active)` and works on <button> and <Link> alike, with an optional
 * count in `chipCountClass(active)`.
 */
export const chipGroupClass = 'flex flex-wrap gap-2';

export function chipClass(active: boolean, className?: string) {
  return cn(
    'inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-sm font-medium transition-colors pointer-coarse:h-10',
    focusRingClass,
    active
      ? 'border-ink-600 bg-ink-50 text-ink-800'
      : 'border-gray-400 bg-white text-gray-700 hover:border-gray-500 hover:bg-gray-50 hover:text-gray-900',
    className,
  );
}

export function chipCountClass(active: boolean) {
  return cn('text-xs tabular-nums', active ? 'text-ink-700' : 'text-gray-500');
}

/** The check a chosen chip leads with; renders nothing for the others. */
export function ChipCheck({ active }: { active: boolean }) {
  return active ? <Check aria-hidden className="-ml-0.5 h-3.5 w-3.5 shrink-0" /> : null;
}

/** Label → value pair inside a card (key facts, settings summaries). */
export function KeyValue({
  label,
  value,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium text-gray-900">{value}</dd>
    </div>
  );
}

/** Thin progress bar. `value` is 0–100. */
export function Progress({
  value,
  tone = 'accent',
  className,
}: {
  value: number;
  tone?: 'accent' | 'success' | 'danger';
  className?: string;
}) {
  const bar = { accent: 'bg-ink-600', success: 'bg-green-700', danger: 'bg-red-600' }[tone];
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-gray-100', className)}>
      <div className={cn('h-full rounded-full', bar)} style={{ width: `${clamped}%` }} />
    </div>
  );
}
