import type { Metadata } from 'next';
import Link from 'next/link';
import { connection } from 'next/server';
import AuthShell, { authAltLinkClass, authLinkClass } from '@/components/layout/AuthShell';
import ResetPasswordForm from '@/app/reset-password/ResetPasswordForm';
import { Card } from '@/components/ui/Card';
import { isEmailEnabled } from '@/lib/email';
import { TELEGRAM_URL } from '@/lib/landing/warmup';

// noindex: a step inside a flow, not a page anyone should land on from search.
export const metadata: Metadata = { title: 'Reset password', robots: { index: false } };

/** A code by email, then a new password. Without email set up, the way back is Telegram. */
export default async function ResetPasswordPage() {
  // See verify-email: the email switch is read per request, not at build.
  await connection();
  return (
    <AuthShell
      altLink={
        <Link href="/login" className={authAltLinkClass}>
          Sign in
        </Link>
      }
    >
      {isEmailEnabled() ? (
        <ResetPasswordForm />
      ) : (
        <Card padded>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900 sm:text-2xl">Reset your password</h1>
          <p className="mt-1.5 text-sm text-gray-600">
            Write to us in{' '}
            <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className={authLinkClass}>
              Telegram<span className="sr-only"> (opens Telegram)</span>
            </a>{' '}
            from the account you study with, and we will set a new password for you.
          </p>
        </Card>
      )}
    </AuthShell>
  );
}
