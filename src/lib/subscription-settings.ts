import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { PREMIUM_MONTHLY_AMOUNT_UZS } from '@/lib/plans';

const GLOBAL_SUBSCRIPTION_SETTING_ID = 'global';

/**
 * Invalidate with `revalidateTag(SUBSCRIPTION_SETTINGS_CACHE_TAG, { expire: 0 })`
 * from every action that writes `SubscriptionSetting`, otherwise switching sales
 * off would keep serving the cached "enabled" row.
 */
export const SUBSCRIPTION_SETTINGS_CACHE_TAG = 'subscription-settings';

export type SubscriptionSettings = {
  isEnabled: boolean;
  cardHolder: string;
  cardNumber: string;
  cardType: string;
  amount: number;
};

export const DEFAULT_SUBSCRIPTION_SETTINGS: SubscriptionSettings = {
  isEnabled: true,
  cardHolder: 'Abdunazarov Mardon',
  cardNumber: '9860 1201 0243 8112',
  cardType: 'HUMO',
  amount: PREMIUM_MONTHLY_AMOUNT_UZS,
};

const readSubscriptionSettings = unstable_cache(
  async (): Promise<SubscriptionSettings> => {
    const setting = await prisma.subscriptionSetting.findUnique({
      where: { id: GLOBAL_SUBSCRIPTION_SETTING_ID },
      select: {
        isEnabled: true,
        cardHolder: true,
        cardNumber: true,
        cardType: true,
        amount: true,
      },
    });

    return setting ?? DEFAULT_SUBSCRIPTION_SETTINGS;
  },
  ['subscription-settings'],
  { tags: [SUBSCRIPTION_SETTINGS_CACHE_TAG], revalidate: 300 }
);

// `cache()` collapses repeats inside one request, `unstable_cache` across requests.
export const getSubscriptionSettings = cache(
  async (): Promise<SubscriptionSettings> => readSubscriptionSettings()
);

export async function setSubscriptionEnabled(isEnabled: boolean) {
  return prisma.subscriptionSetting.upsert({
    where: { id: GLOBAL_SUBSCRIPTION_SETTING_ID },
    create: {
      id: GLOBAL_SUBSCRIPTION_SETTING_ID,
      isEnabled,
    },
    update: { isEnabled },
    select: { isEnabled: true },
  });
}

export async function setSubscriptionPaymentSettings(input: {
  cardHolder: string;
  cardNumber: string;
  cardType: string;
  amount: number;
}) {
  return prisma.subscriptionSetting.upsert({
    where: { id: GLOBAL_SUBSCRIPTION_SETTING_ID },
    create: {
      id: GLOBAL_SUBSCRIPTION_SETTING_ID,
      ...input,
    },
    update: input,
    select: {
      cardHolder: true,
      cardNumber: true,
      cardType: true,
      amount: true,
    },
  });
}
