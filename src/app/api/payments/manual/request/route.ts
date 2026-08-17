import { NextResponse, after } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import {
  createManualReceiptSignedUrl,
  isTelegramPaymentConfigured,
  notifyManualPaymentTelegram,
  readManualPaymentFields,
  uploadManualReceipt,
} from '@/lib/manual-payments';
import { getSubscriptionSettings } from '@/lib/subscription-settings';

export const runtime = 'nodejs';
// `after()` work runs within the route's max duration, so it has to be set here.
export const maxDuration = 60;

const MANUAL_PAYMENT_DAILY_REQUEST_LIMIT = 5;
const MANUAL_PAYMENT_RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function POST(req: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // None of these four reads depends on another, so they run in one round-trip
    // batch. The checks below stay in the original order so the HTTP status codes
    // (503 -> 400 -> 409 -> 429) are unchanged.
    const [subscriptionSettings, activeSubscription, pendingRequest, recentRequestCount] =
      await Promise.all([
        getSubscriptionSettings(),
        prisma.subscription.findFirst({
          where: {
            userId,
            isActive: true,
            expiresAt: { gt: new Date() },
          },
          select: { id: true },
        }),
        prisma.manualPaymentRequest.findFirst({
          where: {
            userId,
            status: 'PENDING',
          },
          select: { id: true },
        }),
        prisma.manualPaymentRequest.count({
          where: {
            userId,
            createdAt: {
              gte: new Date(Date.now() - MANUAL_PAYMENT_RATE_LIMIT_WINDOW_MS),
            },
          },
        }),
      ]);

    if (!subscriptionSettings.isEnabled) {
      return NextResponse.json(
        { error: 'Subscription purchases are temporarily unavailable' },
        { status: 503 }
      );
    }

    if (activeSubscription) {
      return NextResponse.json(
        { error: 'Subscription is already active' },
        { status: 400 }
      );
    }

    if (pendingRequest) {
      return NextResponse.json(
        { error: 'A payment request is already waiting for review' },
        { status: 409 }
      );
    }

    if (recentRequestCount >= MANUAL_PAYMENT_DAILY_REQUEST_LIMIT) {
      return NextResponse.json(
        { error: 'Too many payment requests. Please try again later.' },
        { status: 429 }
      );
    }

    const formData = await req.formData();
    const receipt = formData.get('receipt');

    if (!(receipt instanceof File)) {
      return NextResponse.json(
        { error: 'Receipt file is required' },
        { status: 400 }
      );
    }

    const requestId = crypto.randomUUID();
    const receiptPath = await uploadManualReceipt({
      requestId,
      userId,
      file: receipt,
    });
    const fields = readManualPaymentFields(formData);

    const manualRequest = await prisma.manualPaymentRequest.create({
      data: {
        id: requestId,
        userId,
        amount: subscriptionSettings.amount,
        currency: 'UZS',
        payerName: fields.payerName,
        contact: fields.contact,
        paymentReference: fields.paymentReference,
        receiptPath,
        receiptFileName: receipt.name,
        receiptMimeType: receipt.type,
        message: fields.message,
      },
    });

    const userEmail = session.user.email;
    const userName = manualRequest.payerName || session.user.name;

    // Signing the receipt URL and calling the Telegram API used to block the
    // response; both now run after it is sent. The request is already persisted,
    // so a failing/slow Telegram never delays or fails the submission.
    after(async () => {
      const receiptUrl = await createManualReceiptSignedUrl(receiptPath, 60 * 60 * 24 * 7);
      const notification = await notifyManualPaymentTelegram({
        requestId: manualRequest.id,
        userEmail,
        userName,
        amount: manualRequest.amount,
        receiptUrl,
        contact: manualRequest.contact,
        paymentReference: manualRequest.paymentReference,
        message: manualRequest.message,
        transfer: {
          cardHolder: subscriptionSettings.cardHolder,
          cardNumber: subscriptionSettings.cardNumber,
          cardType: subscriptionSettings.cardType,
        },
      });

      if (!notification.ok && !notification.skipped) {
        console.warn('Manual payment Telegram notification failed', {
          requestId: manualRequest.id,
        });
      }
    });

    return NextResponse.json({
      success: true,
      requestId: manualRequest.id,
      // Kept for `ManualPaymentForm`, which branches on this field. Since the
      // send now happens after the response, `ok` means "queued" and `skipped`
      // still reports a server without Telegram credentials. The delivery
      // failure branch in the client can no longer be reached.
      notification: { ok: true, skipped: !isTelegramPaymentConfigured() },
    });
  } catch (error) {
    console.error('Manual payment request failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Payment request failed' },
      { status: 500 }
    );
  }
}
