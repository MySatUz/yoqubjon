'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { CircleCheck, CreditCard, Crown, Loader2, LockKeyhole, Save } from 'lucide-react';
import {
  updateSubscriptionAvailability,
  updateSubscriptionPaymentSettings,
} from '@/app/admin/subscription-settings-actions';

type PaymentSettings = {
  cardHolder: string;
  cardNumber: string;
  cardType: string;
  amount: number;
};

type SubscriptionAvailabilityControlProps = {
  initialEnabled: boolean;
  canEditPaymentSettings: boolean;
  initialPaymentSettings: PaymentSettings | null;
};

export default function SubscriptionAvailabilityControl({
  initialEnabled,
  canEditPaymentSettings,
  initialPaymentSettings,
}: SubscriptionAvailabilityControlProps) {
  const [isEnabled, setIsEnabled] = useState(initialEnabled);
  const [isToggling, startToggleTransition] = useTransition();
  const [isSaving, startSaveTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function toggleAvailability() {
    const nextEnabled = !isEnabled;
    setError(null);
    setIsEnabled(nextEnabled);

    startToggleTransition(async () => {
      const result = await updateSubscriptionAvailability(nextEnabled);

      if (!result.success) {
        setIsEnabled(!nextEnabled);
        setError(result.error || 'Could not update subscription status');
        return;
      }

      setIsEnabled(result.isEnabled ?? nextEnabled);
    });
  }

  function savePaymentSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveError(null);
    setSaved(false);
    const formData = new FormData(event.currentTarget);

    startSaveTransition(async () => {
      const result = await updateSubscriptionPaymentSettings(formData);

      if (!result.success) {
        setSaveError(result.error || 'Could not save payment settings');
        return;
      }

      setSaved(true);
    });
  }

  return (
    <section
      className={`mb-6 overflow-hidden rounded-2xl border p-6 shadow-sm transition-colors sm:p-7 ${
        isEnabled
          ? 'border-emerald-200 bg-emerald-50/70'
          : 'border-amber-200 bg-amber-50/80'
      }`}
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <span
            className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
              isEnabled ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'
            }`}
          >
            {isEnabled ? <CircleCheck className="h-6 w-6" /> : <LockKeyhole className="h-6 w-6" />}
          </span>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-slate-500">
              Subscription availability
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
              {isEnabled ? 'Subscription section is open' : 'Subscription section is closed'}
            </h2>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-relaxed text-slate-600">
              {isEnabled
                ? 'Students can see the transfer details and send payment receipts.'
                : 'Students see a temporary closure notice. Card details and new payment requests are blocked.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={isEnabled}
          aria-label="Toggle subscription section"
          disabled={isToggling}
          onClick={toggleAvailability}
          className={`relative inline-flex h-12 w-24 shrink-0 items-center rounded-full p-1.5 shadow-inner transition-colors focus:outline-none focus:ring-4 disabled:cursor-wait disabled:opacity-70 ${
            isEnabled
              ? 'bg-emerald-600 focus:ring-emerald-200'
              : 'bg-slate-400 focus:ring-slate-200'
          }`}
        >
          <span
            className={`inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm transition-transform ${
              isEnabled ? 'translate-x-12' : 'translate-x-0'
            }`}
          >
            {isToggling ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          </span>
        </button>
      </div>

      {error && (
        <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </p>
      )}

      {canEditPaymentSettings && initialPaymentSettings && (
        <div className="mt-7 border-t border-slate-900/10 pt-7">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white">
                <CreditCard className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-lg font-semibold tracking-tight text-slate-900">Payment details</h3>
                <p className="mt-1 text-sm font-semibold text-slate-600">
                  These values appear on the student subscription page and in new payment requests.
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1.5 text-[10px] font-medium uppercase tracking-widest text-white">
              <Crown className="h-3.5 w-3.5 text-amber-300" />
              Owner only
            </span>
          </div>

          <form onSubmit={savePaymentSettings} className="grid gap-4 lg:grid-cols-2">
            <label className="space-y-2">
              <span className="text-[10px] font-medium uppercase tracking-widest text-slate-500">Card holder</span>
              <input
                name="cardHolder"
                defaultValue={initialPaymentSettings.cardHolder}
                required
                maxLength={120}
                autoComplete="off"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </label>

            <label className="space-y-2">
              <span className="text-[10px] font-medium uppercase tracking-widest text-slate-500">Card number</span>
              <input
                name="cardNumber"
                defaultValue={initialPaymentSettings.cardNumber}
                required
                maxLength={40}
                inputMode="numeric"
                autoComplete="off"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-mono text-sm font-semibold tracking-wider text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </label>

            <label className="space-y-2">
              <span className="text-[10px] font-medium uppercase tracking-widest text-slate-500">Card type</span>
              <input
                name="cardType"
                defaultValue={initialPaymentSettings.cardType}
                required
                maxLength={30}
                autoComplete="off"
                placeholder="HUMO, Uzcard, Visa..."
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </label>

            <label className="space-y-2">
              <span className="text-[10px] font-medium uppercase tracking-widest text-slate-500">Monthly price (UZS)</span>
              <input
                name="amount"
                type="number"
                defaultValue={initialPaymentSettings.amount}
                required
                min={1000}
                max={1000000000}
                step={1000}
                inputMode="numeric"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </label>

            <div className="flex flex-col gap-3 lg:col-span-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-h-6">
                {saved && (
                  <p className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
                    <CircleCheck className="h-4 w-4" />
                    Payment settings saved.
                  </p>
                )}
                {saveError && <p className="text-sm font-semibold text-red-700">{saveError}</p>}
              </div>
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-blue-600 disabled:cursor-wait disabled:opacity-60"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {isSaving ? 'Saving' : 'Save payment details'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
