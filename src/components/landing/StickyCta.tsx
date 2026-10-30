'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { buttonClass } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { formatDuration } from '@/lib/olympiad';
import { useWarmupEcho } from '@/lib/landing/hooks';
import { FREE_OFFER_CTA, countCorrect, freeTestsPhrase } from '@/lib/landing/warmup';

/*
 * The phone's bottom bar. It appears once the warm-up card has scrolled up
 * out of view and steps aside at the footer, so it never covers the contacts
 * and links there. Mid warm-up it offers to go back instead of to sign up.
 *
 * It never shows a score: three questions do not make one, and the empty
 * "— — — / 800" it used to carry read as a block that had failed to load.
 * After the warm-up it repeats what was measured; before, what is free.
 */

const CARD_ID = 'warmup-card';
const TITLE_ID = 'warmup-title';
const QUIET_ZONES = ['site-footer'];

/** `freeTests`: how many tests are free (countFreeTests), or null to leave the number out. */
export default function StickyCta({ freeTests }: { freeTests: number | null }) {
  const { live, stored } = useWarmupEcho();
  const [cardGone, setCardGone] = useState(false);
  const [inQuietZone, setInQuietZone] = useState(false);

  useEffect(() => {
    const card = document.getElementById(CARD_ID);
    const observers: IntersectionObserver[] = [];

    if (card) {
      const cardObserver = new IntersectionObserver(
        ([entry]) => setCardGone(entry.intersectionRatio < 0.3 && entry.boundingClientRect.top < 0),
        { threshold: [0, 0.3] },
      );
      cardObserver.observe(card);
      observers.push(cardObserver);
    }

    const visible = new Set<Element>();
    const zoneObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target);
          else visible.delete(entry.target);
        }
        setInQuietZone(visible.size > 0);
      },
      { threshold: 0.15 },
    );
    for (const id of QUIET_ZONES) {
      const zone = document.getElementById(id);
      if (zone) zoneObserver.observe(zone);
    }
    observers.push(zoneObserver);

    return () => observers.forEach((observer) => observer.disconnect());
  }, []);

  const midWarmup = live.answers.length > 0 && !live.done;
  const finished = live.done ? live : stored?.done ? stored : null;
  const show = cardGone && !inQuietZone;

  const resume = () => {
    const card = document.getElementById(CARD_ID);
    if (!card) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    card.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
    window.setTimeout(() => document.getElementById(TITLE_ID)?.focus({ preventScroll: true }), 400);
  };

  return (
    <div
      aria-hidden={!show}
      inert={!show}
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-gray-200 bg-white lg:hidden',
        'px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] shadow-[0_-12px_30px_rgba(15,23,42,0.08)]',
        'transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
        show ? 'translate-y-0' : 'translate-y-[110%]',
      )}
    >
      {midWarmup ? (
        <>
          <span className="text-sm font-medium text-gray-900">
            Paused · Question {live.index + 1} of 3
          </span>
          <button type="button" onClick={resume} className={buttonClass({ variant: 'secondary', size: 'lg' })}>
            Resume
          </button>
        </>
      ) : (
        <>
          <span className="min-w-0 text-sm font-medium text-gray-900">
            {finished ? (
              <span className="tabular-nums">
                Warm-up: {countCorrect(finished.answers)} of 3 in {formatDuration(finished.totalMs / 1000)}
              </span>
            ) : (
              `${freeTests ? `${freeTestsPhrase(freeTests, true)} ` : ''}No payment details.`
            )}
          </span>
          <Link href="/register?from=sticky" className={buttonClass({ size: 'lg' })}>
            {FREE_OFFER_CTA}
          </Link>
        </>
      )}
    </div>
  );
}
