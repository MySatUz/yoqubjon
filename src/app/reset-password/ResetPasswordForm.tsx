'use client';

import React, { useActionState, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { requestPasswordReset, resetPassword } from '@/lib/auth-actions';
import { Card } from '@/components/ui/Card';
import { Field, Input } from '@/components/ui/Field';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Feedback';
import { authLinkClass } from '@/components/layout/AuthShell';

/**
 * Two steps on one page: the email (a code is sent), then the code and the new
 * password. The second step appears once the first answers - with the same
 * words whether or not the address has an account.
 */
export default function ResetPasswordForm() {
  const [requestState, requestAction, requesting] = useActionState(requestPasswordReset, null);
  const [resetState, resetAction, resetting] = useActionState(resetPassword, null);
  const resetFormRef = useRef<HTMLFormElement>(null);
  // A new code makes an earlier "wrong code" message stale.
  const [resends, setResends] = useState(0);
  const [resendsAtReset, setResendsAtReset] = useState(0);

  const email = resetState?.values?.email ?? requestState?.values?.email ?? '';
  const onCodeStep = (resetState?.step ?? requestState?.step) === 'code';

  useEffect(() => {
    if (resetState?.field) resetFormRef.current?.querySelector<HTMLInputElement>(`#${resetState.field}`)?.focus();
  }, [resetState]);

  const showResetError = resendsAtReset === resends;
  const resetError = (field: 'code' | 'password') =>
    showResetError && resetState?.field === field ? resetState.error : undefined;

  return (
    <>
      <Card padded>
        <h1 className="text-xl font-semibold tracking-tight text-mist-900 sm:text-2xl">Reset your password</h1>

        {!onCodeStep ? (
          <>
            {/* &#8209; is a non-breaking hyphen: "6-" at a line end and "digit" on
                the next read as a broken word on a phone. */}
            <p className="mt-1.5 text-sm text-mist-600">Enter the email you signed up with. We will send it a 6&#8209;digit code.</p>
            <form action={requestAction} className="mt-5 space-y-4" aria-busy={requesting}>
              <Field
                label="Email"
                htmlFor="reset-email"
                error={requestState?.field === 'email' ? requestState.error : undefined}
              >
                <Input
                  id="reset-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  size="lg"
                  placeholder="name@example.com"
                  defaultValue={requestState?.values?.email}
                />
              </Field>
              {requestState?.error && !requestState.field && <Alert tone="danger">{requestState.error}</Alert>}
              <Button type="submit" size="lg" block>
                {requesting && <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden />}
                Send confirmation code
              </Button>
            </form>
          </>
        ) : (
          <>
            {/* break-words: the email has no space to wrap at. */}
            <p className="mt-1.5 break-words text-sm text-mist-600" aria-live="polite">
              {requestState?.notice ?? `Enter the code we sent to ${email} and a new password.`}
            </p>
            <form
              ref={resetFormRef}
              action={resetAction}
              onSubmit={() => setResendsAtReset(resends)}
              className="mt-5 space-y-4"
              aria-busy={resetting}
            >
              <input type="hidden" name="email" value={email} />
              <Field label="Confirmation code" htmlFor="code" hint="It works for 15 minutes." error={resetError('code')}>
                <Input
                  id="code"
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9 ]{6,7}"
                  maxLength={7}
                  required
                  size="lg"
                  placeholder="000000"
                  // This step mounts in place of the email step: focus moves here.
                  autoFocus
                  // max-sm:text-xl: see the code box in VerifyEmailForm.
                  className="text-center text-xl max-sm:text-xl font-semibold tracking-[0.4em] tabular-nums"
                />
              </Field>
              <Field label="New password" htmlFor="password" hint="At least 8 characters." error={resetError('password')}>
                <PasswordInput id="password" name="password" autoComplete="new-password" minLength={8} required size="lg" />
              </Field>
              {showResetError && resetState?.error && !resetState.field && <Alert tone="danger">{resetState.error}</Alert>}
              <Button type="submit" size="lg" block>
                {resetting && <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden />}
                Set new password
              </Button>
            </form>

            <form
              action={requestAction}
              onSubmit={() => setResends((count) => count + 1)}
              className="mt-4 border-t border-mist-100 pt-4"
              aria-busy={requesting}
            >
              <input type="hidden" name="email" value={email} />
              <input type="hidden" name="step" value="code" />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-mist-600">No email? Check spam, or</p>
                <Button type="submit" variant="secondary" size="sm">
                  {requesting && <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden />}
                  Send a new code
                </Button>
              </div>
              <div aria-live="polite" className="mt-2 text-sm empty:hidden">
                {requestState?.error && <p className="text-red-600">{requestState.error}</p>}
              </div>
            </form>
          </>
        )}
      </Card>

      <p className="mt-6 text-center text-sm text-mist-600">
        Remembered it?{' '}
        <Link href="/login" className={authLinkClass}>
          Sign in
        </Link>
      </p>
    </>
  );
}
