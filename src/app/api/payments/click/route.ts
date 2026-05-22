import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  ClickPaymentConfigError,
  createClickPaymentOrder,
  handleClickCallback,
  readClickParams,
} from '@/lib/click-payments';

export const runtime = 'nodejs';

function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

async function handleRequest(req: Request) {
  try {
    const params = await readClickParams(req);

    if (params.action === 'create') {
      const session = await auth();
      if (!session?.user?.id) {
        return json({ error: 'Unauthorized' }, { status: 401 });
      }

      const order = await createClickPaymentOrder({
        userId: session.user.id,
        userEmail: session.user.email,
        origin: req.headers.get('origin'),
      });

      return json(order);
    }

    if (params.click_trans_id || params.merchant_trans_id) {
      const result = await handleClickCallback(params);
      return json(result);
    }

    return json({ error: 'Unknown request' }, { status: 400 });
  } catch (error) {
    if (error instanceof ClickPaymentConfigError) {
      console.error('Click payment configuration error:', error.message);
      return json({ error: 'Click payments are not configured' }, { status: 500 });
    }

    console.error('Click payment error:', error);
    return json(
      { error: error instanceof Error ? error.message : 'Payment request failed' },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  return handleRequest(req);
}

export async function POST(req: Request) {
  return handleRequest(req);
}
