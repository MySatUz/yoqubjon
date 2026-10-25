import { NextResponse, after } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import {
  MANUAL_RECEIPT_MAX_SIZE,
  MANUAL_RECEIPT_TYPES,
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

// ManualPaymentForm shows a 4xx `error` to the student as it is, so each one
// is a sentence for them. A 5xx is never shown; its detail stays in the log.
const SERVER_ERROR_MESSAGE = 'The payment request could not be saved. Try again in a minute.';

export async function POST(req: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json({ error: 'Your session has ended. Sign in again to send the request.' }, { status: 401 });
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
        { error: 'New Premium subscriptions are paused for now.' },
        { status: 503 }
      );
    }

    if (activeSubscription) {
      return NextResponse.json(
        { error: 'Your subscription is already active.' },
        { status: 400 }
      );
    }

    if (pendingRequest) {
      return NextResponse.json(
        { error: 'A payment request is already waiting for review.' },
        { status: 409 }
      );
    }

    if (recentRequestCount >= MANUAL_PAYMENT_DAILY_REQUEST_LIMIT) {
      return NextResponse.json(
        { error: 'Too many payment requests in the last 24 hours. Try again later.' },
        { status: 429 }
      );
    }

    const formData = await req.formData();
    const receipt = formData.get('receipt');

    if (!(receipt instanceof File) || receipt.size <= 0) {
      return NextResponse.json(
        { error: 'Choose the receipt file to upload.' },
        { status: 400 }
      );
    }

    // uploadManualReceipt refuses these too, but by throwing, which lands in
    // the 500 path and tells the student only to try again. They can fix
    // these themselves, so they get the reason. No number in the size one:
    // the form states the lower limit the host allows (ManualPaymentForm).
    if (receipt.size > MANUAL_RECEIPT_MAX_SIZE) {
      return NextResponse.json(
        { error: 'The receipt file is too large. Try a screenshot or a PDF.' },
        { status: 400 }
      );
    }

    if (!MANUAL_RECEIPT_TYPES.has(receipt.type)) {
      return NextResponse.json(
        { error: 'Upload the receipt as a PNG, JPG, WebP or PDF file.' },
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

    if (!isTelegramPaymentConfigured()) {
      // Saved, but no admin is pinged: without this line nothing says why a
      // request sits unseen until someone opens the admin queue.
      console.warn('Manual payment saved; Telegram notification is not configured', {
        requestId: manualRequest.id,
      });
    }

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

    // No `notification` field any more: ManualPaymentForm shows one
    // confirmation whatever happens to the admin's Telegram ping, and the
    // send runs after this response anyway.
    return NextResponse.json({
      success: true,
      requestId: manualRequest.id,
    });
  } catch (error) {
    // A storage or database message is for the log, not for the student.
    console.error('Manual payment request failed:', error);
    return NextResponse.json({ error: SERVER_ERROR_MESSAGE }, { status: 500 });
  }
}
