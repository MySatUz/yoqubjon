import {
  LemonSqueezyConfigError,
  processLemonSqueezyWebhook,
  verifyLemonSqueezySignature,
} from '@/lib/lemonsqueezy';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-signature');

  try {
    if (!verifyLemonSqueezySignature(rawBody, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  } catch (error) {
    if (error instanceof LemonSqueezyConfigError) {
      console.error('Lemon Squeezy webhook configuration error:', error.message);
      return NextResponse.json(
        { error: 'Webhook secret is not configured' },
        { status: 503 }
      );
    }

    throw error;
  }

  let payload: unknown;

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    const result = await processLemonSqueezyWebhook(
      payload,
      req.headers.get('x-event-name')
    );

    return NextResponse.json({ received: true, result });
  } catch (error) {
    console.error('Lemon Squeezy webhook error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
