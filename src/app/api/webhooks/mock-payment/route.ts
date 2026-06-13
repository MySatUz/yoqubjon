import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { PREMIUM_MONTHLY_AMOUNT_UZS, PREMIUM_PLAN_ID } from '@/lib/plans';
import { areMockPaymentsEnabled } from '@/lib/mock-payments';

export async function POST(req: NextRequest) {
  if (!areMockPaymentsEnabled()) {
    return NextResponse.json({ error: 'Mock payments disabled' }, { status: 404 });
  }

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const requestedPlanId =
      body &&
      typeof body === 'object' &&
      !Array.isArray(body) &&
      'planId' in body
        ? (body as { planId?: unknown }).planId
        : null;

    if (requestedPlanId !== PREMIUM_PLAN_ID) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1);

    const [payment] = await prisma.$transaction([
      prisma.payment.create({
        data: {
          userId: session.user.id,
          amount: PREMIUM_MONTHLY_AMOUNT_UZS,
          provider: 'MOCK',
          transactionId: `mock_${crypto.randomUUID()}`,
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
          planId: PREMIUM_PLAN_ID,
          isActive: true,
          expiresAt: endDate,
          provider: 'MOCK',
          providerStatus: 'COMPLETED',
        }
      })
    ]);

    return NextResponse.json({ success: true, paymentId: payment.id });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
