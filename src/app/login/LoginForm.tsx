'use client';

import React, { useActionState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { login } from '@/lib/auth-actions';
import { Card } from '@/components/ui/Card';
import { Field, Input } from '@/components/ui/Field';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { Button, linkClass } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Feedback';
import { cn } from '@/components/ui/cn';
import { authLinkClass } from '@/components/layout/AuthShell';
import SlopeToGoal from '@/components/landing/SlopeToGoal';
import { TELEGRAM_URL } from '@/lib/landing/warmup';

/* The app's text link, underlined like every link in copy. py-1 gives the
   14px line a taller target without moving it. */
const forgotLinkClass = cn(linkClass, '-my-1 py-1 text-sm');

/**
 * `useActionState` with the form's own `action`, not an onSubmit handler: the
 * form is a real POST from the first paint, so an Enter pressed before the page
 * hydrates (a slow phone, a password manager) no longer sends the password as
 * a GET query string. Errors come back with the field they belong to and are
 * shown under it; the field gets focus.
 */
export default function LoginForm({
  callbackUrl,
  cameFromLink,
  canResetByEmail,
  registerHref,
}: {
  callbackUrl: string;
  cameFromLink: boolean;
  canResetByEmail: boolean;
  registerHref: string;
}) {
  const [state, formAction, pending] = useActionState(login, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.field) formRef.current?.querySelector<HTMLInputElement>(`#${state.field}`)?.focus();
  }, [state]);

  const fieldError = (field: 'email' | 'password') => (state?.field === field ? state.error : undefined);

  return (
    <>
      <Card padded>
        <SlopeToGoal />
        <h1 className="text-xl font-semibold tracking-tight text-gray-900 sm:text-2xl">Welcome back.</h1>
        <p className="mt-1.5 text-sm text-gray-600">
          {cameFromLink
            ? 'Sign in and we will take you back to the page you opened.'
            : 'Your line is where you left it. Every attempt is saved.'}
        </p>

        <form ref={formRef} action={formAction} className="mt-5 space-y-4" aria-busy={pending}>
          <input type="hidden" name="callbackUrl" value={callbackUrl} />

          <Field label="Email" htmlFor="email" error={fieldError('email')}>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              size="lg"
              placeholder="name@example.com"
              defaultValue={state?.values?.email}
            />
          </Field>

          <div>
            <Field label="Password" htmlFor="password" error={fieldError('password')}>
              <PasswordInput id="password" name="password" autoComplete="current-password" required size="lg" />
            </Field>
            {/* After the field, not in its label row: in the label row the link
                sat between email and password in the tab order, so Tab, type,
                Enter could follow it instead of signing in. */}
            <div className="mt-1.5 flex justify-end">
              {canResetByEmail ? (
                <Link href="/reset-password" className={forgotLinkClass}>
                  Forgot password?
                </Link>
              ) : (
                <a
                  href={TELEGRAM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={forgotLinkClass}
                >
                  Forgot password?<span className="sr-only"> Write to us in Telegram (opens Telegram)</span>
                </a>
              )}
            </div>
          </div>

          {state?.error && !state.field && <Alert tone="danger">{state.error}</Alert>}

          {/* Not disabled while working: a disabled button drops keyboard focus
              to <body>. aria-busy on the form and the live line below say it. */}
          <Button type="submit" size="lg" block>
            {pending && <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden />}
            {pending ? 'Signing in…' : 'Sign in'}
          </Button>
          <p className="sr-only" aria-live="polite">
            {pending ? 'Signing in' : ''}
          </p>
        </form>
      </Card>

      <p className="mt-6 text-center text-sm text-gray-600">
        New to MYSATuz?{' '}
        <Link href={registerHref} className={authLinkClass}>
          Create a free account
        </Link>
      </p>
    </>
  );
}
