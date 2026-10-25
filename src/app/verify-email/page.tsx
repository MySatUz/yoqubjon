import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import AuthShell, { authAltLinkClass } from '@/components/layout/AuthShell';
import VerifyEmailForm from '@/app/verify-email/VerifyEmailForm';
import { isEmailEnabled } from '@/lib/email';
import { readPendingEmail } from '@/lib/pendingEmail';

export const metadata: Metadata = { title: 'Confirm your email' };

/**
 * Where sign-up (and a sign-in to an unconfirmed account) lands: enter the
 * six-digit code from the email. The address comes from a short-lived cookie
 * set when the code was sent; without it the student types the address too.
 */
export default async function VerifyEmailPage() {
  // Whether email codes are on is read from the environment at request time;
  // prerendered at build, the page would keep the build's answer.
  await connection();
  if (!isEmailEnabled()) redirect('/login');

  const pending = await readPendingEmail();

  return (
    <AuthShell
      altLink={
        <Link href="/login" className={authAltLinkClass}>
          Sign in
        </Link>
      }
    >
      <VerifyEmailForm email={pending?.email ?? null} />
    </AuthShell>
  );
}
