import React from 'react';
import { Check, ShieldCheck, X } from 'lucide-react';
import { auth } from "@/auth";
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import {
  formatManualPaymentAmount,
  MANUAL_TRANSFER_DETAILS,
} from '@/lib/manual-payments';
import { ManualPaymentForm } from './ManualPaymentForm';
import { ClickPaymentButton } from './ClickPaymentButton';

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

      <div className="mb-10 grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm flex flex-col">
          <h3 className="text-xl font-bold text-slate-900 mb-2">Free Starter</h3>
          <p className="text-slate-500 text-sm mb-6">Basic practice for beginners.</p>
          <div className="text-4xl font-black text-slate-900 mb-8">0 UZS <span className="text-sm text-slate-400 font-bold">/ forever</span></div>
          
          <ul className="space-y-4 mb-12 flex-1">
            <li className="flex items-center gap-3 text-sm font-bold text-slate-700">
              <Check className="w-5 h-5 text-green-500" />
              1 Full Math Module
            </li>
            <li className="flex items-center gap-3 text-sm font-bold text-slate-700">
              <Check className="w-5 h-5 text-green-500" />
              Basic Result Analysis
            </li>
            <li className="flex items-center gap-3 text-sm font-bold text-slate-400">
              <X className="w-5 h-5 text-slate-300" />
              Full solution review
            </li>
          </ul>

          <button disabled className="w-full py-4 rounded-2xl text-sm font-black text-slate-400 bg-slate-50 border border-slate-100 cursor-not-allowed">
            {isPremium ? 'Downgrade Unavailable' : 'Current Plan'}
          </button>
        </div>

        <div className="bg-slate-900 rounded-3xl p-8 border-4 border-blue-600 shadow-2xl shadow-blue-200 flex flex-col relative overflow-hidden">
          {isPremium && (
            <div className="absolute top-0 right-0 bg-green-500 text-white px-4 py-1 text-[10px] font-black uppercase tracking-widest rounded-bl-xl">
              Active
            </div>
          )}
          {!isPremium && (
            <div className="absolute top-0 right-0 bg-blue-600 text-white px-4 py-1 text-[10px] font-black uppercase tracking-widest rounded-bl-xl">
              Recommended
            </div>
          )}
          <h3 className="text-xl font-bold text-white mb-2">Premium Pro</h3>
          <p className="text-slate-400 text-sm mb-6">Advanced features for high scores.</p>
          <div className="text-4xl font-black text-white mb-8">
            {formatManualPaymentAmount()} <span className="text-sm text-slate-400 font-bold">/ month</span>
          </div>
          
          <ul className="space-y-4 mb-12 flex-1">
            <li className="flex items-center gap-3 text-sm font-bold text-slate-200">
              <Check className="w-5 h-5 text-blue-400" />
              Unlimited Math Modules
            </li>
            <li className="flex items-center gap-3 text-sm font-bold text-slate-200">
              <Check className="w-5 h-5 text-blue-400" />
              Full solution review
            </li>
            <li className="flex items-center gap-3 text-sm font-bold text-slate-200">
              <Check className="w-5 h-5 text-blue-400" />
              Progress dashboard
            </li>
            <li className="flex items-center gap-3 text-sm font-bold text-slate-200">
              <Check className="w-5 h-5 text-blue-400" />
              Priority Support
            </li>
          </ul>

          {isPremium ? (
            <button disabled className="w-full py-4 rounded-2xl text-sm font-black text-green-500 bg-green-500/10 border border-green-500/20">
              Subscription Active
            </button>
          ) : (
            <div className="space-y-3">
              <ClickPaymentButton />
              <a
                href="#manual-payment"
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-white/5 py-4 text-sm font-black text-white transition-all hover:bg-white/10 active:scale-95"
              >
                <ShieldCheck className="h-5 w-5" />
                Pay by transfer
              </a>
            </div>
          )}
        </div>
      </div>

      <div id="manual-payment" className="max-w-6xl mx-auto scroll-mt-8">
        <ManualPaymentForm
          userName={session?.user?.name || ''}
          userEmail={session?.user?.email || ''}
          isPremium={isPremium}
          requests={serializedRequests}
          transfer={MANUAL_TRANSFER_DETAILS}
          amountLabel={formatManualPaymentAmount()}
        />
      </div>
    </div>
  );
}
