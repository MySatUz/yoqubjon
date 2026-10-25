import type { Metadata } from 'next';
import Link from 'next/link';
import AuthShell, { authAltLinkClass } from '@/components/layout/AuthShell';
import LoginForm from '@/app/login/LoginForm';
import { isEmailEnabled } from '@/lib/email';
import { safeCallbackUrl } from '@/lib/safeRedirect';

export const metadata: Metadata = { title: 'Sign in' };

/**
 * A server page around the client form, so it can name the tab and read where
 * the student was going (`callbackUrl`, set by src/proxy.ts and by the exam on
 * an expired session) and hand it to the form.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const rawCallback = typeof params.callbackUrl === 'string' ? params.callbackUrl : undefined;
  const callbackUrl = safeCallbackUrl(rawCallback);
  const registerHref = rawCallback ? `/register?callbackUrl=${encodeURIComponent(callbackUrl)}` : '/register';

  return (
    <AuthShell
      altLink={
        <Link href={registerHref} className={authAltLinkClass}>
          Create account
        </Link>
      }
    >
      <LoginForm
        callbackUrl={callbackUrl}
        cameFromLink={Boolean(rawCallback) && callbackUrl !== '/dashboard'}
        canResetByEmail={isEmailEnabled()}
        registerHref={registerHref}
      />
    </AuthShell>
  );
}
