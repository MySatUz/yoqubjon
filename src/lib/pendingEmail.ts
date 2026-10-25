import { cookies } from 'next/headers';
import { safeCallbackUrl } from '@/lib/safeRedirect';

/*
 * The address a confirmation code was just sent to, where to go once it is
 * entered, and the secret that binds the code to this browser (its hash is on
 * the PendingEmailVerification row). An httpOnly cookie rather than the URL,
 * so neither the email nor the secret lands in browser history or server logs.
 */
const PENDING_COOKIE = 'mysat_pending_email';

export async function rememberPendingEmail(email: string, callbackUrl: string, secret: string) {
  (await cookies()).set(PENDING_COOKIE, new URLSearchParams({ email, callbackUrl, secret }).toString(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60,
  });
}

export async function readPendingEmail() {
  const raw = (await cookies()).get(PENDING_COOKIE)?.value;
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  const email = params.get('email') ?? '';
  return email
    ? { email, callbackUrl: safeCallbackUrl(params.get('callbackUrl')), secret: params.get('secret') ?? '' }
    : null;
}

export async function clearPendingEmail() {
  (await cookies()).delete(PENDING_COOKIE);
}
