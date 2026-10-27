'use client';

import { type FormEvent, type ReactNode, useMemo, useRef, useState, useTransition } from 'react';
import { CheckCircle2, ChevronRight, ExternalLink, FileText, Loader2, XCircle } from 'lucide-react';
import {
  approveManualPaymentRequest,
  rejectManualPaymentRequest,
} from '@/app/admin/manual-payment-actions';
import { formatDateTime } from '@/lib/formatDate';
import { OLYMPIAD_TIME_ZONE } from '@/lib/olympiad';
import { Card, CardBody, CardHeader, insetClass } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button, buttonClass } from '@/components/ui/Button';
import { useConfirm } from '@/components/ui/Dialog';
import { Textarea, hintClass } from '@/components/ui/Field';
import { List, listRowClass, listRowInteractiveClass, rowChevronClass } from '@/components/ui/List';
import { ChipCheck, chipClass, chipCountClass, chipGroupClass } from '@/components/ui/Misc';
import { Alert, EmptyState } from '@/components/ui/Feedback';
import { PaymentStatusBadge } from '@/components/ui/PaymentStatusBadge';
import { cn } from '@/components/ui/cn';

type DateValue = Date | string;

type ManualPaymentRequestItem = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  payerName: string | null;
  contact: string | null;
  paymentReference: string | null;
  receiptFileName: string | null;
  message: string | null;
  adminNote: string | null;
  reviewedAt: DateValue | null;
  createdAt: DateValue;
  user: {
    email: string;
    name: string | null;
  };
  hasReceipt: boolean;
};

type ManualPaymentRequestsProps = {
  requests: ManualPaymentRequestItem[];
  /** How long an approval opens Premium for, said in its confirmation. */
  accessDays: number;
};

type Decision = 'approve' | 'reject';

/**
 * One fact in the request details. Like <KeyValue>, but the value wraps
 * instead of truncating: a payment note or message is often the one line the
 * admin needs to read in full.
 */
function Detail({ label, wide = false, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={cn('min-w-0', wide && 'sm:col-span-2')}>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className={cn('mt-0.5 break-words text-sm', wide ? 'text-gray-700' : 'font-medium text-gray-900')}>
        {children}
      </dd>
    </div>
  );
}

function toDate(value: DateValue) {
  return value instanceof Date ? value : new Date(value);
}

function formatAmount(amount: number, currency: string) {
  return `${amount.toLocaleString('en-US').replace(/,/g, ' ')} ${currency}`;
}

const tashkentMonth = new Intl.DateTimeFormat('en-GB', {
  timeZone: OLYMPIAD_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
});

/**
 * `2026-11`, the month in Tashkent time - the zone every date on the rows is
 * printed in (formatDateTime). `getMonth()` read the zone of whatever ran it:
 * UTC on the server, the admin's own in the browser, so a receipt sent after
 * midnight on the 1st sat under the previous month's chip on one side and
 * the hydration disagreed with the server render.
 */
function monthKey(value: DateValue) {
  const parts = tashkentMonth.formatToParts(toDate(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}`;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Derived from the grouping key, not re-read from the Date: a bare
 * `toLocaleDateString()` would follow the viewer's locale, and reading the
 * month a second time risks disagreeing with `monthKey` at a month boundary.
 */
function monthLabel(key: string) {
  const [year, month] = key.split('-');
  return `${MONTH_NAMES[Number(month) - 1]} ${year}`;
}

function requesterName(request: ManualPaymentRequestItem) {
  return request.user.name || request.payerName || request.user.email;
}

/**
 * Approve and reject for one pending request, each asked once in a dialog that
 * names the student and the amount: both are final, and the list of other
 * requests sits right beside them.
 *
 * Both buttons wait while a decision is under way, and a ref covers the gap
 * before that re-render: a double click used to send two POSTs for the same
 * requestId. Keyed by the request, so nothing carries over to the next one.
 */
function PaymentDecision({
  request,
  accessDays,
  onError,
}: {
  request: ManualPaymentRequestItem;
  accessDays: number;
  /** Said by the parent: a refused decision often comes back with the request reviewed, which unmounts this. */
  onError: (message: string | null) => void;
}) {
  const { confirm, dialog } = useConfirm();
  const [, startTransition] = useTransition();
  const [pendingDecision, setPendingDecision] = useState<Decision | null>(null);
  const isBusyRef = useRef(false);
  const name = requesterName(request);
  const amount = formatAmount(request.amount, request.currency);

  async function decide(decision: Decision, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isBusyRef.current) return;

    const formData = new FormData(event.currentTarget);
    const hasNote = String(formData.get('adminNote') || '').trim() !== '';
    const isSure = await confirm(
      decision === 'approve'
        ? {
            title: `Approve ${amount} from ${name}?`,
            description: (
              <>
                <p>Premium opens for {request.user.email} for {accessDays} days, starting now.</p>
                <p>A subscription they already have is replaced by this one, not extended.</p>
              </>
            ),
            confirmLabel: 'Approve and activate',
          }
        : {
            title: `Reject ${amount} from ${name}?`,
            description: hasNote
              ? 'No subscription is activated. They see your reason on their Subscription page.'
              : 'No subscription is activated, and the reason field is empty, so they will not see why.',
            confirmLabel: 'Reject payment',
            tone: 'danger',
          }
    );
    if (!isSure || isBusyRef.current) return;

    isBusyRef.current = true;
    onError(null);
    setPendingDecision(decision);
    startTransition(async () => {
      // The action's revalidation brings this request back reviewed, which
      // takes these forms off the screen. A request that never reached the
      // server (the connection dropped) is said here too: thrown inside the
      // transition, it would have replaced the page with the error screen.
      try {
        const result = decision === 'approve'
          ? await approveManualPaymentRequest(formData)
          : await rejectManualPaymentRequest(formData);
        if (!result.success) onError(result.error);
      } catch {
        onError('The decision did not reach the server. Check the connection and try again.');
      } finally {
        isBusyRef.current = false;
        setPendingDecision(null);
      }
    });
  }

  const isBusy = pendingDecision !== null;

  return (
    <div className="space-y-3 border-t border-gray-100 pt-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <form onSubmit={(event) => void decide('approve', event)} className="space-y-2">
          <input type="hidden" name="requestId" value={request.id} />
          <Textarea
            name="adminNote"
            rows={2}
            placeholder="Optional note"
            aria-label="Note on the approval (optional)"
            className="resize-none"
          />
          <Button type="submit" block disabled={isBusy}>
            {pendingDecision === 'approve' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {pendingDecision === 'approve' ? 'Approving…' : 'Approve and activate'}
          </Button>
        </form>

        <form onSubmit={(event) => void decide('reject', event)} className="space-y-2">
          <input type="hidden" name="requestId" value={request.id} />
          <Textarea
            name="adminNote"
            rows={2}
            placeholder="Reason for rejection"
            aria-label="Reason for rejection"
            className="resize-none"
          />
          {/* Outlined: a solid red beside the solid approve read as two equal
              calls to action. The dialog asks before anything happens. */}
          <Button type="submit" variant="danger-secondary" block disabled={isBusy}>
            {pendingDecision === 'reject' ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
            {pendingDecision === 'reject' ? 'Rejecting…' : 'Reject payment'}
          </Button>
        </form>
      </div>

      <p className={hintClass}>The student sees the note or the reason on their Subscription page.</p>
      {dialog}
    </div>
  );
}

/** Pending first, since those wait on the admin; then newest first. */
function compareRequests(left: ManualPaymentRequestItem, right: ManualPaymentRequestItem) {
  const leftPending = left.status === 'PENDING' ? 0 : 1;
  const rightPending = right.status === 'PENDING' ? 0 : 1;
  return leftPending - rightPending || toDate(right.createdAt).getTime() - toDate(left.createdAt).getTime();
}

export default function ManualPaymentRequests({ requests, accessDays }: ManualPaymentRequestsProps) {
  const groups = useMemo(() => {
    const grouped = new Map<string, ManualPaymentRequestItem[]>();

    for (const request of requests) {
      const key = monthKey(request.createdAt);
      const group = grouped.get(key);
      if (group) group.push(request);
      else grouped.set(key, [request]);
    }

    // Newest month first. The server sends pending requests ahead of the
    // rest, so arrival order would put the months out of calendar order.
    return Array.from(grouped.entries())
      .sort(([left], [right]) => right.localeCompare(left))
      .map(([key, items]) => ({
        key,
        label: monthLabel(key),
        requests: items.sort(compareRequests),
        pending: items.filter((request) => request.status === 'PENDING').length,
      }));
  }, [requests]);

  // Opens on the newest month that still has something to review.
  const [activeMonth, setActiveMonth] = useState(
    () => (groups.find((group) => group.pending > 0) ?? groups[0])?.key || ''
  );
  const activeGroup = groups.find((group) => group.key === activeMonth) || groups[0];
  const [selectedId, setSelectedId] = useState<string | null>(activeGroup?.requests[0]?.id || null);
  // Which request a refused decision belongs to: kept here, because the
  // refresh that follows may bring that request back reviewed by someone else.
  const [decisionError, setDecisionError] = useState<{ requestId: string; message: string } | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const selectedRequest =
    activeGroup?.requests.find((request) => request.id === selectedId) ||
    activeGroup?.requests[0] ||
    null;

  function chooseMonth(key: string) {
    const group = groups.find((item) => item.key === key);
    setActiveMonth(key);
    setSelectedId(group?.requests[0]?.id || null);
  }

  function chooseRequest(id: string) {
    setSelectedId(id);
    // One column below lg: the details open under the whole list, out of
    // sight, so they are brought up to meet the row that was pressed.
    if (!window.matchMedia('(min-width: 1024px)').matches) {
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      requestAnimationFrame(() => {
        detailRef.current?.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' });
      });
    }
  }

  if (requests.length === 0) {
    return (
      <EmptyState
        icon={<FileText />}
        title="No payment requests yet"
        description="A request appears here when a student sends the receipt of a transfer."
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        {/* Chips, not a segmented track: up to 120 requests span many months,
            and the track scrolled sideways with months out of view. Amber
            marks the pending requests only. */}
        <div role="group" aria-label="Month" className={cn(chipGroupClass, 'min-w-0 flex-1')}>
          {groups.map((group) => {
            const isActive = group.key === activeGroup?.key;

            return (
              <button
                key={group.key}
                type="button"
                onClick={() => chooseMonth(group.key)}
                aria-pressed={isActive}
                className={chipClass(isActive)}
              >
                <ChipCheck active={isActive} />
                {group.label}
                {/* A bare "12" after the month is clear to the eye, not to a screen reader. */}
                <span className={chipCountClass(isActive)}>
                  {group.requests.length}
                  <span className="sr-only">{group.requests.length === 1 ? ' request' : ' requests'}</span>
                </span>
                {group.pending > 0 && <Badge tone="warning">{group.pending} pending</Badge>}
              </button>
            );
          })}
        </div>
        {/* On the gray-100 canvas, where gray-500 misses AA. */}
        <p className="shrink-0 pt-2 text-xs tabular-nums text-gray-600">
          {requests.length} {requests.length === 1 ? 'request' : 'requests'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[0.86fr_1.14fr]">
        <List className="self-start">
          {activeGroup?.requests.map((request) => {
            const isSelected = selectedRequest?.id === request.id;

            return (
              <li key={request.id}>
                <button
                  type="button"
                  onClick={() => chooseRequest(request.id)}
                  aria-pressed={isSelected}
                  // listRowClass carries the inset focus ring.
                  className={cn(
                    isSelected ? cn(listRowClass, 'bg-ink-50') : listRowInteractiveClass,
                    'group w-full text-left',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {request.user.name || request.payerName || 'No name'} · {formatAmount(request.amount, request.currency)}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-gray-500">{request.user.email}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <PaymentStatusBadge status={request.status} />
                    <span className="text-xs tabular-nums text-gray-500">{formatDateTime(request.createdAt)}</span>
                  </div>
                  {/* Every pressable row ends in a chevron: it opens the details. */}
                  <ChevronRight className={rowChevronClass} aria-hidden />
                </button>
              </li>
            );
          })}
        </List>

        {selectedRequest && (
          // scroll-mt keeps it clear of the phone's sticky top bar when it is
          // brought into view.
          <div ref={detailRef} className="min-w-0 scroll-mt-20 self-start">
            <Card as="article">
              <CardHeader
                title={selectedRequest.user.name || selectedRequest.payerName || 'No name'}
                description={selectedRequest.user.email}
                actions={
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Amount</p>
                    <p className="text-base font-semibold tabular-nums text-gray-900">
                      {formatAmount(selectedRequest.amount, selectedRequest.currency)}
                    </p>
                  </div>
                }
              />

              <CardBody className="space-y-4">
                <dl className={cn(insetClass, 'grid grid-cols-1 gap-4 p-4 sm:grid-cols-2')}>
                  <Detail label="Contact">{selectedRequest.contact || 'Not provided'}</Detail>
                  <Detail label="Payment note">{selectedRequest.paymentReference || 'Not provided'}</Detail>
                  {selectedRequest.message && (
                    <Detail label="Message" wide>
                      {selectedRequest.message}
                    </Detail>
                  )}
                  {selectedRequest.adminNote && (
                    <Detail label="Admin note" wide>
                      {selectedRequest.adminNote}
                    </Detail>
                  )}
                </dl>

                <div className="flex flex-wrap items-center gap-3">
                  {selectedRequest.hasReceipt ? (
                    <a
                      href={`/api/admin/payments/${selectedRequest.id}/receipt`}
                      target="_blank"
                      rel="noreferrer"
                      className={buttonClass({ variant: 'secondary', size: 'sm' })}
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open receipt
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-2 text-sm text-gray-500">
                      <FileText className="h-4 w-4" />
                      Receipt unavailable
                    </span>
                  )}
                  {selectedRequest.receiptFileName && (
                    <span className="max-w-full truncate text-xs text-gray-500">
                      {selectedRequest.receiptFileName}
                    </span>
                  )}
                </div>

                {selectedRequest.status === 'PENDING' && (
                  <PaymentDecision
                    key={selectedRequest.id}
                    request={selectedRequest}
                    accessDays={accessDays}
                    onError={(message) => setDecisionError(
                      message ? { requestId: selectedRequest.id, message } : null
                    )}
                  />
                )}

                {decisionError?.requestId === selectedRequest.id && (
                  <Alert tone="danger">{decisionError.message}</Alert>
                )}
              </CardBody>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
