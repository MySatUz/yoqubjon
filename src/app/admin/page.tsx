import React from 'react';
import { prisma } from '@/lib/prisma';
import AdminForm from '@/components/admin/AdminForm';
import TestList from '@/components/admin/TestList';
import ManualPaymentRequests from '@/components/admin/ManualPaymentRequests';
import { requireAdminPage } from '@/lib/admin';
import { createManualReceiptSignedUrl } from '@/lib/manual-payments';

export const dynamic = 'force-dynamic';

export default async function AdminUploadPage() {
  await requireAdminPage();

  const [tests, paymentRequests] = await Promise.all([
    prisma.test.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { questions: true }
        }
      }
    }),
    prisma.manualPaymentRequest.findMany({
      orderBy: [
        { status: 'asc' },
        { createdAt: 'desc' },
      ],
      take: 40,
      include: {
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    }),
  ]);

  const paymentRequestsWithReceipts = await Promise.all(
    paymentRequests.map(async (request) => ({
      ...request,
      receiptSignedUrl: await createManualReceiptSignedUrl(request.receiptPath, 60 * 60 * 24),
    }))
  );

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black text-slate-900 mb-2 tracking-tight">Admin Test Manager</h1>
          <p className="text-slate-500 font-medium">Upload tests and review manual subscription payments.</p>
        </div>

        <ManualPaymentRequests requests={paymentRequestsWithReceipts} />

        {/* Upload Form */}
        <AdminForm />

        {/* Existing Tests List */}
        <TestList tests={tests} />
      </div>
    </div>
  );
}
