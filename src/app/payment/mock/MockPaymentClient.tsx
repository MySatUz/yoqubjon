'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import { PREMIUM_PLAN, PREMIUM_PLAN_ID } from '@/lib/plans';
import BrandMark from '@/components/layout/BrandMark';
import { Button, buttonClass } from '@/components/ui/Button';
import { cardClass } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Feedback';
import { KeyValue } from '@/components/ui/Misc';
import { cn } from '@/components/ui/cn';

export default function MockPaymentClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success'>('idle');
  // Shown in the card, not in alert(): a browser dialog is in no part of the
  // design system and blocks the page until it is dismissed.
  const [error, setError] = useState<string | null>(null);

  const handlePayment = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/webhooks/mock-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: PREMIUM_PLAN_ID }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setStatus('success');
        setTimeout(() => {
          router.push('/dashboard?payment=success');
        }, 2000);
      } else {
        setError(data.error || 'Payment simulation failed');
      }
    } catch {
      setError('Payment simulation failed');
    } finally {
      setLoading(false);
    }
  };

  // Outside the app shell, so this page paints the canvas itself: mist-100,
  // like the auth pages and the root error page, not the body's mist-50.
  if (status === 'success') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-mist-100 px-4 py-10">
        <div role="status" className={cn(cardClass, 'w-full max-w-sm p-6 text-center')}>
          {/* A status icon: the status colour, no circle (AGENTS.md, Icons). */}
          <CheckCircle2 className="mx-auto h-6 w-6 text-lime-700" aria-hidden />
          <h1 className="mt-3 text-lg font-semibold text-mist-900">Payment successful</h1>
          <p className="mt-1 text-sm text-mist-500">
            {PREMIUM_PLAN.name} is active. Taking you to Practice…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-mist-100 px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex items-center justify-center gap-2.5">
          <BrandMark />
          <span className="text-lg font-semibold tracking-tight text-mist-900">MYSATuz Pay</span>
        </div>

        <div className={cardClass}>
          {/* The plan's own name and line (src/lib/plans.ts), as the landing
              and the subscription page show them. No price: the amount is
              shown only in the manual payment details while sales are open
              (the owner's rule), and this test page charges nothing. */}
          <div className="border-b border-mist-100 px-5 py-4">
            <h1 className="text-base font-semibold text-mist-900">{PREMIUM_PLAN.name}</h1>
            <p className="mt-0.5 text-sm text-mist-500">{PREMIUM_PLAN.summary}</p>
          </div>

          <dl className="px-5 py-4">
            <KeyValue label="Card holder" value="MOCK TEST USER" />
          </dl>

          <div className="space-y-2 border-t border-mist-100 px-5 py-4">
            {error && <Alert tone="danger">{error}</Alert>}

            <Button size="lg" block onClick={handlePayment} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden />
                  Processing…
                </>
              ) : (
                'Confirm test payment'
              )}
            </Button>

            {/* Secondary, not ghost: outside a toolbar a bare grey label did
                not read as a button. A link, not router.back(): nothing in
                the app links here, so this page is opened by its URL, often
                in a fresh tab, where "back" went nowhere. */}
            <Link href="/dashboard/subscription" className={buttonClass({ variant: 'secondary', block: true })}>
              <ArrowLeft className="h-4 w-4" />
              Cancel and return
            </Link>
          </div>

          <p className="border-t border-mist-100 px-5 py-3 text-center text-xs text-mist-500">
            Development simulation: a mock transaction for local testing only.
          </p>
        </div>
      </div>
    </div>
  );
}
