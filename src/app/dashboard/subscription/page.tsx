import React from 'react';
import { auth } from "@/auth";
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import {
  formatManualPaymentAmount,
  MANUAL_TRANSFER_DETAILS,
} from '@/lib/manual-payments';
import { SubscriptionCheckout } from './SubscriptionCheckout';

export default async function SubscriptionPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }
  
  const [subscription, manualRequests] = await Promise.all([
        prisma.subscription.findFirst({
          where: {
            userId: session.user.id,
            isActive: true,
            expiresAt: { gt: new Date() }
          }
        }),
        prisma.manualPaymentRequest.findMany({
          where: { userId: session.user.id },
          orderBy: { createdAt: 'desc' },
          take: 8,
          select: {
            id: true,
            status: true,
            amount: true,
            currency: true,
            receiptFileName: true,
            adminNote: true,
            createdAt: true,
            reviewedAt: true,
          },
        }),
      ]);

  const isPremium = subscription?.planId === 'PREMIUM';
  const serializedRequests = manualRequests.map((request) => ({
    ...request,
    createdAt: request.createdAt.toISOString(),
    reviewedAt: request.reviewedAt?.toISOString() || null,
  }));

  return (
    <div className="py-10 px-4 sm:px-6 lg:px-8">
      <header className="mb-12 text-center">
        <p className="mb-3 text-[10px] font-black uppercase tracking-[0.3em] text-blue-600">
          MYSATuz Premium
        </p>
        <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-4">Subscription</h1>
        <p className="text-slate-500 text-lg font-medium">
          Upload your transfer receipt here. Admin approval activates premium access for 30 days.
        </p>
      </header>

      <SubscriptionCheckout
        userName={session?.user?.name || ''}
        userEmail={session?.user?.email || ''}
        isPremium={isPremium}
        requests={serializedRequests}
        transfer={MANUAL_TRANSFER_DETAILS}
        amountLabel={formatManualPaymentAmount()}
      />
    </div>
  );
}
