import React from 'react';
import { cn } from '@/components/ui/cn';

/**
 * A row of key numbers drawn as ONE card split by hairlines, instead of a grid
 * of separate tiles each with its own coloured icon square. The hairlines are
 * the 1px gaps showing the group's gray background between white cells; on
 * phones it wraps to two columns, and an odd last cell spans both.
 */
export function StatGroup({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-gray-200 bg-gray-200',
        'max-sm:[&>*:last-child:nth-child(odd)]:col-span-2 sm:auto-cols-fr sm:grid-flow-col sm:grid-cols-none',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  icon,
  tone = 'default',
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  /** A lucide icon shown beside the label, sized here; it takes the label's gray-500. */
  icon?: React.ReactNode;
  tone?: 'default' | 'accent' | 'success' | 'danger';
}) {
  // green-800 for the number, as in the success Badge: the darker step reads
  // as a number, not as a status chip. ink-600 and red-600 pass AA too.
  const valueTone = {
    default: 'text-gray-900',
    accent: 'text-ink-600',
    success: 'text-green-800',
    danger: 'text-red-600',
  }[tone];

  return (
    <div className="min-w-0 bg-white px-4 py-3.5 sm:px-5">
      <p className="flex items-center gap-1.5 text-xs font-medium text-gray-500 [&_svg]:h-3.5 [&_svg]:w-3.5">
        {icon}
        <span className="truncate">{label}</span>
      </p>
      <p className={cn('mt-1 truncate text-xl font-semibold tabular-nums tracking-tight sm:text-2xl', valueTone)}>{value}</p>
      {hint && <p className="mt-0.5 truncate text-xs text-gray-500">{hint}</p>}
    </div>
  );
}
