import { prisma } from '@/lib/prisma';
import { getSupabaseAdmin } from '@/lib/supabase';
import { PREMIUM_MONTHLY_AMOUNT_UZS, PREMIUM_PLAN_ID } from '@/lib/plans';

export const MANUAL_PAYMENT_BUCKET = 'mysat-payment-receipts';
export const MANUAL_PAYMENT_PROVIDER = 'MANUAL_TRANSFER';
export const MANUAL_PAYMENT_DAYS = 30;
export const MANUAL_RECEIPT_MAX_SIZE = 10 * 1024 * 1024;
export const MANUAL_RECEIPT_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
]);

export function formatManualPaymentAmount(amount = PREMIUM_MONTHLY_AMOUNT_UZS) {
  return `${amount.toLocaleString('en-US').replace(/,/g, ' ')} UZS`;
}

export function sanitizeReceiptFileName(fileName: string) {
  const safe = fileName.trim().replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
  return safe || `${crypto.randomUUID()}.bin`;
}

export async function ensureManualPaymentBucket() {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.createBucket(MANUAL_PAYMENT_BUCKET, {
    public: false,
    allowedMimeTypes: Array.from(MANUAL_RECEIPT_TYPES),
    fileSizeLimit: '10MB',
  });

  if (error && !error.message.toLowerCase().includes('already exists')) {
    throw new Error(`Could not create receipt bucket: ${error.message}`);
  }
}

export async function uploadManualReceipt(input: {
  requestId: string;
  userId: string;
  file: File;
}) {
  const { file, requestId, userId } = input;

  if (file.size <= 0) {
    throw new Error('Receipt file is required');
  }

  if (file.size > MANUAL_RECEIPT_MAX_SIZE) {
    throw new Error('Receipt file must be 10 MB or smaller');
  }

  if (!MANUAL_RECEIPT_TYPES.has(file.type)) {
    throw new Error('Upload PNG, JPG, WebP, or PDF receipt');
  }

  await ensureManualPaymentBucket();

  const safeName = sanitizeReceiptFileName(file.name);
  const path = `${userId}/${requestId}/${safeName}`;
  const { error } = await getSupabaseAdmin().storage
    .from(MANUAL_PAYMENT_BUCKET)
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    throw new Error(`Could not upload receipt: ${error.message}`);
  }

  return path;
}

export async function createManualReceiptSignedUrl(path?: string | null, expiresIn = 60 * 60) {
  if (!path) return null;

  const { data, error } = await getSupabaseAdmin().storage
    .from(MANUAL_PAYMENT_BUCKET)
    .createSignedUrl(path, expiresIn);

  if (error) {
    console.warn('Could not sign manual receipt URL:', error.message);
    return null;
  }

  return data.signedUrl;
}

function trimText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text ? text.slice(0, maxLength) : null;
}

export function readManualPaymentFields(formData: FormData) {
  return {
    payerName: trimText(formData.get('payerName'), 120),
    contact: trimText(formData.get('contact'), 120),
    paymentReference: trimText(formData.get('paymentReference'), 160),
    message: trimText(formData.get('message'), 1000),
  };
}

function escapeTelegramHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function getTelegramAdminBaseUrl() {
  return (
    process.env.TELEGRAM_ADMIN_URL_SAT ||
    process.env.TELEGRAM_ADMIN_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    ''
  ).replace(/\/$/, '');
}

export async function notifyManualPaymentTelegram(input: {
  requestId: string;
  userEmail: string;
  userName?: string | null;
  amount: number;
  receiptUrl?: string | null;
  contact?: string | null;
  paymentReference?: string | null;
  message?: string | null;
  transfer: {
    cardHolder: string;
    cardNumber: string;
    cardType: string;
  };
}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_PAYMENT_CHAT_ID;

  if (!token || !chatId) {
    return { ok: false, skipped: true };
  }

  const adminBaseUrl = getTelegramAdminBaseUrl();
  const adminUrl = adminBaseUrl ? `${adminBaseUrl}/admin` : '';
  const lines = [
    '<b>MYSAT: new manual payment request</b>',
    '',
    `<b>Receiver:</b> ${escapeTelegramHtml(input.transfer.cardHolder)}`,
    `<b>Card:</b> ${escapeTelegramHtml(input.transfer.cardType)} ${escapeTelegramHtml(input.transfer.cardNumber)}`,
    `<b>Amount:</b> ${escapeTelegramHtml(formatManualPaymentAmount(input.amount))}`,
    `<b>Access:</b> ${MANUAL_PAYMENT_DAYS} days`,
    '',
    `<b>User:</b> ${escapeTelegramHtml(input.userName || 'User')}`,
    `<b>Email:</b> ${escapeTelegramHtml(input.userEmail)}`,
    input.contact ? `<b>Contact:</b> ${escapeTelegramHtml(input.contact)}` : null,
    input.paymentReference ? `<b>Payment ID/comment:</b> ${escapeTelegramHtml(input.paymentReference)}` : null,
    '<b>Status:</b> pending',
    `<b>Request:</b> <code>${escapeTelegramHtml(input.requestId)}</code>`,
    input.message ? ['', `<b>Message:</b> ${escapeTelegramHtml(input.message)}`] : null,
    input.receiptUrl ? ['', '<b>Receipt:</b>', escapeTelegramHtml(input.receiptUrl)] : null,
    adminUrl ? ['', `<a href="${escapeTelegramHtml(adminUrl)}">Open admin panel</a>`] : null,
  ].flat().filter(Boolean);
  const linkRow = [
    input.receiptUrl ? { text: 'Open receipt', url: input.receiptUrl } : null,
    adminUrl ? { text: 'Open admin', url: adminUrl } : null,
  ].filter(Boolean);
  const inlineKeyboard = [
    linkRow,
    [
      { text: 'Approve', callback_data: `mysat:approve:${input.requestId}` },
      { text: 'Reject', callback_data: `mysat:reject:${input.requestId}` },
    ],
  ].filter((row) => row.length);

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: lines.join('\n'),
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: inlineKeyboard,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    console.warn('Telegram payment notification failed:', errorText);
    return { ok: false, skipped: false };
  }

  return { ok: true, skipped: false };
}

export async function activateManualSubscription(input: {
  requestId: string;
  adminUserId: string;
  adminNote?: string | null;
}) {
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + MANUAL_PAYMENT_DAYS);

  return prisma.$transaction(async (tx) => {
    const request = await tx.manualPaymentRequest.findUnique({
      where: { id: input.requestId },
      select: { id: true, userId: true, amount: true, currency: true, status: true },
    });

    if (!request) {
      throw new Error('Payment request not found');
    }

    if (request.status !== 'PENDING') {
      throw new Error('Payment request has already been reviewed');
    }

    await tx.manualPaymentRequest.update({
      where: { id: request.id },
      data: {
        status: 'APPROVED',
        adminNote: input.adminNote,
        reviewedById: input.adminUserId,
        reviewedAt: new Date(),
      },
    });

    await tx.payment.create({
      data: {
        userId: request.userId,
        amount: request.amount,
        currency: request.currency,
        provider: MANUAL_PAYMENT_PROVIDER,
        transactionId: `manual_${request.id}`,
        status: 'COMPLETED',
      },
    });

    await tx.subscription.updateMany({
      where: {
        userId: request.userId,
        isActive: true,
      },
      data: { isActive: false },
    });

    await tx.subscription.create({
      data: {
        userId: request.userId,
        planId: PREMIUM_PLAN_ID,
        isActive: true,
        expiresAt: endDate,
        provider: MANUAL_PAYMENT_PROVIDER,
        providerStatus: 'COMPLETED',
      },
    });

    return { success: true, expiresAt: endDate };
  });
}

export async function rejectManualPaymentRequestById(input: {
  requestId: string;
  reviewerId: string;
  adminNote?: string | null;
}) {
  const result = await prisma.manualPaymentRequest.updateMany({
    where: {
      id: input.requestId,
      status: 'PENDING',
    },
    data: {
      status: 'REJECTED',
      adminNote: input.adminNote,
      reviewedById: input.reviewerId,
      reviewedAt: new Date(),
    },
  });

  if (result.count !== 1) {
    throw new Error('Payment request has already been reviewed');
  }

  return { success: true };
}
