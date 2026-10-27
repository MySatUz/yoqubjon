import React from 'react';
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react';
import { cn } from '@/components/ui/cn';
import { iconCircleClass } from '@/components/ui/Misc';

type AlertTone = 'info' | 'success' | 'warning' | 'danger';

const alertTones: Record<AlertTone, { box: string; icon: React.ReactNode }> = {
  info: { box: 'border-gray-200 bg-gray-50 text-gray-700', icon: <Info className="text-gray-500" /> },
  success: { box: 'border-green-200 bg-green-50 text-green-900', icon: <CheckCircle2 className="text-green-700" /> },
  warning: { box: 'border-amber-200 bg-amber-50 text-amber-800', icon: <TriangleAlert className="text-amber-600" /> },
  danger: { box: 'border-red-200 bg-red-50 text-red-800', icon: <AlertCircle className="text-red-600" /> },
};

/** Inline notice: form errors, saved confirmations, pending states. */
export function Alert({
  tone = 'info',
  title,
  className,
  children,
  action,
}: {
  tone?: AlertTone;
  title?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  const { box, icon } = alertTones[tone];

  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm', box, className)}>
      <span className="mt-0.5 shrink-0 [&_svg]:h-4 [&_svg]:w-4">{icon}</span>
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        {/* Full strength, no opacity: a faded red-800 or amber-800 is a tint
            in no colour family. The title's weight sets it apart. */}
        {children && <div className={title ? 'mt-0.5' : undefined}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** Nothing-here-yet block: one icon, one line, an optional action. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center', className)}>
      {icon && (
        <span className={cn(iconCircleClass, 'mb-3')}>{icon}</span>
      )}
      <p className="text-sm font-medium text-gray-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-gray-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Grey placeholder block for loading.tsx skeletons. Size it with className. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-gray-200/70', className)} />;
}
