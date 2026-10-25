import type { Metadata } from 'next';
import Link from 'next/link';
import AuthShell, { authAltLinkClass } from '@/components/layout/AuthShell';
import RegisterForm from '@/app/register/RegisterForm';
import { safeCallbackUrl } from '@/lib/safeRedirect';

export const metadata: Metadata = { title: 'Create your account' };

/**
 * `?from=premium` comes from the landing's "Go Premium": after sign-up that
 * student wants the subscription page, not the catalog. `callbackUrl` is a page
 * the student was sent away from (see src/proxy.ts).
 */
export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const callbackUrl =
    params.from === 'premium'
      ? '/dashboard/subscription'
      : safeCallbackUrl(typeof params.callbackUrl === 'string' ? params.callbackUrl : undefined);
  const loginHref = callbackUrl !== '/dashboard' ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}` : '/login';

  return (
    <AuthShell
      altLink={
        <Link href={loginHref} className={authAltLinkClass}>
          Sign in
        </Link>
      }
    >
      <RegisterForm callbackUrl={callbackUrl} loginHref={loginHref} />
    </AuthShell>
  );
}
