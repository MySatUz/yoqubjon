import React from 'react';
import { prisma } from '@/lib/prisma';
import AdminForm from '@/components/admin/AdminForm';
import TestList from '@/components/admin/TestList';
import ManualPaymentRequests from '@/components/admin/ManualPaymentRequests';
import AdminUsersPanel from '@/components/admin/AdminUsersPanel';
import AdminSectionHub from '@/components/admin/AdminSectionHub';
import { isOwnerSessionUser, OWNER_ADMIN_EMAIL, requireAdminPage } from '@/lib/admin';
import { createManualReceiptSignedUrl } from '@/lib/manual-payments';
import AppShell from '@/components/layout/AppShell';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export default async function AdminUploadPage() {
  const session = await requireAdminPage();
  const canManageAdmins = isOwnerSessionUser(session?.user);

  const [tests, paymentRequests, users] = await Promise.all([
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
      take: 120,
      include: {
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    }),
    canManageAdmins
      ? prisma.user.findMany({
          orderBy: [
            { role: 'desc' },
            { createdAt: 'desc' },
          ],
          take: 100,
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const paymentRequestsWithReceipts = await Promise.all(
    paymentRequests.map(async (request) => ({
      ...request,
      receiptSignedUrl: await createManualReceiptSignedUrl(request.receiptPath, 60 * 60 * 24),
    }))
  );
  const adminCount = users.filter((user) => user.role === 'ADMIN' || user.email === OWNER_ADMIN_EMAIL).length;
  const pendingPaymentCount = paymentRequests.filter((request) => request.status === 'PENDING').length;

  return (
    <AppShell session={session} canManageTests>
      <div className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-10">
            <h1 className="text-4xl font-black text-slate-900 mb-2 tracking-tight">Admin Test Manager</h1>
            <p className="text-slate-500 font-medium">Upload tests and review manual subscription payments.</p>
          </div>

          <AdminSectionHub
            canManageAdmins={canManageAdmins}
            adminCount={adminCount}
            paymentCount={paymentRequests.length}
            pendingPaymentCount={pendingPaymentCount}
            testCount={tests.length}
            adminAccess={<AdminUsersPanel users={users} ownerEmail={OWNER_ADMIN_EMAIL} />}
            payments={<ManualPaymentRequests requests={paymentRequestsWithReceipts} />}
            tests={(
              <div className="space-y-10">
                <AdminForm />
                <TestList tests={tests} />
              </div>
            )}
          />
        </div>
      </div>
    </AppShell>
  );
}
