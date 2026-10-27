'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { AlertCircle, CircleCheck, Loader2 } from 'lucide-react';
import {
  updateSubscriptionAvailability,
  updateSubscriptionPaymentSettings,
} from '@/app/admin/subscription-settings-actions';
import { Badge } from '@/components/ui/Badge';
import { buttonClass, focusRingClass } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useConfirm } from '@/components/ui/Dialog';
import { Alert } from '@/components/ui/Feedback';
import { Field, inputClass } from '@/components/ui/Field';
import { cn } from '@/components/ui/cn';

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
  const { confirm, dialog } = useConfirm();

  async function toggleAvailability() {
    const nextEnabled = !isEnabled;
    // Closing stops every student's payments at once, so it is asked first;
    // opening again needs no question.
    if (!nextEnabled) {
      const isSure = await confirm({
        title: 'Close Premium sales?',
        description: 'Students see that new subscriptions are paused instead of the card details, and cannot send payment requests until you open sales again. Requests already sent stay under Payment requests.',
        confirmLabel: 'Close sales',
        cancelLabel: 'Keep sales open',
        // Not destructive, so not red, but an Enter pressed out of habit must
        // not stop every student's payments.
        initialFocus: 'cancel',
      });
      if (!isSure) return;
    }
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

  // Rendered at the top of the student Subscription page, for admins only — the
  // badge says so, since everything around it is what students see.
  return (
    <Card as="section">
      <div className="flex items-center justify-between gap-4 px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-gray-900">
              {isEnabled ? 'Premium sales are open' : 'Premium sales are closed'}
            </h2>
            <Badge tone="accent">Admins only</Badge>
          </div>
          <p className="mt-0.5 text-sm text-gray-500">
            {isEnabled
              ? 'Students see the transfer details and can send payment receipts.'
              : 'Students see that new subscriptions are paused. Card details and new payment requests are hidden.'}
          </p>
        </div>

        {/* The word beside the track makes the switch a target a finger can
            find and says its state without colour; the switch's name stays
            the same either way, its state is aria-checked. */}
        <button
          type="button"
          role="switch"
          aria-checked={isEnabled}
          aria-label="Premium sales open to students"
          disabled={isToggling}
          onClick={() => void toggleAvailability()}
          className={cn(
            'inline-flex h-8 shrink-0 items-center gap-2 rounded-lg text-sm font-medium text-gray-700 pointer-coarse:h-10',
            focusRingClass,
            // While saving, the spinner in the knob says so; no fade, which would
            // turn the accent into an off-palette pastel.
            'disabled:cursor-wait',
          )}
        >
          <span
            className={cn(
              'inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors',
              isEnabled ? 'bg-ink-600' : 'bg-gray-300',
            )}
          >
            <span
              className={cn(
                'inline-flex h-4 w-4 items-center justify-center rounded-full bg-white text-gray-500 transition-transform',
                isEnabled ? 'translate-x-4' : 'translate-x-0',
              )}
            >
              {isToggling ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            </span>
          </span>
          <span aria-hidden className="w-12 text-left">{isEnabled ? 'Open' : 'Closed'}</span>
        </button>
      </div>

      {error && (
        <div className="px-5 pb-4">
          <Alert tone="danger">{error}</Alert>
        </div>
      )}

      {canEditPaymentSettings && initialPaymentSettings && (
        <div className="border-t border-gray-100 px-5 py-4">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-gray-900">Payment details</h3>
              <p className="mt-0.5 text-sm text-gray-500">
                These values appear on the student subscription page and in new payment requests.
              </p>
            </div>
            <Badge>Owner only</Badge>
          </div>

          <form onSubmit={savePaymentSettings} className="space-y-4">
            {/* Four across only at xl: at lg a quarter-width field clips a full card number. */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Field label="Card holder" htmlFor="payment-card-holder">
                <input
                  id="payment-card-holder"
                  name="cardHolder"
                  defaultValue={initialPaymentSettings.cardHolder}
                  required
                  maxLength={120}
                  autoComplete="off"
                  className={inputClass()}
                />
              </Field>

              <Field label="Card number" htmlFor="payment-card-number">
                <input
                  id="payment-card-number"
                  name="cardNumber"
                  defaultValue={initialPaymentSettings.cardNumber}
                  required
                  maxLength={40}
                  inputMode="numeric"
                  autoComplete="off"
                  className={inputClass({ className: 'font-mono tabular-nums' })}
                />
              </Field>

              <Field label="Card type" htmlFor="payment-card-type">
                <input
                  id="payment-card-type"
                  name="cardType"
                  defaultValue={initialPaymentSettings.cardType}
                  required
                  maxLength={30}
                  autoComplete="off"
                  placeholder="HUMO, Uzcard, Visa..."
                  className={inputClass()}
                />
              </Field>

              <Field label="Monthly price (UZS)" htmlFor="payment-amount">
                <input
                  id="payment-amount"
                  name="amount"
                  type="number"
                  defaultValue={initialPaymentSettings.amount}
                  required
                  min={1000}
                  max={1000000000}
                  step={1000}
                  inputMode="numeric"
                  className={inputClass({ className: 'tabular-nums' })}
                />
              </Field>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3">
              {saved && (
                <p role="status" className="mr-auto inline-flex items-center gap-1.5 text-sm text-green-800">
                  <CircleCheck className="h-4 w-4" />
                  Payment settings saved.
                </p>
              )}
              {saveError && (
                <p role="alert" className="mr-auto inline-flex items-center gap-1.5 text-sm text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  {saveError}
                </p>
              )}
              <button type="submit" disabled={isSaving} className={buttonClass()}>
                {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSaving ? 'Saving' : 'Save payment details'}
              </button>
            </div>
          </form>
        </div>
      )}
      {dialog}
    </Card>
  );
}
