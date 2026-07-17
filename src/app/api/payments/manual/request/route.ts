import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import {
  createManualReceiptSignedUrl,
  notifyManualPaymentTelegram,
  readManualPaymentFields,
  uploadManualReceipt,
} from '@/lib/manual-payments';
import { getSubscriptionSettings } from '@/lib/subscription-settings';

export const runtime = 'nodejs';

const MANUAL_PAYMENT_DAILY_REQUEST_LIMIT = 5;
const MANUAL_PAYMENT_RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function POST(req: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const subscriptionSettings = await getSubscriptionSettings();

    if (!subscriptionSettings.isEnabled) {
      return NextResponse.json(
        { error: 'Subscription purchases are temporarily unavailable' },
        { status: 503 }
      );
    }

    const activeSubscription = await prisma.subscription.findFirst({
      where: {
        userId: session.user.id,
        isActive: true,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });

    if (activeSubscription) {
      return NextResponse.json(
        { error: 'Subscription is already active' },
        { status: 400 }
      );
    }

    const pendingRequest = await prisma.manualPaymentRequest.findFirst({
      where: {
        userId: session.user.id,
        status: 'PENDING',
      },
      select: { id: true },
    });

    if (pendingRequest) {
      return NextResponse.json(
        { error: 'A payment request is already waiting for review' },
        { status: 409 }
      );
    }

    const recentRequestCount = await prisma.manualPaymentRequest.count({
      where: {
        userId: session.user.id,
        createdAt: {
          gte: new Date(Date.now() - MANUAL_PAYMENT_RATE_LIMIT_WINDOW_MS),
        },
      },
    });

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
      userId: session.user.id,
      file: receipt,
    });
    const fields = readManualPaymentFields(formData);

    const manualRequest = await prisma.manualPaymentRequest.create({
      data: {
        id: requestId,
        userId: session.user.id,
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

    const receiptUrl = await createManualReceiptSignedUrl(receiptPath, 60 * 60 * 24 * 7);
    const notification = await notifyManualPaymentTelegram({
      requestId: manualRequest.id,
      userEmail: session.user.email,
      userName: manualRequest.payerName || session.user.name,
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

    return NextResponse.json({
      success: true,
      requestId: manualRequest.id,
      notification,
    });
  } catch (error) {
    console.error('Manual payment request failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Payment request failed' },
      { status: 500 }
    );
  }
}
