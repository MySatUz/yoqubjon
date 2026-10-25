'use client';

import React, { useEffect, useRef, useState, useTransition } from 'react';
import { ArrowLeft, Check, Loader2, Receipt } from 'lucide-react';
import { formatDate, formatDateTime } from '@/lib/formatDate';
import { TELEGRAM_URL } from '@/lib/landing/warmup';
import { FREE_PLAN, PREMIUM_PLAN, type PlanSummary } from '@/lib/plans';
import { Card, CardHeader, insetClass } from '@/components/ui/Card';
import { Button, linkClass } from '@/components/ui/Button';
import { Badge, type Tone } from '@/components/ui/Badge';
import { useConfirm } from '@/components/ui/Dialog';
import { PaymentStatusBadge } from '@/components/ui/PaymentStatusBadge';
import { Alert, EmptyState } from '@/components/ui/Feedback';
import { KeyValue } from '@/components/ui/Misc';
import { List, RowText, listRowClass } from '@/components/ui/List';
import { SectionHeading, backLinkClass } from '@/components/ui/Page';
import { cn } from '@/components/ui/cn';
import { ManualPaymentForm } from './ManualPaymentForm';
import { cancelActiveSubscription } from './actions';

/*
 * No amounts on requests or payments: a price is shown only in the payment
 * details while sales are open (the owner's rule), so none is sent for them.
 */
type ManualRequest = {
  id: string;
  status: string;
  receiptFileName: string | null;
  adminNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

type SubscriptionCheckoutProps = {
  userName: string;
  userEmail: string;
  isPremium: boolean;
  /** False while an admin has paused sales: nothing on this page sells. */
  salesOpen: boolean;
  requests: ManualRequest[];
  payments: {
    id: string;
    provider: string;
    status: string;
    createdAt: string;
  }[];
  subscription: {
    id: string;
    planId: string;
    isActive: boolean;
    expiresAt: string;
    provider: string;
    providerStatus: string | null;
    createdAt: string;
    /** Whole days until it ends, worked out on the server. */
    daysLeft: number;
  } | null;
  /** The card to pay to and the price; null while sales are paused, so neither is sent at all. */
  transfer: {
    cardHolder: string;
    cardNumber: string;
    cardType: string;
    amount: number;
    currency: string;
    /** The amount as formatManualPaymentAmount spells it. */
    amountLabel: string;
  } | null;
};

/** Display name for a Subscription/Payment `provider`; anything unknown prints as stored. */
function providerLabel(provider: string) {
  if (provider === 'MANUAL_TRANSFER' || provider === 'MANUAL') return 'Card transfer';
  if (provider === 'MOCK') return 'Test payment';
  return provider;
}

/** `COMPLETED` → `Completed`, for the stored upper-case statuses. */
function sentenceCase(value: string) {
  const lower = value.replace(/_/g, ' ').toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * Payment.status → badge tone. Every row written today is `COMPLETED`; the
 * schema also allows PENDING, SUCCESS and FAILED, so those keep their meaning.
 */
function paymentTone(status: string): Tone {
  if (status === 'COMPLETED' || status === 'SUCCESS') return 'success';
  if (status === 'PENDING') return 'warning';
  if (status === 'FAILED') return 'danger';
  return 'neutral';
}

/**
 * A plan's lines, from lib/plans.ts — the list the landing shows too, so the
 * two can no longer promise different things. Every line is included; the
 * old crossed-out "Full solution review" was never actually withheld.
 */
function PlanFeatures({ plan }: { plan: PlanSummary }) {
  return (
    <ul className="mt-4 flex-1 space-y-2 text-sm">
      {plan.features.map((feature) => (
        <li key={feature} className="flex gap-2 text-mist-700">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-board-600" aria-hidden />
          {feature}
        </li>
      ))}
    </ul>
  );
}

const CANCEL_ERROR = 'The subscription could not be cancelled. Try again in a minute.';

/** For the current-plan header: when to renew, without counting from a date. */
function daysLeftLabel(days: number) {
  if (days <= 0) return 'Ends today';
  return days === 1 ? '1 day left' : `${days} days left`;
}

export function SubscriptionCheckout(props: SubscriptionCheckoutProps) {
  const [mode, setMode] = useState<'plans' | 'manual'>('plans');
  const [isCanceling, startCancelTransition] = useTransition();
  const [cancelError, setCancelError] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();
  const latestRequest = props.requests[0];

  // The button that switches views goes away with its view, which would drop
  // keyboard focus on the page body (and leave the screen scrolled to where
  // the Premium card was). Focus moves to the top of the transfer step, and
  // back to the button that opened it.
  const backRef = useRef<HTMLButtonElement>(null);
  const payRef = useRef<HTMLButtonElement>(null);
  const detailsRef = useRef<HTMLButtonElement>(null);
  const openedFrom = useRef<'pay' | 'details' | null>(null);
  useEffect(() => {
    if (mode === 'manual') {
      backRef.current?.focus();
    } else if (openedFrom.current) {
      (openedFrom.current === 'pay' ? payRef : detailsRef).current?.focus();
      openedFrom.current = null;
    }
  }, [mode]);

  const openDetails = (from: 'pay' | 'details') => {
    openedFrom.current = from;
    setMode('manual');
  };

  const cancelSubscription = async () => {
    // "Keep" rather than the default "Cancel": next to "Cancel subscription"
    // a plain "Cancel" reads as the same answer.
    const ok = await confirm({
      title: `Cancel ${PREMIUM_PLAN.name}?`,
      description: 'Access to every Premium test stops right away, even with days left on it.',
      confirmLabel: 'Cancel subscription',
      cancelLabel: `Keep ${PREMIUM_PLAN.name}`,
      tone: 'danger',
    });
    if (!ok) return;

    setCancelError(null);
    startCancelTransition(async () => {
      // A thrown action (the database unreachable) would otherwise reach the
      // error boundary and replace the whole page for a failed button.
      try {
        const result = await cancelActiveSubscription();
        if (!result.success) {
          setCancelError(result.error || CANCEL_ERROR);
          return;
        }
      } catch {
        setCancelError(CANCEL_ERROR);
      }
      // The action calls refresh() itself, so the fresh payload arrives with it.
    });
  };

  // A pause that lands while the details are open (router.refresh) drops
  // back to the plans, which say why.
  if (mode === 'manual' && props.salesOpen && props.transfer) {
    return (
      <div className="space-y-4">
        <button ref={backRef} type="button" onClick={() => setMode('plans')} className={backLinkClass}>
          <ArrowLeft className="h-4 w-4" />
          Back to plans
        </button>

        <ManualPaymentForm {...props} transfer={props.transfer} />
      </div>
    );
  }

  return (
    <>
      {dialog}
      <Card>
        <CardHeader
          title="Current plan"
          description={
            props.subscription
              ? `${daysLeftLabel(props.subscription.daysLeft)} · ${providerLabel(props.subscription.provider)}`
              : 'No active paid subscription yet.'
          }
          actions={
            // Outlined, red only on hover: a ghost red label read as text,
            // and a solid red button is too loud for the page's header.
            props.isPremium ? (
              <Button variant="danger-secondary" size="sm" onClick={cancelSubscription} disabled={isCanceling}>
                {isCanceling && <Loader2 className="h-4 w-4 animate-spin" />}
                Cancel subscription
              </Button>
            ) : null
          }
        />

        {/* Only facts that exist: a free account has no start or end date, so
            it no longer shows two cells of "—". */}
        <dl className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
          <KeyValue label="Plan" value={props.isPremium ? PREMIUM_PLAN.name : FREE_PLAN.name} />
          <KeyValue
            label="Status"
            value={props.isPremium ? <Badge tone="success">Active</Badge> : <Badge>Free</Badge>}
          />
          {props.subscription && (
            <>
              <KeyValue label="Started" value={formatDate(props.subscription.createdAt)} />
              <KeyValue label="Ends" value={formatDate(props.subscription.expiresAt)} />
            </>
          )}
        </dl>

        {cancelError && (
          <div className="px-5 pb-5">
            <Alert tone="danger">{cancelError}</Alert>
          </div>
        )}

        {latestRequest && !props.isPremium && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-mist-100 px-5 py-3">
            {/* The date, not the amount: a price is shown only in the
                payment details while sales are open (the owner's rule). */}
            <p className="min-w-0 flex-1 text-sm text-mist-600">
              Latest payment request <span className="text-mist-500">· {formatDate(latestRequest.createdAt)}</span>
            </p>
            <PaymentStatusBadge status={latestRequest.status} pendingLabel="Pending review" />
            {/* The details page sends a new request, which a pause refuses. */}
            {props.salesOpen && (
              <Button ref={detailsRef} variant="secondary" size="sm" onClick={() => openDetails('details')}>
                Open payment details
              </Button>
            )}
            {/* Without the details page, the admin's reason for a declined
                receipt would have nowhere to show while sales are paused. */}
            {!props.salesOpen && latestRequest.adminNote && (
              <p className="w-full text-xs text-mist-600">Admin note: {latestRequest.adminNote}</p>
            )}
          </div>
        )}
      </Card>

      <section className="space-y-3">
        {/* No prices on the plan cards: the amount is the owner's to show, and
            the one to transfer is set in the payment details, shown only in
            the transfer step. */}
        <SectionHeading title="Plans" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card padded className="flex flex-col">
            <h3 className="text-base font-semibold text-mist-900">{FREE_PLAN.name}</h3>
            <p className="mt-0.5 text-sm text-mist-500">{FREE_PLAN.summary}</p>
            <PlanFeatures plan={FREE_PLAN} />
            <Button variant="secondary" block disabled className="mt-5">
              {props.isPremium ? 'Included in Premium' : 'Current plan'}
            </Button>
          </Card>

          {/* The one highlighted card: a board edge instead of a dark surface.
              Not while sales are paused — there is nothing to recommend. */}
          <div
            className={cn(
              'flex flex-col rounded-2xl border bg-white p-5',
              props.salesOpen && !props.isPremium ? 'border-board-600 ring-1 ring-board-600' : 'border-mist-200',
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-mist-900">{PREMIUM_PLAN.name}</h3>
              {!props.isPremium && props.salesOpen && <Badge tone="accent">Recommended</Badge>}
            </div>
            <p className="mt-0.5 text-sm text-mist-500">{PREMIUM_PLAN.summary}</p>
            <PlanFeatures plan={PREMIUM_PLAN} />

            {props.isPremium ? (
              <Button variant="secondary" block disabled className="mt-5">
                Subscription active
              </Button>
            ) : props.salesOpen ? (
              <Button ref={payRef} block className="mt-5" onClick={() => openDetails('pay')}>
                Pay by transfer
              </Button>
            ) : (
              // Paused by an admin (SubscriptionAvailabilityControl): a calm
              // note where the button was, never a button into a dead end.
              <p className={cn(insetClass, 'mt-5 px-4 py-3 text-sm text-mist-600')}>
                New subscriptions are paused for now. Your free tests stay open.{' '}
                <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
                  Ask in Telegram
                </a>{' '}
                when Premium reopens.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeading title="Billing history" />
        {props.payments.length === 0 ? (
          <EmptyState
            icon={<Receipt />}
            title="No completed payments yet"
            description="An approved card transfer appears here."
          />
        ) : (
          // Each payment by its date and its way, not its amount: a price is
          // shown only in the payment details while sales are open.
          <List>
            {props.payments.slice(0, 4).map((payment) => (
              <li key={payment.id} className={listRowClass}>
                <RowText
                  title={<span className="tabular-nums">{formatDateTime(payment.createdAt)}</span>}
                  meta={providerLabel(payment.provider)}
                />
                <Badge tone={paymentTone(payment.status)}>
                  {sentenceCase(payment.status)}
                </Badge>
              </li>
            ))}
          </List>
        )}
      </section>
    </>
  );
}
