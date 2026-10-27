import type { ReactNode } from 'react';
import Link from 'next/link';
import BrandMark from '@/components/layout/BrandMark';
import { focusRingClass } from '@/components/ui/Button';
import { BackLink, PageHeader } from '@/components/ui/Page';
import { formatDate } from '@/lib/formatDate';

/**
 * The frame of the public text pages, Privacy and Terms: the mark at the top
 * as on the auth pages, a way back home, and one reading column. White like
 * the landing rather than the app's gray-100 canvas: these pages are read, not
 * worked in. `updated` is the day the text last changed, printed by formatDate.
 */
export default function LegalPage({
  title,
  updated,
  intro,
  children,
}: {
  title: string;
  updated: Date;
  intro: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white">
      <header className="mx-auto flex h-14 max-w-6xl items-center px-4 sm:px-6 lg:px-8">
        <Link href="/" className={`flex items-center gap-2.5 rounded-lg ${focusRingClass}`} aria-label="MYSATuz home">
          <BrandMark size="sm" />
          <span className="text-base font-semibold tracking-tight text-gray-900">MYSATuz</span>
        </Link>
      </header>
      <main className="mx-auto w-full max-w-2xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
        <PageHeader
          back={<BackLink href="/">Back to home</BackLink>}
          title={title}
          description={`Last updated ${formatDate(updated)}`}
        />
        <div className="mt-6 text-base text-pretty text-gray-700">{intro}</div>
        <div className="mt-10 space-y-8">{children}</div>
      </main>
    </div>
  );
}

/** One numbered part of a legal page: a heading and its paragraphs or lists. */
export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-semibold text-balance text-gray-900">{title}</h2>
      <div className="mt-2 space-y-3 text-sm text-pretty text-gray-700 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}
