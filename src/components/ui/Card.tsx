import React from 'react';
import { cn } from '@/components/ui/cn';

/** The one card surface: white, gray-200 border, rounded-2xl, flat. */
export const cardClass = 'rounded-2xl border border-gray-200 bg-white';

/** A tinted block nested inside a card (key/value tiles, previews, code). */
export const insetClass = 'rounded-xl bg-gray-50';

export function Card({
  as: Tag = 'div',
  padded = false,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement> & { as?: 'div' | 'section' | 'article' | 'li'; padded?: boolean }) {
  return (
    <Tag className={cn(cardClass, padded && 'p-5', className)} {...props}>
      {children}
    </Tag>
  );
}

/**
 * Title row of a card: title + optional description on the left, actions on
 * the right. The description stops at max-w-2xl, like a page header's: on a
 * full-width card one line ran the width of the screen.
 */
export function CardHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-5 py-4', className)}>
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {description && <p className="mt-0.5 max-w-2xl text-sm text-gray-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('p-5', className)}>{children}</div>;
}

/** Footer row for card actions (save, cancel). */
export function CardFooter({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 px-5 py-3', className)}>
      {children}
    </div>
  );
}
