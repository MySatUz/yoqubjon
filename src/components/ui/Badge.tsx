import React from 'react';
import { CircleCheck, CircleX, TriangleAlert } from 'lucide-react';
import { cn } from '@/components/ui/cn';

export type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

const tones: Record<Tone, string> = {
  neutral: 'bg-gray-100 text-gray-700',
  accent: 'bg-ink-50 text-ink-700',
  success: 'bg-green-50 text-green-800',
  warning: 'bg-amber-50 text-amber-800',
  danger: 'bg-red-50 text-red-700',
};

/*
 * The neutral badge is gray-100, which is also the app shell's canvas: set
 * straight on the canvas (a page header's meta line) it vanished into the
 * ground. `onCanvas` steps it to gray-200. Still flat: a badge never has a
 * border, so it can never be mistaken for a button or a filter chip.
 */
const neutralOnCanvas = 'bg-gray-200 text-gray-800';

/** The one icon per status, so "correct" or "waiting" is never colour alone. */
const statusIcons: Partial<Record<Tone, React.ReactNode>> = {
  success: <CircleCheck />,
  warning: <TriangleAlert />,
  danger: <CircleX />,
};

export function badgeClass({
  tone = 'neutral',
  onCanvas = false,
  className,
}: { tone?: Tone; onCanvas?: boolean; className?: string } = {}) {
  return cn(
    'inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-1.5 text-xs font-medium [&_svg]:h-3.5 [&_svg]:w-3.5',
    tone === 'neutral' && onCanvas ? neutralOnCanvas : tones[tone],
    className,
  );
}

/**
 * Status badge: flat, borderless, square-cornered - not pressable, so it never
 * shares a shape with a button (bordered) or a filter chip (a pill). Sentence
 * case, no letter-spacing. Tone is meaning, not decoration: success =
 * done/correct/active, warning = pending/expiring, danger = failed/wrong,
 * accent = selected/current, neutral = facts.
 * A status (success, warning, danger) leads with its icon unless the children
 * already bring one (any element child counts as the icon) or `icon={false}`.
 * Pass `onCanvas` when a neutral badge sits on the gray-100 canvas rather than
 * in a card.
 */
export function Badge({
  tone = 'neutral',
  onCanvas,
  icon = true,
  className,
  children,
  title,
}: {
  tone?: Tone;
  onCanvas?: boolean;
  icon?: boolean | React.ReactNode;
  className?: string;
  children: React.ReactNode;
  title?: string;
}) {
  const hasOwnIcon = React.Children.toArray(children).some((child) => React.isValidElement(child));
  const leading = icon === true ? (hasOwnIcon ? null : statusIcons[tone]) : icon || null;

  return (
    <span className={badgeClass({ tone, onCanvas, className })} title={title}>
      {leading}
      {children}
    </span>
  );
}
