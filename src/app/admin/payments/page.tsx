import ManualPaymentRequests from '@/components/admin/ManualPaymentRequests';
import AppShell from '@/components/layout/AppShell';
import { requireAdminPage } from '@/lib/admin';
import { createManualReceiptSignedUrl } from '@/lib/manual-payments';
import { prisma } from '@/lib/prisma';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export default async function AdminPaymentsPage() {
  const session = await requireAdminPage();

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

  const requestsWithReceipts = await Promise.all(
    paymentRequests.map(async (request) => ({
      ...request,
      receiptSignedUrl: await createManualReceiptSignedUrl(request.receiptPath, 60 * 60 * 24),
    }))
  );

  return (
    <AppShell session={session} canManageTests>
      <div className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <Link
            href="/admin"
            className="mb-6 inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-600"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to admin
          </Link>

          <ManualPaymentRequests requests={requestsWithReceipts} />
        </div>
      </div>
    </AppShell>
  );
}
