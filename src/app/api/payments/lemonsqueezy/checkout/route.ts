import { auth } from '@/auth';
import {
  createLemonSqueezyCheckout,
  LemonSqueezyApiError,
  LemonSqueezyConfigError,
} from '@/lib/lemonsqueezy';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

function getAppOrigin(req: NextRequest) {
  const configuredOrigin =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL;

  if (configuredOrigin) {
    return new URL(configuredOrigin).origin;
  }

  return req.nextUrl.origin;
}

export async function POST(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const checkout = await createLemonSqueezyCheckout({
      userId: session.user.id,
      email: session.user.email,
      name: session.user.name,
      origin: getAppOrigin(req),
    });

    return NextResponse.json(checkout);
  } catch (error) {
    if (error instanceof LemonSqueezyConfigError) {
      console.error('Lemon Squeezy configuration error:', error.message);
      return NextResponse.json(
        { error: 'Payment provider is not configured' },
        { status: 503 }
      );
    }

    if (error instanceof LemonSqueezyApiError) {
      console.error('Lemon Squeezy checkout error:', error.message);
      return NextResponse.json(
        { error: 'Unable to start checkout' },
        { status: error.status >= 500 ? 502 : 400 }
      );
    }

    console.error('Checkout error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
