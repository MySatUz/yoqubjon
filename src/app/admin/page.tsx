import React from 'react';
import { prisma } from '@/lib/prisma';
import AdminForm from '@/components/admin/AdminForm';
import TestList from '@/components/admin/TestList';
import ManualPaymentRequests from '@/components/admin/ManualPaymentRequests';
import AdminUsersPanel from '@/components/admin/AdminUsersPanel';
import UserDirectoryPanel from '@/components/admin/UserDirectoryPanel';
import AdminSectionHub from '@/components/admin/AdminSectionHub';
import SectionVisibilityForm from '@/components/admin/SectionVisibilityForm';
import SectionAccessManager from '@/components/admin/SectionAccessManager';
import { isOwnerSessionUser, OWNER_ADMIN_EMAIL, requireAdminPage } from '@/lib/admin';
import { createManualReceiptSignedUrl } from '@/lib/manual-payments';
import { getTestCollections } from '@/lib/testCatalog';
import AppShell from '@/components/layout/AppShell';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export default async function AdminUploadPage() {
  const session = await requireAdminPage();
  const canManageAdmins = isOwnerSessionUser(session?.user);

  const [tests, paymentRequests, users, userCount, adminCount, collectionRows, sectionAccesses] = await Promise.all([
    prisma.test.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        questions: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            content: true,
            options: true,
            correctAnswer: true,
            explanation: true,
            imageUrl: true,
            videoUrl: true,
            order: true,
          },
        },
        _count: {
          select: { questions: true }
        }
      },
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
    prisma.user.findMany({
      orderBy: [
        { role: 'desc' },
        { createdAt: 'desc' },
      ],
      take: 1000,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            results: true,
            subscriptions: true,
            payments: true,
            manualPaymentRequests: true,
          },
        },
      },
    }),
    prisma.user.count(),
    prisma.user.count({
      where: {
        OR: [
          { role: 'ADMIN' },
          { email: OWNER_ADMIN_EMAIL },
        ],
      },
    }),
    prisma.testCollectionVisibility.findMany({
      select: {
        category: true,
        visible: true,
        label: true,
        description: true,
        position: true,
      },
    }),
    prisma.sectionAccess.findMany({
      orderBy: { createdAt: 'desc' },
      take: 500,
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

  const collections = getTestCollections(collectionRows);
  const paymentRequestsWithReceipts = await Promise.all(
    paymentRequests.map(async (request) => ({
      ...request,
      receiptSignedUrl: await createManualReceiptSignedUrl(request.receiptPath, 60 * 60 * 24),
    }))
  );
  const pendingPaymentCount = paymentRequests.filter((request) => request.status === 'PENDING').length;
  const visibleSectionCount = collections.filter((collection) => collection.visible).length;
  const visibleTestCount = tests.filter((test) => test.visible).length;

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
            visibleSectionCount={visibleSectionCount}
            visibleTestCount={visibleTestCount}
            testCount={tests.length}
            adminAccess={(
              <AdminUsersPanel
                users={canManageAdmins ? users : []}
                ownerEmail={OWNER_ADMIN_EMAIL}
                userCount={userCount}
                userDirectory={<UserDirectoryPanel users={users} totalCount={userCount} />}
              />
            )}
            payments={<ManualPaymentRequests requests={paymentRequestsWithReceipts} />}
            sections={(
              <div className="space-y-8">
                <SectionAccessManager collections={collections} grants={sectionAccesses} />
                <SectionVisibilityForm collections={collections} />
              </div>
            )}
            tests={(
              <div className="space-y-10">
                <AdminForm collections={collections} />
                <TestList tests={tests} collections={collections} />
              </div>
            )}
          />
        </div>
      </div>
    </AppShell>
  );
}
