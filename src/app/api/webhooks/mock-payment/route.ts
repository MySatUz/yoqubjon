import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_MOCK_PAYMENTS !== 'true') {
    return NextResponse.json({ error: 'Mock payments disabled' }, { status: 404 });
  }

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { transactionId, status, amount, provider } = body;
    const parsedAmount = Number.parseInt(String(amount), 10);

    if (!transactionId || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    if (status === 'PAID') {
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 1); // 1 month subscription

      const [payment] = await prisma.$transaction([
        prisma.payment.create({
          data: {
            userId: session.user.id,
            amount: parsedAmount,
            provider: provider || 'MOCK',
            transactionId,
            status: 'COMPLETED'
          }
        }),
        prisma.subscription.updateMany({
          where: {
            userId: session.user.id,
            isActive: true,
          },
          data: { isActive: false },
        }),
        prisma.subscription.create({
          data: {
            userId: session.user.id,
            planId: 'PREMIUM',
            isActive: true,
            expiresAt: endDate,
          }
        })
      ]);

      return NextResponse.json({ success: true, paymentId: payment.id });
    }

    // Record failed payment
    await prisma.payment.create({
      data: {
        userId: session.user.id,
        amount: parsedAmount,
        provider: provider || 'MOCK',
        transactionId,
        status: 'FAILED'
      }
    });
    return NextResponse.json({ success: false, message: 'Payment failed' });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
