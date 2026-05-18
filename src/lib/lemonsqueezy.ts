import { createHmac, timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/prisma';
import { PREMIUM_PLAN_ID } from '@/lib/plans';

const LEMONSQUEEZY_API_URL = 'https://api.lemonsqueezy.com/v1';
const LEMONSQUEEZY_PROVIDER = 'LEMON_SQUEEZY';

type JsonRecord = Record<string, unknown>;

export class LemonSqueezyConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LemonSqueezyConfigError';
  }
}

export class LemonSqueezyApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'LemonSqueezyApiError';
  }
}

export type LemonSqueezyWebhookResult = {
  eventName: string | null;
  action: 'ignored' | 'payment_recorded' | 'subscription_synced';
  reason?: string;
};

type CreateCheckoutInput = {
  userId: string;
  email: string;
  name?: string | null;
  origin: string;
};

const subscriptionEvents = new Set([
  'subscription_created',
  'subscription_updated',
  'subscription_cancelled',
  'subscription_resumed',
  'subscription_expired',
  'subscription_paused',
  'subscription_unpaused',
  'subscription_plan_changed',
]);

const subscriptionInvoiceEvents = new Set([
  'subscription_payment_success',
  'subscription_payment_failed',
  'subscription_payment_recovered',
  'subscription_payment_refunded',
]);

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function getString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function getInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value);
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.round(parsed) : null;
  }

  return null;
}

function parseDate(value: unknown): Date | null {
  const text = getString(value);
  if (!text) return null;

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function oneMonthFromNow() {
  const date = new Date();
  date.setMonth(date.getMonth() + 1);
  return date;
}

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new LemonSqueezyConfigError(`${name} is not configured`);
  }
  return value;
}

function getCheckoutConfig() {
  return {
    apiKey: requireEnv('LEMONSQUEEZY_API_KEY'),
    storeId: requireEnv('LEMONSQUEEZY_STORE_ID'),
    variantId: requireEnv('LEMONSQUEEZY_PREMIUM_VARIANT_ID'),
    testMode: process.env.LEMONSQUEEZY_TEST_MODE?.toLowerCase() === 'true',
  };
}

function getApiErrorMessage(body: unknown) {
  const record = asRecord(body);
  const errors = Array.isArray(record?.errors) ? record.errors : [];
  const firstError = asRecord(errors[0]);
  return (
    getString(firstError?.detail) ||
    getString(firstError?.title) ||
    getString(record?.message)
  );
}

export async function createLemonSqueezyCheckout(input: CreateCheckoutInput) {
  const config = getCheckoutConfig();
  const successUrl = new URL('/dashboard/subscription?checkout=success', input.origin);

  const checkoutBody = {
    data: {
      type: 'checkouts',
      attributes: {
        checkout_data: {
          email: input.email,
          name: input.name || undefined,
          custom: {
            user_id: input.userId,
            plan_id: PREMIUM_PLAN_ID,
          },
        },
        product_options: {
          redirect_url: successUrl.toString(),
          receipt_button_text: 'Open MYSAT',
          receipt_link_url: successUrl.toString(),
          receipt_thank_you_note: 'Thanks for upgrading your MYSAT account.',
        },
        checkout_options: {
          embed: false,
          media: true,
          logo: true,
        },
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        ...(config.testMode ? { test_mode: true } : {}),
      },
      relationships: {
        store: {
          data: {
            type: 'stores',
            id: config.storeId,
          },
        },
        variant: {
          data: {
            type: 'variants',
            id: config.variantId,
          },
        },
      },
    },
  };

  const response = await fetch(`${LEMONSQUEEZY_API_URL}/checkouts`, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.api+json',
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/vnd.api+json',
    },
    body: JSON.stringify(checkoutBody),
  });

  const responseText = await response.text();
  let responseBody: unknown = null;

  try {
    responseBody = responseText ? JSON.parse(responseText) : null;
  } catch {
    responseBody = responseText;
  }

  if (!response.ok) {
    throw new LemonSqueezyApiError(
      getApiErrorMessage(responseBody) || 'Unable to create Lemon Squeezy checkout',
      response.status
    );
  }

  const responseRecord = asRecord(responseBody);
  const dataRecord = asRecord(responseRecord?.data);
  const attributes = asRecord(dataRecord?.attributes);
  const checkoutUrl = getString(attributes?.url);

  if (!checkoutUrl) {
    throw new LemonSqueezyApiError('Lemon Squeezy did not return a checkout URL', response.status);
  }

  return { url: checkoutUrl };
}

export function verifyLemonSqueezySignature(rawBody: string, signature: string | null) {
  const secret = requireEnv('LEMONSQUEEZY_WEBHOOK_SECRET');
  if (!signature) return false;

  const digest = createHmac('sha256', secret).update(rawBody).digest('hex');
  const digestBuffer = Buffer.from(digest, 'hex');
  const signatureBuffer = Buffer.from(signature, 'hex');

  return (
    digestBuffer.length === signatureBuffer.length &&
    timingSafeEqual(digestBuffer, signatureBuffer)
  );
}

export async function processLemonSqueezyWebhook(
  payload: unknown,
  headerEventName?: string | null
): Promise<LemonSqueezyWebhookResult> {
  const payloadRecord = asRecord(payload);
  const meta = asRecord(payloadRecord?.meta);
  const eventName = getString(meta?.event_name) || getString(headerEventName);

  if (!payloadRecord || !eventName) {
    return { eventName: null, action: 'ignored', reason: 'Missing event name' };
  }

  if (subscriptionEvents.has(eventName)) {
    return syncSubscription(payloadRecord, eventName);
  }

  if (subscriptionInvoiceEvents.has(eventName)) {
    return recordSubscriptionInvoice(payloadRecord, eventName);
  }

  return { eventName, action: 'ignored', reason: 'Event is not used by MYSAT' };
}

function getCustomUserId(payload: JsonRecord) {
  const meta = asRecord(payload.meta);
  const customData = asRecord(meta?.custom_data);
  return getString(customData?.user_id);
}

function inferSubscriptionStatus(eventName: string) {
  switch (eventName) {
    case 'subscription_expired':
      return 'expired';
    case 'subscription_cancelled':
      return 'cancelled';
    case 'subscription_paused':
      return 'paused';
    case 'subscription_resumed':
    case 'subscription_unpaused':
      return 'active';
    default:
      return null;
  }
}

function getSubscriptionExpiresAt(attributes: JsonRecord, status: string | null) {
  const expiresAt =
    parseDate(attributes.ends_at) ||
    parseDate(attributes.renews_at) ||
    parseDate(attributes.trial_ends_at);

  if (expiresAt) return expiresAt;
  return status === 'expired' ? new Date(0) : oneMonthFromNow();
}

function isSubscriptionActive(status: string | null, expiresAt: Date) {
  if (status === 'expired') return false;
  return expiresAt > new Date();
}

async function syncSubscription(payload: JsonRecord, eventName: string) {
  const data = asRecord(payload.data);
  const attributes = asRecord(data?.attributes) || {};
  const providerSubscriptionId = getString(data?.id);

  if (!providerSubscriptionId) {
    return { eventName, action: 'ignored', reason: 'Missing subscription id' } as const;
  }

  const existingSubscription = await prisma.subscription.findUnique({
    where: { providerSubscriptionId },
    select: { userId: true },
  });

  const userId = getCustomUserId(payload) || existingSubscription?.userId;

  if (!userId) {
    return { eventName, action: 'ignored', reason: 'Missing MYSAT user id' } as const;
  }

  if (!existingSubscription) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      return { eventName, action: 'ignored', reason: 'Unknown MYSAT user id' } as const;
    }
  }

  const status = getString(attributes.status) || inferSubscriptionStatus(eventName);
  const expiresAt = getSubscriptionExpiresAt(attributes, status);
  const isActive = isSubscriptionActive(status, expiresAt);
  const providerCustomerId = getString(attributes.customer_id);
  const providerVariantId = getString(attributes.variant_id);

  await prisma.$transaction(async (tx) => {
    const subscription = await tx.subscription.upsert({
      where: { providerSubscriptionId },
      create: {
        userId,
        planId: PREMIUM_PLAN_ID,
        isActive,
        expiresAt,
        provider: LEMONSQUEEZY_PROVIDER,
        providerSubscriptionId,
        providerCustomerId,
        providerVariantId,
        providerStatus: status,
      },
      update: {
        userId,
        planId: PREMIUM_PLAN_ID,
        isActive,
        expiresAt,
        provider: LEMONSQUEEZY_PROVIDER,
        providerCustomerId,
        providerVariantId,
        providerStatus: status,
      },
    });

    if (isActive) {
      await tx.subscription.updateMany({
        where: {
          userId,
          id: { not: subscription.id },
          isActive: true,
        },
        data: { isActive: false },
      });
    }
  });

  return { eventName, action: 'subscription_synced' } as const;
}

function getPaymentStatus(invoiceStatus: string | null, eventName: string) {
  if (eventName === 'subscription_payment_failed') return 'FAILED';
  if (eventName === 'subscription_payment_refunded') return 'REFUNDED';

  switch (invoiceStatus) {
    case 'paid':
      return 'COMPLETED';
    case 'pending':
      return 'PENDING';
    case 'refunded':
      return 'REFUNDED';
    case 'partial_refund':
      return 'PARTIALLY_REFUNDED';
    case 'void':
      return 'FAILED';
    default:
      return eventName === 'subscription_payment_success' ? 'COMPLETED' : 'PENDING';
  }
}

async function recordSubscriptionInvoice(payload: JsonRecord, eventName: string) {
  const data = asRecord(payload.data);
  const attributes = asRecord(data?.attributes) || {};
  const invoiceId = getString(data?.id);
  const providerSubscriptionId = getString(attributes.subscription_id);

  if (!invoiceId) {
    return { eventName, action: 'ignored', reason: 'Missing invoice id' } as const;
  }

  let userId = getCustomUserId(payload);

  if (!userId && providerSubscriptionId) {
    const subscription = await prisma.subscription.findUnique({
      where: { providerSubscriptionId },
      select: { userId: true },
    });
    userId = subscription?.userId || null;
  }

  if (!userId) {
    return { eventName, action: 'ignored', reason: 'Missing invoice user id' } as const;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!user) {
    return { eventName, action: 'ignored', reason: 'Unknown invoice user id' } as const;
  }

  const transactionId = `lemonsqueezy_invoice_${invoiceId}`;
  const status = getPaymentStatus(getString(attributes.status), eventName);
  const amount = getInteger(attributes.total) || 0;
  const currency = (getString(attributes.currency) || 'USD').toUpperCase();

  await prisma.payment.upsert({
    where: { transactionId },
    create: {
      userId,
      amount,
      currency,
      provider: LEMONSQUEEZY_PROVIDER,
      transactionId,
      status,
    },
    update: {
      amount,
      currency,
      status,
    },
  });

  return { eventName, action: 'payment_recorded' } as const;
}
