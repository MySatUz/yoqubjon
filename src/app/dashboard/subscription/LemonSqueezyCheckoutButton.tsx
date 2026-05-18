'use client';

import { CreditCard, Loader2 } from 'lucide-react';
import { useState } from 'react';

function getResponseValue(data: unknown, key: 'error' | 'url') {
  return data &&
    typeof data === 'object' &&
    !Array.isArray(data) &&
    key in data &&
    typeof (data as Record<string, unknown>)[key] === 'string'
    ? ((data as Record<string, unknown>)[key] as string)
    : null;
}

export function LemonSqueezyCheckoutButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/payments/lemonsqueezy/checkout', {
        method: 'POST',
      });
      const data: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(getResponseValue(data, 'error') || 'Unable to start checkout');
      }

      const checkoutUrl = getResponseValue(data, 'url');

      if (!checkoutUrl) {
        throw new Error('Checkout URL was not returned');
      }

      window.location.assign(checkoutUrl);
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : 'Unable to start checkout'
      );
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={startCheckout}
        disabled={isLoading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 text-sm font-black text-white shadow-xl shadow-blue-900/50 transition-all hover:bg-blue-500 active:scale-95 disabled:cursor-wait disabled:bg-blue-500"
      >
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        ) : (
          <CreditCard className="h-5 w-5" aria-hidden="true" />
        )}
        {isLoading ? 'Opening checkout' : 'Upgrade with Lemon Squeezy'}
      </button>
      {error && (
        <p role="alert" className="text-center text-xs font-bold text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
