'use client';

import { useState } from 'react';
import { ArrowLeft, Check, ShieldCheck, X } from 'lucide-react';
import { ManualPaymentForm } from './ManualPaymentForm';

type ManualRequest = {
  id: string;
  status: string;
  amount: number;
  currency: string;
  receiptFileName: string | null;
  adminNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

type SubscriptionCheckoutProps = {
  userName: string;
  userEmail: string;
  isPremium: boolean;
  requests: ManualRequest[];
  transfer: {
    cardHolder: string;
    cardNumber: string;
    cardType: string;
    amount: number;
    currency: string;
  };
  amountLabel: string;
};

export function SubscriptionCheckout(props: SubscriptionCheckoutProps) {
  const [mode, setMode] = useState<'plans' | 'manual'>('plans');
  const latestRequest = props.requests[0];

  if (mode === 'manual') {
    return (
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setMode('plans')}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-600"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to plans
          </button>
          <div className="rounded-full bg-blue-50 px-4 py-2 text-xs font-black uppercase tracking-widest text-blue-700">
            Transfer payment
          </div>
        </div>

        <ManualPaymentForm {...props} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      {latestRequest && !props.isPremium && (
        <div className="mb-6 rounded-3xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-amber-700">Latest request</p>
              <p className="mt-1 text-sm font-bold text-amber-900">
                {latestRequest.status} · {latestRequest.amount.toLocaleString('en-US').replace(/,/g, ' ')} {latestRequest.currency}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMode('manual')}
              className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-amber-800 shadow-sm transition hover:bg-amber-100"
            >
              Open payment details
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <section className="flex flex-col rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h3 className="text-xl font-bold text-slate-900">Free Starter</h3>
          <p className="mt-2 text-sm font-medium text-slate-500">Basic practice for beginners.</p>
          <div className="my-8 text-4xl font-black text-slate-900">
            0 UZS <span className="text-sm font-bold text-slate-400">/ forever</span>
          </div>

          <ul className="mb-12 flex-1 space-y-4">
            <li className="flex items-center gap-3 text-sm font-bold text-slate-700">
              <Check className="h-5 w-5 text-green-500" />
              1 Full Math Module
            </li>
            <li className="flex items-center gap-3 text-sm font-bold text-slate-700">
              <Check className="h-5 w-5 text-green-500" />
              Basic Result Analysis
            </li>
            <li className="flex items-center gap-3 text-sm font-bold text-slate-400">
              <X className="h-5 w-5 text-slate-300" />
              Full solution review
            </li>
          </ul>

          <button disabled className="w-full rounded-2xl border border-slate-100 bg-slate-50 py-4 text-sm font-black text-slate-400">
            {props.isPremium ? 'Downgrade unavailable' : 'Current plan'}
          </button>
        </section>

        <section className="relative flex flex-col overflow-hidden rounded-3xl border-4 border-blue-600 bg-slate-900 p-8 shadow-2xl shadow-blue-200">
          <div className={`absolute right-0 top-0 rounded-bl-xl px-4 py-1 text-[10px] font-black uppercase tracking-widest text-white ${props.isPremium ? 'bg-green-500' : 'bg-blue-600'}`}>
            {props.isPremium ? 'Active' : 'Recommended'}
          </div>
          <h3 className="text-xl font-bold text-white">Premium Pro</h3>
          <p className="mt-2 text-sm font-medium text-slate-400">Advanced SAT Math practice for high scores.</p>
          <div className="my-8 text-4xl font-black text-white">
            {props.amountLabel} <span className="text-sm font-bold text-slate-400">/ month</span>
          </div>

          <ul className="mb-12 flex-1 space-y-4">
            {['Unlimited Math Modules', 'Full solution review', 'Progress dashboard', 'Priority Support'].map((item) => (
              <li key={item} className="flex items-center gap-3 text-sm font-bold text-slate-200">
                <Check className="h-5 w-5 text-blue-400" />
                {item}
              </li>
            ))}
          </ul>

          {props.isPremium ? (
            <button disabled className="w-full rounded-2xl border border-green-500/20 bg-green-500/10 py-4 text-sm font-black text-green-500">
              Subscription active
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setMode('manual')}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 text-sm font-black text-white shadow-xl shadow-blue-900/50 transition-all hover:bg-blue-500 active:scale-95"
            >
              <ShieldCheck className="h-5 w-5" />
              Pay by transfer
            </button>
          )}
        </section>
      </div>
    </div>
  );
}
