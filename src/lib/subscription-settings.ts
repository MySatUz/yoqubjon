import { prisma } from '@/lib/prisma';
import { PREMIUM_MONTHLY_AMOUNT_UZS } from '@/lib/plans';

const GLOBAL_SUBSCRIPTION_SETTING_ID = 'global';

export const DEFAULT_SUBSCRIPTION_SETTINGS = {
  isEnabled: true,
  cardHolder: 'Abdunazarov Mardon',
  cardNumber: '9860 1201 0243 8112',
  cardType: 'HUMO',
  amount: PREMIUM_MONTHLY_AMOUNT_UZS,
} as const;

export async function getSubscriptionSettings() {
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
}

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
