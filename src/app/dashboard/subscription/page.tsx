import React from 'react';
import { auth } from "@/auth";
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { Clock3 } from 'lucide-react';
import {
  formatManualPaymentAmount,
} from '@/lib/manual-payments';
import { getSubscriptionSettings } from '@/lib/subscription-settings';
import { SubscriptionCheckout } from './SubscriptionCheckout';

export default async function SubscriptionPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const subscriptionSettings = await getSubscriptionSettings();

  if (!subscriptionSettings.isEnabled) {
    return (
      <div className="px-4 py-10 sm:px-6 lg:px-8">
        <section className="mx-auto max-w-4xl overflow-hidden rounded-[2rem] border border-amber-200 bg-white shadow-xl shadow-amber-100/60">
          <div className="h-2 bg-amber-400" />
          <div className="px-7 py-14 text-center sm:px-12 sm:py-20">
            <span className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-100 text-amber-700">
              <Clock3 className="h-8 w-8" />
            </span>
            <p className="mt-7 text-[10px] font-black uppercase tracking-[0.3em] text-amber-700">
              MYSATuz Premium
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
              Subscriptions are temporarily unavailable
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-base font-bold leading-relaxed text-slate-500">
              New subscription purchases are currently paused.
            </p>
          </div>
        </section>
      </div>
    );
  }
  
  const [subscription, manualRequests, payments] = await Promise.all([
    prisma.subscription.findFirst({
      where: {
        userId: session.user.id,
        isActive: true,
        expiresAt: { gt: new Date() }
      },
      orderBy: { expiresAt: 'desc' },
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
    prisma.payment.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true,
        amount: true,
        currency: true,
        provider: true,
        status: true,
        createdAt: true,
      },
    }),
  ]);

  const isPremium = subscription?.planId === 'PREMIUM';
  const serializedRequests = manualRequests.map((request) => ({
    ...request,
    createdAt: request.createdAt.toISOString(),
    reviewedAt: request.reviewedAt?.toISOString() || null,
  }));
  const serializedPayments = payments.map((payment) => ({
    ...payment,
    createdAt: payment.createdAt.toISOString(),
  }));
  const serializedSubscription = subscription
    ? {
        id: subscription.id,
        planId: subscription.planId,
        isActive: subscription.isActive,
        expiresAt: subscription.expiresAt.toISOString(),
        provider: subscription.provider,
        providerStatus: subscription.providerStatus,
        createdAt: subscription.createdAt.toISOString(),
      }
    : null;

  return (
    <div className="px-4 py-10 sm:px-6 lg:px-8">
      <header className="mx-auto mb-10 max-w-6xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="bg-slate-900 p-8 text-white sm:p-10">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-300">
              MYSATuz Premium
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-tight">Subscription</h1>
            <p className="mt-4 max-w-xl text-base font-bold leading-relaxed text-slate-300">
              Send one transfer receipt, get admin-reviewed premium access, and track every subscription detail here.
            </p>
          </div>
          <div className="grid gap-4 p-8 sm:grid-cols-3 sm:p-10">
            <div className="rounded-3xl bg-blue-50 p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Access</p>
              <p className="mt-2 text-2xl font-black text-slate-900">30 days</p>
            </div>
            <div className="rounded-3xl bg-emerald-50 p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Status</p>
              <p className="mt-2 text-2xl font-black text-slate-900">{isPremium ? 'Active' : 'Free'}</p>
            </div>
            <div className="rounded-3xl bg-amber-50 p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Review</p>
              <p className="mt-2 text-2xl font-black text-slate-900">Manual</p>
            </div>
          </div>
        </div>
      </header>

      <SubscriptionCheckout
        userName={session?.user?.name || ''}
        userEmail={session?.user?.email || ''}
        isPremium={isPremium}
        requests={serializedRequests}
        payments={serializedPayments}
        subscription={serializedSubscription}
        transfer={{
          cardHolder: subscriptionSettings.cardHolder,
          cardNumber: subscriptionSettings.cardNumber,
          cardType: subscriptionSettings.cardType,
          amount: subscriptionSettings.amount,
          currency: 'UZS',
        }}
        amountLabel={formatManualPaymentAmount(subscriptionSettings.amount)}
      />
    </div>
  );
}
