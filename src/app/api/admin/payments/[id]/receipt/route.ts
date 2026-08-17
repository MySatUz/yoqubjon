import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { createManualReceiptSignedUrl } from '@/lib/manual-payments';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RECEIPT_URL_TTL_SECONDS = 60 * 5;

/**
 * Signs a manual payment receipt on demand and redirects to it.
 *
 * `/admin/payments` used to pre-sign a URL for every listed request (up to 120
 * HTTPS calls to Supabase per render) even though the UI shows exactly one link
 * at a time. The page now ships only a `hasReceipt` flag and the admin lands
 * here when the link is actually clicked.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: 'Payment request id is required' }, { status: 400 });
  }

  const paymentRequest = await prisma.manualPaymentRequest.findUnique({
    where: { id },
    select: { receiptPath: true },
  });

  if (!paymentRequest?.receiptPath) {
    return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
  }

  const signedUrl = await createManualReceiptSignedUrl(
    paymentRequest.receiptPath,
    RECEIPT_URL_TTL_SECONDS
  );

  if (!signedUrl) {
    return NextResponse.json({ error: 'Could not create receipt link' }, { status: 502 });
  }

  const response = NextResponse.redirect(signedUrl, 302);
  response.headers.set('Cache-Control', 'no-store');

  return response;
}
