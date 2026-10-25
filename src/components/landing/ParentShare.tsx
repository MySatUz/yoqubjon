'use client';

import { useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import { buttonClass } from '@/components/ui/Button';
import { cardClass } from '@/components/ui/Card';
import { PaymentStatusBadge } from '@/components/ui/PaymentStatusBadge';
import { cn } from '@/components/ui/cn';
import { useInViewOnce, useReducedMotion } from '@/lib/landing/hooks';
import { SITE_URL } from '@/lib/landing/warmup';
import { PREMIUM_PLAN } from '@/lib/plans';

/*
 * A payment request the way the student's subscription page shows one, with
 * its badge going from Pending to Approved once — the same badge component,
 * the same amber and lime. Beside it, the one button that hands this
 * section to whoever pays.
 */

// While sales are paused the message must not tell a parent how to arrange
// something that cannot be bought; it says what is true either way.
const PARENT_TEXT_OPEN = `MYSATuz: Digital SAT Math practice. Free to start; ${PREMIUM_PLAN.name} is arranged in your account and paid by card transfer with a receipt. There’s no card form on the site.`;
const PARENT_TEXT_PAUSED = 'MYSATuz: Digital SAT Math practice. The free tests need no payment, and there’s no card form on the site.';

function parentLink(salesOpen: boolean) {
  const text = salesOpen ? PARENT_TEXT_OPEN : PARENT_TEXT_PAUSED;
  return `https://t.me/share/url?url=${encodeURIComponent(`${SITE_URL}/#parents`)}&text=${encodeURIComponent(text)}`;
}

/** `salesOpen`: whether Premium is on sale (the landing reads it on the server). */
export default function ParentShare({ salesOpen }: { salesOpen: boolean }) {
  const reduce = useReducedMotion();
  const [ref, inView] = useInViewOnce<HTMLDivElement>(0.4);
  const [approved, setApproved] = useState(false);

  useEffect(() => {
    if (!inView) return;
    const timer = window.setTimeout(() => setApproved(true), reduce ? 0 : 1200);
    return () => window.clearTimeout(timer);
  }, [inView, reduce]);

  return (
    <div>
      {/* mist-600: this label sits straight on the mist-50 band. */}
      <p className="mb-2 text-xs font-medium text-mist-600">Example</p>
      <div ref={ref} className={cn(cardClass, 'grid gap-3 p-5')}>
        <div className="flex items-center justify-between gap-3">
          <span className="font-semibold text-mist-900">Payment request</span>
          {/* Both badges sit in one cell and cross-fade, so nothing shifts. */}
          <span className="inline-grid">
            <span
              aria-hidden={approved}
              className={cn('col-start-1 row-start-1 transition-opacity duration-200', approved && 'opacity-0')}
            >
              <PaymentStatusBadge status="PENDING" />
            </span>
            <span
              aria-hidden={!approved}
              className={cn('col-start-1 row-start-1 transition-opacity duration-200', approved ? 'opacity-100' : 'opacity-0')}
            >
              <PaymentStatusBadge status="APPROVED" />
            </span>
          </span>
        </div>
        <div className="flex justify-between text-sm text-mist-600">
          <span>Plan</span>
          <span>{PREMIUM_PLAN.name}</span>
        </div>
        <div className="flex justify-between text-sm text-mist-600">
          <span>Receipt</span>
          <span>transfer.jpg</span>
        </div>
        <a
          href={parentLink(salesOpen)}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClass({ variant: 'secondary', size: 'lg', block: true, className: 'mt-1' })}
        >
          <Send className="h-4 w-4" aria-hidden="true" />
          Send this to a parent
        </a>
      </div>
    </div>
  );
}
