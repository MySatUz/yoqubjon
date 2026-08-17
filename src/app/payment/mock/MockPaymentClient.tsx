'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard, ShieldCheck, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import { PREMIUM_MONTHLY_AMOUNT_UZS, PREMIUM_PLAN_ID } from '@/lib/plans';

export default function MockPaymentClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success'>('idle');

  const handlePayment = async () => {
    setLoading(true);

    try {
      const response = await fetch('/api/webhooks/mock-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: PREMIUM_PLAN_ID }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setStatus('success');
        setTimeout(() => {
          router.push('/dashboard?payment=success');
        }, 2000);
      } else {
        alert(data.error || 'Payment simulation failed');
      }
    } catch {
      alert('Payment simulation failed');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-12 shadow-2xl border border-slate-200 max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 scale-110 animate-bounce">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-black text-slate-900">Payment Successful!</h1>
          <p className="text-slate-500 font-medium">Your subscription has been activated. Redirecting to your dashboard...</p>
          <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center">
            <span className="text-white font-semibold text-xl">M</span>
          </div>
          <span className="text-2xl font-semibold text-slate-900 tracking-tight">
            MYSATuz <span className="text-blue-600">Pay</span>
          </span>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
          <div className="bg-slate-900 p-8 text-white">
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400 mb-2">Order Summary</p>
            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-xl font-semibold">Premium Pro</h2>
                <p className="text-slate-400 text-sm">Monthly Subscription</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-black text-blue-400">
                  {PREMIUM_MONTHLY_AMOUNT_UZS.toLocaleString()} <span className="text-xs">UZS</span>
                </p>
              </div>
            </div>
          </div>

          <div className="p-8 space-y-6">
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-4">
                <div className="p-2 bg-white rounded-lg shadow-sm">
                  <CreditCard className="w-6 h-6 text-slate-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-widest">Card Holder</p>
                  <p className="text-sm font-semibold text-slate-900">MOCK TEST USER</p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-4">
                <div className="p-2 bg-white rounded-lg shadow-sm">
                  <ShieldCheck className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-widest">Security</p>
                  <p className="text-sm font-semibold text-slate-900">Development simulation</p>
                </div>
              </div>
            </div>

            <button
              onClick={handlePayment}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-2xl font-semibold text-lg transition-all shadow-lg flex items-center justify-center gap-3 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Processing...
                </>
              ) : (
                'Confirm Payment'
              )}
            </button>

            <button
              onClick={() => router.back()}
              className="w-full text-slate-400 font-semibold text-sm hover:text-slate-600 flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Cancel and Return
            </button>
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest flex items-center justify-center gap-2">
              <ShieldCheck className="w-3 h-3" />
              Mock transaction for local testing only
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
