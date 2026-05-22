import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import {
  createManualReceiptSignedUrl,
  MANUAL_TRANSFER_DETAILS,
  notifyManualPaymentTelegram,
  readManualPaymentFields,
  uploadManualReceipt,
} from '@/lib/manual-payments';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
        amount: MANUAL_TRANSFER_DETAILS.amount,
        currency: MANUAL_TRANSFER_DETAILS.currency,
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
