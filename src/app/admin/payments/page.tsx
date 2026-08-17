import { Suspense } from 'react';
import ManualPaymentRequests from '@/components/admin/ManualPaymentRequests';
import { requireAdminPage } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Streamed island. The 120-row query joins `user` and is by far the slowest part
 * of this route, so it renders inside its own <Suspense> boundary and the header
 * plus "Back to admin" go out immediately.
 *
 * The admin check stays in the page component below, before anything is
 * streamed, so `notFound()` can still replace the whole route.
 */
async function PaymentRequestList() {
  const paymentRequests = await prisma.manualPaymentRequest.findMany({
    orderBy: [
      { status: 'asc' },
      { createdAt: 'desc' },
    ],
    take: 120,
    include: {
      user: {
        select: {
          email: true,
          name: true,
        },
      },
    },
  });

  // Receipts are signed lazily by /api/admin/payments/[id]/receipt when the
  // admin actually opens one, so the storage path never reaches the client.
  const requestsWithReceipts = paymentRequests.map(({ receiptPath, ...request }) => ({
    ...request,
    hasReceipt: Boolean(receiptPath),
  }));

  return <ManualPaymentRequests requests={requestsWithReceipts} />;
}

/** Same rounded card wrapper as <ManualPaymentRequests>, so the swap holds place. */
function PaymentRequestListSkeleton() {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 space-y-3">
        <div className="h-3 w-24 animate-pulse rounded-full bg-blue-100" />
        <div className="h-8 w-72 max-w-full animate-pulse rounded-2xl bg-slate-200" />
        <div className="h-4 w-[30rem] max-w-full animate-pulse rounded-full bg-slate-100" />
      </div>
      <div className="space-y-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-100" />
        ))}
      </div>
    </section>
  );
}

export default async function AdminPaymentsPage() {
  // Kept here on purpose: access must not depend on the segment layout.
  await requireAdminPage();

  return (
    <div className="px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/admin"
          className="mb-6 inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to admin
        </Link>

        <Suspense fallback={<PaymentRequestListSkeleton />}>
          <PaymentRequestList />
        </Suspense>
      </div>
    </div>
  );
}
