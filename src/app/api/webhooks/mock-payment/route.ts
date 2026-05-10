import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { transactionId, status, userId, amount, provider } = body;

    if (!transactionId || !userId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    if (status === 'PAID') {
      // 1. Record the payment
      const payment = await prisma.payment.create({
        data: {
          userId,
          amount: parseFloat(amount),
          provider: provider || 'MOCK',
          transactionId,
          status: 'COMPLETED'
        }
      });

      // 2. Grant subscription
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 1); // 1 month subscription

      await prisma.subscription.create({
        data: {
          userId,
          planId: 'PREMIUM',
          isActive: true,
          expiresAt: endDate,
        }
      });

      return NextResponse.json({ success: true, paymentId: payment.id });
    } else {
      // Record failed payment
      await prisma.payment.create({
        data: {
          userId,
          amount: parseFloat(amount),
          provider: provider || 'MOCK',
          transactionId,
          status: 'FAILED'
        }
      });
      return NextResponse.json({ success: false, message: 'Payment failed' });
    }
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
