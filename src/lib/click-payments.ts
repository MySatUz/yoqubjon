import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { PREMIUM_MONTHLY_AMOUNT_UZS, PREMIUM_PLAN_ID } from '@/lib/plans';

type ClickParams = Record<string, string>;
type ClickAction = '0' | '1';

const CLICK_PROVIDER = 'CLICK';
const CLICK_SUCCESS = { error: 0, note: 'Success' };
const CLICK_ERRORS = {
  sign: { error: -1, note: 'SIGN CHECK FAILED!' },
  amount: { error: -2, note: 'Incorrect parameter amount' },
  action: { error: -3, note: 'Action not found' },
  alreadyPaid: { error: -4, note: 'Already paid' },
  orderMissing: { error: -5, note: 'User does not exist' },
  transactionMissing: { error: -6, note: 'Transaction does not exist' },
  updateFailed: { error: -7, note: 'Failed to update user' },
  badRequest: { error: -8, note: 'Error in request from click' },
  canceled: { error: -9, note: 'Transaction cancelled' },
};

export class ClickPaymentConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClickPaymentConfigError';
  }
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new ClickPaymentConfigError(`${name} is not configured`);
  return value;
}

function optionalPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function getClickConfig() {
  return {
    merchantId: requiredEnv('CLICK_MERCHANT_ID'),
    merchantUserId: process.env.CLICK_MERCHANT_USER_ID?.trim() || null,
    serviceId: requiredEnv('CLICK_SERVICE_ID'),
    secretKey: requiredEnv('CLICK_SECRET_KEY'),
    amount: optionalPositiveInt(process.env.CLICK_SUBSCRIPTION_AMOUNT, PREMIUM_MONTHLY_AMOUNT_UZS),
    months: optionalPositiveInt(process.env.CLICK_SUBSCRIPTION_MONTHS, 1),
    paymentBaseUrl: process.env.CLICK_PAYMENT_BASE_URL?.trim() || 'https://my.click.uz/services/pay',
  };
}

export function formatClickAmount(value: number | string | bigint) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) throw new Error('Invalid amount');
  return numeric.toFixed(2);
}

function addMonths(date: Date, months: number) {
  const copy = new Date(date.getTime());
  copy.setMonth(copy.getMonth() + months);
  return copy;
}

function clickNumber(value: string | number | bigint | null | undefined) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : value;
}

function md5(value: string) {
  return createHash('md5').update(value).digest('hex');
}

function expectedSignString(params: ClickParams, secretKey: string) {
  if (params.action === '1') {
    return md5(
      `${params.click_trans_id}${params.service_id}${secretKey}${params.merchant_trans_id}${params.merchant_prepare_id}${params.amount}${params.action}${params.sign_time}`
    );
  }

  return md5(
    `${params.click_trans_id}${params.service_id}${secretKey}${params.merchant_trans_id}${params.amount}${params.action}${params.sign_time}`
  );
}

function verifyClickSignature(params: ClickParams) {
  const { secretKey } = getClickConfig();
  return expectedSignString(params, secretKey).toLowerCase() === params.sign_string?.toLowerCase();
}

function requiredClickFields(params: ClickParams) {
  const base = [
    'click_trans_id',
    'service_id',
    'click_paydoc_id',
    'merchant_trans_id',
    'amount',
    'action',
    'error',
    'sign_time',
    'sign_string',
  ];

  return params.action === '1' ? [...base, 'merchant_prepare_id'] : base;
}

function hasRequiredFields(params: ClickParams) {
  return requiredClickFields(params).every((field) => Boolean(params[field]));
}

function amountMatches(orderAmount: number, params: ClickParams) {
  return formatClickAmount(orderAmount) === formatClickAmount(params.amount);
}

function normalizeJsonObject(value: Prisma.JsonValue | null) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Prisma.JsonObject)
    : {};
}

function clickResponse(
  params: ClickParams,
  action: ClickAction,
  error: number,
  errorNote: string,
  order?: { prepareId?: bigint | number | null }
) {
  const payload: Record<string, unknown> = {
    click_trans_id: clickNumber(params.click_trans_id),
    merchant_trans_id: params.merchant_trans_id || null,
    error,
    error_note: errorNote,
  };

  if (action === '0') {
    payload.merchant_prepare_id = order?.prepareId ? Number(order.prepareId) : null;
  } else {
    payload.merchant_confirm_id = order?.prepareId ? Number(order.prepareId) : null;
  }

  return payload;
}

export async function readClickParams(req: Request): Promise<ClickParams> {
  const params: ClickParams = {};
  const url = new URL(req.url);
  url.searchParams.forEach((value, key) => {
    params[key] = value;
  });

  if (req.method === 'GET') return params;

  const contentType = req.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const body: unknown = await req.json().catch(() => ({}));
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      Object.entries(body).forEach(([key, value]) => {
        if (value !== undefined && value !== null) params[key] = String(value);
      });
    }
    return params;
  }

  if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
    const form = await req.formData();
    form.forEach((value, key) => {
      if (typeof value === 'string') params[key] = value;
    });
    return params;
  }

  const raw = await req.text();
  new URLSearchParams(raw).forEach((value, key) => {
    params[key] = value;
  });
  return params;
}

export async function createClickPaymentOrder(input: {
  userId: string;
  userEmail?: string | null;
  origin?: string | null;
}) {
  const config = getClickConfig();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  const order = await prisma.paymentOrder.create({
    data: {
      userId: input.userId,
      provider: CLICK_PROVIDER,
      status: 'PENDING',
      amount: config.amount,
      currency: 'UZS',
      months: config.months,
      expiresAt,
      providerPayload: {
        create: {
          email: input.userEmail,
        },
      },
    },
    select: {
      id: true,
      prepareId: true,
      amount: true,
      months: true,
    },
  });

  const paymentUrl = new URL(config.paymentBaseUrl);
  paymentUrl.searchParams.set('merchant_id', config.merchantId);
  if (config.merchantUserId) paymentUrl.searchParams.set('merchant_user_id', config.merchantUserId);
  paymentUrl.searchParams.set('service_id', config.serviceId);
  paymentUrl.searchParams.set('transaction_param', order.id);
  paymentUrl.searchParams.set('amount', formatClickAmount(order.amount));

  const returnUrl =
    process.env.CLICK_RETURN_URL?.trim() ||
    (input.origin ? `${input.origin.replace(/\/$/, '')}/dashboard/subscription?payment=click-return` : null);
  if (returnUrl) paymentUrl.searchParams.set('return_url', returnUrl);

  return {
    orderId: order.id,
    prepareId: Number(order.prepareId),
    amount: formatClickAmount(order.amount),
    months: order.months,
    paymentUrl: paymentUrl.toString(),
  };
}

async function findOrder(merchantTransId: string) {
  return prisma.paymentOrder.findUnique({
    where: { id: merchantTransId },
  });
}

async function prepareClickPayment(params: ClickParams) {
  const order = await findOrder(params.merchant_trans_id);
  if (!order) {
    return clickResponse(params, '0', CLICK_ERRORS.orderMissing.error, CLICK_ERRORS.orderMissing.note);
  }

  if (order.status === 'PAID') {
    return clickResponse(params, '0', CLICK_ERRORS.alreadyPaid.error, CLICK_ERRORS.alreadyPaid.note, order);
  }

  if (['CANCELED', 'EXPIRED', 'FAILED'].includes(order.status)) {
    return clickResponse(params, '0', CLICK_ERRORS.canceled.error, CLICK_ERRORS.canceled.note, order);
  }

  if (order.expiresAt.getTime() < Date.now()) {
    await prisma.paymentOrder.update({
      where: { id: order.id },
      data: { status: 'EXPIRED' },
    });
    return clickResponse(params, '0', CLICK_ERRORS.orderMissing.error, 'Order expired', order);
  }

  if (!amountMatches(order.amount, params)) {
    return clickResponse(params, '0', CLICK_ERRORS.amount.error, CLICK_ERRORS.amount.note, order);
  }

  await prisma.paymentOrder.update({
    where: { id: order.id },
    data: {
      status: 'PREPARED',
      providerTransactionId: params.click_trans_id,
      providerPaymentId: params.click_paydoc_id,
      providerPrepareId: String(order.prepareId),
      providerError: 0,
      providerErrorNote: CLICK_SUCCESS.note,
      providerPayload: {
        ...normalizeJsonObject(order.providerPayload),
        prepare: params,
      },
    },
  });

  return clickResponse(params, '0', CLICK_SUCCESS.error, CLICK_SUCCESS.note, order);
}

async function activateClickSubscription(input: {
  orderId: string;
  userId: string;
  amount: number;
  months: number;
  params: ClickParams;
}) {
  return prisma.$transaction(async (tx) => {
    const existingSubscription = await tx.subscription.findUnique({
      where: { providerSubscriptionId: input.orderId },
      select: { id: true },
    });
    if (existingSubscription) return existingSubscription.id;

    const now = new Date();
    const activeSubscription = await tx.subscription.findFirst({
      where: {
        userId: input.userId,
        isActive: true,
        expiresAt: { gt: now },
      },
      orderBy: { expiresAt: 'desc' },
      select: { expiresAt: true },
    });

    const baseDate =
      activeSubscription?.expiresAt && activeSubscription.expiresAt.getTime() > now.getTime()
        ? activeSubscription.expiresAt
        : now;
    const expiresAt = addMonths(baseDate, input.months || 1);

    await tx.payment.upsert({
      where: { transactionId: `click_${input.params.click_paydoc_id}` },
      update: {
        status: 'COMPLETED',
      },
      create: {
        userId: input.userId,
        amount: input.amount,
        currency: 'UZS',
        provider: CLICK_PROVIDER,
        transactionId: `click_${input.params.click_paydoc_id}`,
        status: 'COMPLETED',
      },
    });

    await tx.subscription.updateMany({
      where: {
        userId: input.userId,
        isActive: true,
      },
      data: { isActive: false },
    });

    const subscription = await tx.subscription.create({
      data: {
        userId: input.userId,
        planId: PREMIUM_PLAN_ID,
        isActive: true,
        expiresAt,
        provider: CLICK_PROVIDER,
        providerCustomerId: input.userId,
        providerSubscriptionId: input.orderId,
        providerStatus: 'COMPLETED',
      },
      select: { id: true },
    });

    return subscription.id;
  });
}

async function completeClickPayment(params: ClickParams) {
  const order = await findOrder(params.merchant_trans_id);
  if (!order) {
    return clickResponse(params, '1', CLICK_ERRORS.orderMissing.error, CLICK_ERRORS.orderMissing.note);
  }

  if (String(order.prepareId) !== String(params.merchant_prepare_id)) {
    return clickResponse(params, '1', CLICK_ERRORS.transactionMissing.error, CLICK_ERRORS.transactionMissing.note, order);
  }

  if (order.status === 'PAID') {
    return clickResponse(params, '1', CLICK_ERRORS.alreadyPaid.error, CLICK_ERRORS.alreadyPaid.note, order);
  }

  if (['CANCELED', 'EXPIRED', 'FAILED'].includes(order.status)) {
    return clickResponse(params, '1', CLICK_ERRORS.canceled.error, CLICK_ERRORS.canceled.note, order);
  }

  if (Number(params.error) < 0) {
    await prisma.paymentOrder.update({
      where: { id: order.id },
      data: {
        status: 'CANCELED',
        providerError: Number(params.error),
        providerErrorNote: params.error_note || CLICK_ERRORS.canceled.note,
        providerPayload: {
          ...normalizeJsonObject(order.providerPayload),
          complete: params,
        },
      },
    });
    return clickResponse(params, '1', CLICK_ERRORS.canceled.error, CLICK_ERRORS.canceled.note, order);
  }

  if (!amountMatches(order.amount, params)) {
    return clickResponse(params, '1', CLICK_ERRORS.amount.error, CLICK_ERRORS.amount.note, order);
  }

  try {
    const subscriptionId = await activateClickSubscription({
      orderId: order.id,
      userId: order.userId,
      amount: order.amount,
      months: order.months,
      params,
    });

    await prisma.paymentOrder.update({
      where: { id: order.id },
      data: {
        status: 'PAID',
        providerTransactionId: params.click_trans_id,
        providerPaymentId: params.click_paydoc_id,
        providerConfirmId: String(order.prepareId),
        providerError: 0,
        providerErrorNote: CLICK_SUCCESS.note,
        paidAt: new Date(),
        providerPayload: {
          ...normalizeJsonObject(order.providerPayload),
          complete: params,
          subscription_id: subscriptionId,
        },
      },
    });
  } catch (error) {
    console.error('Click complete failed:', error);
    return clickResponse(params, '1', CLICK_ERRORS.updateFailed.error, CLICK_ERRORS.updateFailed.note, order);
  }

  return clickResponse(params, '1', CLICK_SUCCESS.error, CLICK_SUCCESS.note, order);
}

export async function handleClickCallback(params: ClickParams) {
  if (params.action !== '0' && params.action !== '1') {
    return clickResponse(params, '0', CLICK_ERRORS.action.error, CLICK_ERRORS.action.note);
  }

  const action = params.action;
  if (!hasRequiredFields(params)) {
    return clickResponse(params, action, CLICK_ERRORS.badRequest.error, CLICK_ERRORS.badRequest.note);
  }

  const { serviceId } = getClickConfig();
  if (String(params.service_id) !== serviceId) {
    return clickResponse(params, action, CLICK_ERRORS.badRequest.error, CLICK_ERRORS.badRequest.note);
  }

  if (!verifyClickSignature(params)) {
    return clickResponse(params, action, CLICK_ERRORS.sign.error, CLICK_ERRORS.sign.note);
  }

  return action === '0' ? prepareClickPayment(params) : completeClickPayment(params);
}
