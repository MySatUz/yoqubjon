import { Suspense } from 'react';
import ManualPaymentRequests from '@/components/admin/ManualPaymentRequests';
import { MANUAL_PAYMENT_DAYS } from '@/lib/manual-payments';
import { prisma } from '@/lib/prisma';
import { SectionHeading } from '@/components/ui/Page';
import { Badge } from '@/components/ui/Badge';
import { cardClass } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Feedback';
import { cn } from '@/components/ui/cn';
import HashScroll from './HashScroll';

const REVIEWED_REQUEST_LIMIT = 120;
/** Far above any real backlog; only a flood of requests would reach it. */
const PENDING_REQUEST_LIMIT = 500;

const requestInclude = {
  user: {
    select: {
      email: true,
      name: true,
    },
  },
} as const;

const SECTION_ID = 'payments';
const HEADING_ID = 'payments-heading';
const DESCRIPTION = 'Students pay by card transfer and send the receipt. Check each one, then approve or reject it.';

/**
 * The admin's payment queue, on the page it pays for: the separate Payments
 * page is gone (the owner's call), and `/admin/payments` now lands here, on
 * `#payments`. Rendered only for an admin who is not in student view - the
 * page decides - so a student, or an admin looking as one, sees the page
 * exactly as before. The actions check admin again themselves.
 *
 * The section and its anchor are drawn at once; the queue streams inside it,
 * because the request query joins `user` and is the slowest read on the page.
 */
export default function PaymentRequestsSection() {
  return (
    // scroll-mt clears the phone's sticky top bar when the #payments link lands.
    <section id={SECTION_ID} aria-labelledby={HEADING_ID} className="scroll-mt-20 space-y-3 md:scroll-mt-6">
      <HashScroll id={SECTION_ID} />
      <Suspense fallback={<PaymentRequestsFallback />}>
        <PaymentRequestQueue />
      </Suspense>
    </section>
  );
}

/**
 * Every pending request, and the latest reviewed ones up to the limit. One
 * query ordered by status took 120 rows starting from 'APPROVED', which sorts
 * before 'PENDING': once 120 approvals had piled up, the requests still
 * waiting for a decision would have fallen off the page. The pending read is
 * the [status, createdAt DESC] index's own shape.
 */
async function PaymentRequestQueue() {
  const [pendingRequests, reviewedRequests] = await Promise.all([
    prisma.manualPaymentRequest.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      take: PENDING_REQUEST_LIMIT,
      include: requestInclude,
    }),
    prisma.manualPaymentRequest.findMany({
      where: { status: { not: 'PENDING' } },
      orderBy: { createdAt: 'desc' },
      take: REVIEWED_REQUEST_LIMIT,
      include: requestInclude,
    }),
  ]);

  // Receipts are signed lazily by /api/admin/payments/[id]/receipt when the
  // admin actually opens one, so the storage path never reaches the client.
  const requests = [...pendingRequests, ...reviewedRequests].map(({ receiptPath, ...request }) => ({
    ...request,
    hasReceipt: Boolean(receiptPath),
  }));
  const waiting = pendingRequests.length;

  return (
    <>
      <SectionHeading
        title={
          <span id={HEADING_ID} className="inline-flex flex-wrap items-center gap-2">
            Payment requests
            {/* Amber: waiting for a decision is what amber is for. A string,
                not a <span>: any element child would stand in for the icon. */}
            {waiting > 0 ? (
              <Badge tone="warning" className="tabular-nums">{`${waiting} waiting`}</Badge>
            ) : (
              <Badge onCanvas>None waiting</Badge>
            )}
          </span>
        }
        description={DESCRIPTION}
      />
      <ManualPaymentRequests requests={requests} accessDays={MANUAL_PAYMENT_DAYS} />
    </>
  );
}

/**
 * Mirrors the heading and <ManualPaymentRequests>: a row of month chips over a
 * two-column grid of request rows and a detail card.
 */
function PaymentRequestsFallback() {
  return (
    <>
      <SectionHeading title={<span id={HEADING_ID}>Payment requests</span>} description={DESCRIPTION} />
      <div className="space-y-5">
        <p className="sr-only">Loading payment requests</p>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-wrap gap-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-8 w-36 rounded-full pointer-coarse:h-10" />
            ))}
          </div>
          <Skeleton className="mt-2 h-3 w-20 shrink-0" />
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[0.86fr_1.14fr]">
          <div className={cn(cardClass, 'self-start divide-y divide-mist-100')}>
            {[0, 1, 2, 3].map((i) => (
              // Same geometry as a request row: two text lines, a badge over a date.
              <div key={i} className="flex items-center gap-4 px-4 py-3 sm:px-5">
                <div className="flex-1 space-y-1.5 py-0.5">
                  <Skeleton className="h-4 w-44 max-w-full" />
                  <Skeleton className="h-3 w-52 max-w-full" />
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-3 w-28" />
                </div>
              </div>
            ))}
          </div>
          <div className={cn(cardClass, 'self-start')}>
            <div className="flex items-start justify-between gap-3 border-b border-mist-100 px-5 py-4">
              <div className="space-y-1.5">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-52 max-w-full" />
              </div>
              <Skeleton className="h-10 w-24" />
            </div>
            <div className="space-y-4 p-5">
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-8 w-32" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
