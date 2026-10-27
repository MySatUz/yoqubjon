'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { buttonClass, linkClass } from '@/components/ui/Button';
import { cardClass } from '@/components/ui/Card';
import { cn } from '@/components/ui/cn';
import { TELEGRAM_URL } from '@/lib/landing/warmup';
import { formatOpensIn, scheduleStatus, type LandingOlympiad } from '@/lib/landing/olympiadSchedule';

/*
 * The real schedule, read on the server (see nextOlympiad.ts) and cached with
 * the page. The countdown is worked out here, once a minute, so a page served
 * from the cache still counts from the visitor's own clock — and an olympiad
 * that opens or closes while the page is open changes state in place.
 */

export default function OlympiadDate({ olympiad, checkedAt }: { olympiad: LandingOlympiad; checkedAt: number }) {
  // Starts from the server's clock so the first paint matches the HTML.
  const [now, setNow] = useState(checkedAt);

  useEffect(() => {
    if (olympiad.state !== 'scheduled') return;
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const every = window.setInterval(tick, 60_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(every);
    };
  }, [olympiad.state]);

  const status = olympiad.state === 'scheduled' ? scheduleStatus(olympiad.startsAt, olympiad.endsAt, now) : null;

  // Nothing scheduled, the window closed while this page was cached or open,
  // or the schedule could not be read. Only a successful empty read may claim
  // there is nothing — a later olympiad can sit behind one that just closed —
  // and none invents a date. One quiet line, not a card: the section should
  // not open on a wide box announcing an absence.
  if (olympiad.state !== 'scheduled' || status === 'finished') {
    const lead =
      olympiad.state === 'none'
        ? 'No olympiad is scheduled right now.'
        : olympiad.state === 'scheduled'
          ? 'This olympiad has closed.'
          : 'Olympiad dates are announced in Telegram.';
    return (
      <p className="mt-4 text-sm text-gray-600">
        {lead}{' '}
        <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
          Ask when the next one opens
        </a>
        .
      </p>
    );
  }

  let title: string;
  let detail: ReactNode;
  let action: ReactNode;

  if (status === 'upcoming') {
    title = `Next olympiad · ${olympiad.opensLabel}, Tashkent time`;
    detail = (
      <>
        Opens in <span className="tabular-nums">{formatOpensIn(Date.parse(olympiad.startsAt) - now)}</span>. Entry
        details are on the olympiad page.
      </>
    );
    action = (
      <Link href={`/olympiad/${olympiad.id}`} className={buttonClass({ variant: 'secondary' })}>
        Open olympiad page
      </Link>
    );
  } else {
    title = `Olympiad open now · closes ${olympiad.closesLabel}, Tashkent time`;
    detail = 'Your best attempt inside the window is the one that counts.';
    action = (
      <Link href={`/olympiad/${olympiad.id}`} className={buttonClass()}>
        Open olympiad
      </Link>
    );
  }

  return (
    <div className={cn(cardClass, 'mt-6 flex flex-wrap items-center justify-between gap-3 px-5 py-4')}>
      <div className="min-w-0">
        <p className="font-semibold text-gray-900">{title}</p>
        <p className="mt-0.5 text-sm text-gray-600">{detail}</p>
      </div>
      {action}
    </div>
  );
}
