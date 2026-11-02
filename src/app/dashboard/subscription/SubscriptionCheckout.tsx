'use client';

import React, { useEffect, useRef, useState, useTransition } from 'react';
import { ArrowLeft, Check, Loader2, Receipt } from 'lucide-react';
import { formatDate, formatDateTime } from '@/lib/formatDate';
import { TELEGRAM_URL } from '@/lib/landing/warmup';
import { FREE_PLAN, PREMIUM_PLAN, type PlanSummary } from '@/lib/plans';
import type { PurchasableCourse } from '@/lib/coursePurchase';
import { ENDS_SOON_DAYS, formatDateKey } from '@/components/admin/courses/accessPlan';
import { Card, CardHeader, insetClass } from '@/components/ui/Card';
import { Button, linkClass } from '@/components/ui/Button';
import { Badge, type Tone } from '@/components/ui/Badge';
import { useConfirm } from '@/components/ui/Dialog';
import { PaymentStatusBadge } from '@/components/ui/PaymentStatusBadge';
import { Alert, EmptyState } from '@/components/ui/Feedback';
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
  /** The course it buys; null for a request from before courses were sold one at a time. */
  category: string | null;
  /** That course by its name, or "Premium Pro, every course" for an old request. */
  courseLabel: string;
  receiptFileName: string | null;
  adminNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

/** A course the student holds now, bought or given by an admin. */
type OwnedCourse = {
  value: string;
  label: string;
  /** The access end as a `YYYY-MM-DD` UTC key (accessPlan.ts); null for access with no end date. */
  endKey: string | null;
  /** Whole days left, worked out on the server; null with no end date. */
  daysLeft: number | null;
};

type SubscriptionCheckoutProps = {
  userName: string;
  userEmail: string;
  /** False while an admin has paused sales: nothing on this page sells. */
  salesOpen: boolean;
  /** Today's Tashkent date, the key the course dates are counted from. */
  todayKey: string;
  /** The courses this student can pay for, in the catalog's order. */
  courses: PurchasableCourse[];
  ownedCourses: OwnedCourse[];
  /**
   * Premium bought before courses were sold one at a time: every course
   * until it ends. Null for everyone else.
   */
  premium: {
    expiresAt: string;
    provider: string;
    /** Whole days until it ends, worked out on the server. */
    daysLeft: number;
  } | null;
  /** A course `?course=` names that is on sale: the page opens on paying for it. */
  initialCourse: string | null;
  requests: ManualRequest[];
  payments: {
    id: string;
    provider: string;
    status: string;
    createdAt: string;
  }[];
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
        <li key={feature} className="flex gap-2 text-gray-700">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-ink-600" aria-hidden />
          {feature}
        </li>
      ))}
    </ul>
  );
}

const CANCEL_ERROR = 'The subscription could not be cancelled. Try again in a minute.';

/** When to renew, without counting from a date. */
function daysLeftLabel(days: number) {
  if (days <= 0) return 'Ends today';
  return days === 1 ? '1 day left' : `${days} days left`;
}

export function SubscriptionCheckout(props: SubscriptionCheckoutProps) {
  const canBuy = props.salesOpen && props.transfer !== null && props.courses.length > 0;
  // A locked test on Practice links here with its course: the page opens on
  // paying for it, one press from the test.
  const [mode, setMode] = useState<'plans' | 'manual'>(() =>
    canBuy && props.initialCourse ? 'manual' : 'plans'
  );
  const [course, setCourse] = useState<string | null>(() =>
    props.initialCourse ?? (props.courses.length === 1 ? props.courses[0].value : null)
  );
  const [isCanceling, startCancelTransition] = useTransition();
  const [cancelError, setCancelError] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();
  const latestRequest = props.requests[0];
  const purchasable = new Set(props.courses.map((item) => item.value));

  // The button that switches views goes away with its view, which would drop
  // keyboard focus on the page body (and leave the screen scrolled to where
  // the Premium card was). Focus moves to the top of the transfer step, and
  // back to the button that opened it. Not on the first render: a page that
  // opens on the transfer step leaves the focus where the browser puts it.
  const backRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const hasSwitched = useRef(false);
  useEffect(() => {
    if (!hasSwitched.current) return;
    if (mode === 'manual') {
      backRef.current?.focus();
    } else if (openerRef.current?.isConnected) {
      openerRef.current.focus();
      openerRef.current = null;
    }
  }, [mode]);

  /** Opens the transfer step, on `withCourse` when that one is on sale. */
  const openDetails = (event: React.MouseEvent<HTMLButtonElement>, withCourse?: string | null) => {
    openerRef.current = event.currentTarget;
    hasSwitched.current = true;
    if (withCourse && purchasable.has(withCourse)) setCourse(withCourse);
    setMode('manual');
  };

  const backToPlans = () => {
    hasSwitched.current = true;
    setMode('plans');
  };

  const cancelSubscription = async () => {
    // "Keep" rather than the default "Cancel": next to "Cancel subscription"
    // a plain "Cancel" reads as the same answer.
    const ok = await confirm({
      title: `Cancel ${PREMIUM_PLAN.name}?`,
      description: 'Access to every course it opens stops right away, even with days left on it. Courses you bought one at a time stay open.',
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
        <button ref={backRef} type="button" onClick={backToPlans} className={backLinkClass}>
          <ArrowLeft className="h-4 w-4" />
          Back to plans
        </button>

        <ManualPaymentForm
          userName={props.userName}
          userEmail={props.userEmail}
          todayKey={props.todayKey}
          courses={props.courses}
          course={course}
          onCourseChange={setCourse}
          premiumUntil={props.premium?.expiresAt ?? null}
          requests={props.requests}
          transfer={props.transfer}
        />
      </div>
    );
  }

  const hasAccess = props.ownedCourses.length > 0 || props.premium !== null;

  return (
    <>
      {dialog}
      <Card>
        <CardHeader
          title="Your courses"
          description={
            hasAccess
              ? 'Every test in these courses is open to you until the date beside it.'
              : 'No course yet. The tests marked Free are open to you.'
          }
        />

        {hasAccess && (
          <ul className="divide-y divide-gray-100 border-t border-gray-100">
            {props.premium && (
              <li className={listRowClass}>
                <RowText
                  title={`${PREMIUM_PLAN.name} · every course`}
                  meta={`Until ${formatDate(props.premium.expiresAt)} · ${daysLeftLabel(props.premium.daysLeft)} · ${providerLabel(props.premium.provider)}`}
                />
                {/* Outlined, red only on hover: a ghost red label read as
                    text, and a solid red button is too loud for a row. */}
                <Button variant="danger-secondary" size="sm" onClick={cancelSubscription} disabled={isCanceling}>
                  {isCanceling && <Loader2 className="h-4 w-4 animate-spin" />}
                  Cancel subscription
                </Button>
              </li>
            )}
            {props.ownedCourses.map((owned) => (
              <li key={owned.value} className={listRowClass}>
                <RowText
                  title={owned.label}
                  meta={
                    owned.endKey && owned.daysLeft !== null
                      ? `Until ${formatDateKey(owned.endKey, props.todayKey)} · ${daysLeftLabel(owned.daysLeft)}`
                      : 'No end date'
                  }
                />
                {owned.daysLeft !== null && owned.daysLeft <= ENDS_SOON_DAYS && <Badge tone="warning">Ends soon</Badge>}
                {/* Renewing adds 30 days to the end above, so it can be paid early. */}
                {canBuy && purchasable.has(owned.value) && (
                  <Button variant="quiet" size="sm" onClick={(event) => openDetails(event, owned.value)}>
                    Add 30 days
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}

        {cancelError && (
          <div className="px-5 pb-5">
            <Alert tone="danger">{cancelError}</Alert>
          </div>
        )}

        {latestRequest && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-gray-100 px-5 py-3">
            {/* The course and the date, not the amount: a price is shown only
                in the payment details while sales are open (the owner's rule). */}
            <p className="min-w-0 flex-1 text-sm text-gray-600">
              Latest payment request <span className="text-gray-500">· {latestRequest.courseLabel} · {formatDate(latestRequest.createdAt)}</span>
            </p>
            <PaymentStatusBadge status={latestRequest.status} pendingLabel="Pending review" />
            {/* The details page sends a new request, which a pause refuses. */}
            {canBuy && (
              <Button variant="secondary" size="sm" onClick={(event) => openDetails(event, latestRequest.category)}>
                Open payment details
              </Button>
            )}
            {/* Without the details page, the admin's reason for a declined
                receipt would have nowhere to show while sales are paused. */}
            {!canBuy && latestRequest.adminNote && (
              <p className="w-full text-xs text-gray-600">Admin note: {latestRequest.adminNote}</p>
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
            <h3 className="text-base font-semibold text-gray-900">{FREE_PLAN.name}</h3>
            <p className="mt-0.5 text-sm text-gray-500">{FREE_PLAN.summary}</p>
            <PlanFeatures plan={FREE_PLAN} />
            <Button variant="secondary" block disabled className="mt-5">
              {hasAccess ? 'Always included' : 'Current plan'}
            </Button>
          </Card>

          {/* The one highlighted card: an ink edge instead of a dark surface.
              Not while nothing can be bought, or for a student who already
              has a course: there is nothing to recommend. */}
          <div
            className={cn(
              'flex flex-col rounded-2xl border bg-white p-5',
              canBuy && !hasAccess ? 'border-ink-600 ring-1 ring-ink-600' : 'border-gray-200',
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-gray-900">{PREMIUM_PLAN.name}</h3>
              {canBuy && !hasAccess && <Badge tone="accent">Recommended</Badge>}
            </div>
            <p className="mt-0.5 text-sm text-gray-500">{PREMIUM_PLAN.summary}</p>
            <PlanFeatures plan={PREMIUM_PLAN} />

            {canBuy ? (
              <Button block className="mt-5" onClick={(event) => openDetails(event, course)}>
                Buy a course
              </Button>
            ) : !props.salesOpen ? (
              // Paused by an admin (SubscriptionAvailabilityControl): a calm
              // note where the button was, never a button into a dead end.
              <p className={cn(insetClass, 'mt-5 px-4 py-3 text-sm text-gray-600')}>
                New subscriptions are paused for now. Your free tests stay open.{' '}
                <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
                  Ask in Telegram
                </a>{' '}
                when {PREMIUM_PLAN.name} reopens.
              </p>
            ) : (
              // Open, but no course has a test to buy, or every one the
              // student has is theirs with no end date.
              <p className={cn(insetClass, 'mt-5 px-4 py-3 text-sm text-gray-600')}>
                No course is on sale right now. Your free tests stay open.
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
