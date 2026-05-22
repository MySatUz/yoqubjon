'use client';

import { CreditCard, Loader2 } from 'lucide-react';
import { useState } from 'react';

function getResponseValue(data: unknown, key: 'error' | 'paymentUrl') {
  return data &&
    typeof data === 'object' &&
    !Array.isArray(data) &&
    key in data &&
    typeof (data as Record<string, unknown>)[key] === 'string'
    ? ((data as Record<string, unknown>)[key] as string)
    : null;
}

export function ClickPaymentButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startPayment() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/payments/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create' }),
      });
      const data: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(getResponseValue(data, 'error') || 'Could not start Click payment');
      }

      const paymentUrl = getResponseValue(data, 'paymentUrl');
      if (!paymentUrl) {
        throw new Error('Click payment URL was not returned');
      }

      window.location.assign(paymentUrl);
    } catch (paymentError) {
      setError(
        paymentError instanceof Error
          ? paymentError.message
          : 'Could not start Click payment'
      );
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={startPayment}
        disabled={isLoading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 text-sm font-black text-white shadow-xl shadow-blue-900/50 transition-all hover:bg-blue-500 active:scale-95 disabled:cursor-wait disabled:bg-blue-500"
      >
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        ) : (
          <CreditCard className="h-5 w-5" aria-hidden="true" />
        )}
        {isLoading ? 'Opening Click' : 'Pay with Click'}
      </button>
      {error && (
        <p role="alert" className="text-center text-xs font-bold text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
