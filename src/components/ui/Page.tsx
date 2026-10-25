import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/components/ui/cn';

/**
 * Every page inside the app shell sits in this container: one width, one
 * gutter, one top/bottom rhythm. Sections inside are separated by `space-y-6`.
 */
export const pageClass = 'mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8';

export function Page({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn(pageClass, className)}>{children}</div>;
}

/**
 * Small "← Back to …" link above a page title. mist-600, not 500: it sits on
 * the mist-100 canvas, where mist-500 is 4.35:1 and misses AA. The padding
 * pulled back by negative margins gives it a ~40px tap target without moving
 * the text.
 */
export const backLinkClass =
  '-mx-2 -my-2.5 inline-flex items-center gap-1.5 rounded-lg px-2 py-2.5 text-sm font-medium text-mist-600 transition-colors hover:text-mist-900 focus-visible:outline-2 focus-visible:outline-board-600';

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={backLinkClass}
    >
      <ArrowLeft className="h-4 w-4" />
      {children}
    </Link>
  );
}

/**
 * Page title row. No eyebrow captions and no dark hero banners: a title, one
 * line of description, actions on the right, level with the title.
 * Descriptions are mist-600: the header sits on the mist-100 canvas, where
 * mist-500 misses AA. The title may break inside a long word: test and
 * olympiad names are typed by admins, and one unbroken name would otherwise
 * push a phone page sideways.
 */
export function PageHeader({
  title,
  description,
  actions,
  back,
  meta,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  /** A <BackLink> rendered above the title. */
  back?: React.ReactNode;
  /** Badges or facts on the line under the title. */
  meta?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('space-y-3', className)}>
      {back}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="break-words text-xl font-semibold tracking-tight text-mist-900 sm:text-2xl">{title}</h1>
          {description && <p className="mt-1 max-w-2xl text-sm text-mist-600">{description}</p>}
          {meta && <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

/** Heading for a group of content directly on the canvas (not inside a card). */
export function SectionHeading({
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
    <div className={cn('flex flex-wrap items-end justify-between gap-3', className)}>
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-mist-900">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-mist-600">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
