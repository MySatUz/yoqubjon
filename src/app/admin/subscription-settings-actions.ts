'use server';

import { refresh, revalidateTag } from 'next/cache';
import { requireAdmin, requireOwnerAdmin } from '@/lib/admin';
import {
  SUBSCRIPTION_SETTINGS_CACHE_TAG,
  setSubscriptionEnabled,
  setSubscriptionPaymentSettings,
} from '@/lib/subscription-settings';

export async function updateSubscriptionAvailability(isEnabled: boolean) {
  try {
    await requireAdmin();

    if (typeof isEnabled !== 'boolean') {
      return { success: false, error: 'Invalid subscription status' };
    }

    const setting = await setSubscriptionEnabled(isEnabled);

    // Must expire immediately: switching sales off has to take effect on the
    // next request, not after a stale-while-revalidate round.
    revalidateTag(SUBSCRIPTION_SETTINGS_CACHE_TAG, { expire: 0 });
    // Runs only on the success path, so a failed toggle still returns without a
    // re-render and the control keeps its own rollback.
    refresh();

    return { success: true, isEnabled: setting.isEnabled };
  } catch (error) {
    console.error('Update subscription availability failed:', error);
    return { success: false, error: 'Could not update subscription status' };
  }
}

function requiredText(formData: FormData, key: string, label: string, maxLength: number) {
  const value = formData.get(key);

  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} is required`);
  }

  return value.trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

export async function updateSubscriptionPaymentSettings(formData: FormData) {
  try {
    await requireOwnerAdmin();

    const cardHolder = requiredText(formData, 'cardHolder', 'Card holder', 120);
    const cardNumber = requiredText(formData, 'cardNumber', 'Card number', 40);
    const cardType = requiredText(formData, 'cardType', 'Card type', 30);
    const amountValue = formData.get('amount');
    const amount = typeof amountValue === 'string' ? Number(amountValue) : Number.NaN;
    const cardDigits = cardNumber.replace(/\D/g, '');

    if (cardDigits.length < 12 || cardDigits.length > 20) {
      return { success: false, error: 'Enter a valid card number' };
    }

    if (!Number.isInteger(amount) || amount < 1_000 || amount > 1_000_000_000) {
      return { success: false, error: 'Enter a valid monthly price in UZS' };
    }

    const setting = await setSubscriptionPaymentSettings({
      cardHolder,
      cardNumber,
      cardType,
      amount,
    });

    revalidateTag(SUBSCRIPTION_SETTINGS_CACHE_TAG, { expire: 0 });
    refresh();

    return { success: true, settings: setting };
  } catch (error) {
    console.error('Update subscription payment settings failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Could not save payment settings',
    };
  }
}
