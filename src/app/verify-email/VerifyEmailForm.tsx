'use client';

import React, { useActionState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { resendVerification, verifyEmail } from '@/lib/auth-actions';
import { Card } from '@/components/ui/Card';
import { Field, Input } from '@/components/ui/Field';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Feedback';
import { authLinkClass } from '@/components/layout/AuthShell';

/**
 * The code box: big, spaced digits, the phone's number pad and SMS-style
 * autofill. `max-sm:text-xl` as well: size lg sets `max-sm:text-base` (iOS
 * zoom), a variant, which beat the plain text-xl and shrank the digits on
 * exactly the phones this box is typed on.
 */
const codeInputClass = 'text-center text-xl max-sm:text-xl font-semibold tracking-[0.4em] tabular-nums';

/**
 * In the browser that signed up, the code is all it takes (the server matches
 * a secret from this browser's cookie). Anywhere else - another device, an
 * expired cookie - the code also needs the account's password, so a code
 * alone never confirms an account somebody else chose the password for.
 * "Send a new code" is a second action on the same form, so it reads the
 * email field as typed.
 */
export default function VerifyEmailForm({ email }: { email: string | null }) {
  const [state, verifyAction, verifying] = useActionState(verifyEmail, null);
  const [resendState, resendAction, resending] = useActionState(resendVerification, null);
  const formRef = useRef<HTMLFormElement>(null);
  const needsPassword = !email || state?.field === 'password';

  useEffect(() => {
    if (state?.field) formRef.current?.querySelector<HTMLInputElement>(`#${state.field}`)?.focus();
  }, [state]);

  const fieldError = (field: 'email' | 'code' | 'password') => (state?.field === field ? state.error : undefined);

  return (
    <>
      <Card padded>
        <h1 className="text-xl font-semibold tracking-tight text-mist-900 sm:text-2xl">Check your email</h1>
        {/* &#8209; (\u2011 in a string) is a non-breaking hyphen, so "6-" never
            ends a line with "digit" starting the next. break-words: a long
            address has no space to wrap at and would run out of the card. */}
        <p className="mt-1.5 break-words text-sm text-mist-600">
          {email ? (
            <>
              We sent a 6&#8209;digit code to <span className="font-medium text-mist-900">{email}</span>. Enter it to open
              your account.
            </>
          ) : (
            'Enter your email, your password and the 6\u2011digit code we sent you.'
          )}
        </p>

        <form ref={formRef} action={verifyAction} className="mt-5 space-y-4" aria-busy={verifying || resending}>
          {email ? (
            <input type="hidden" name="email" value={email} />
          ) : (
            <Field label="Email" htmlFor="email" error={fieldError('email')}>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                size="lg"
                placeholder="name@example.com"
                defaultValue={state?.values?.email ?? resendState?.values?.email}
              />
            </Field>
          )}

          {needsPassword && (
            <Field label="Password" htmlFor="password" hint="The one you chose when you signed up." error={fieldError('password')}>
              <PasswordInput id="password" name="password" autoComplete="current-password" required size="lg" />
            </Field>
          )}

          <Field label="Confirmation code" htmlFor="code" hint="It works for 15 minutes." error={fieldError('code')}>
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
              className={codeInputClass}
            />
          </Field>

          {state?.error && !state.field && <Alert tone="danger">{state.error}</Alert>}

          <Button type="submit" size="lg" block>
            {verifying && <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden />}
            {verifying ? 'Checking…' : 'Confirm email'}
          </Button>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-mist-100 pt-4">
            <p className="text-sm text-mist-600">No email? Check spam, or</p>
            {/* formNoValidate: asking for a code must not require one. */}
            <Button type="submit" formAction={resendAction} formNoValidate variant="secondary" size="sm">
              {resending && <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden />}
              Send a new code
            </Button>
          </div>
          <div aria-live="polite" className="text-sm empty:hidden">
            {resendState?.notice && <p className="text-mist-600">{resendState.notice}</p>}
            {resendState?.error && <p className="text-red-600">{resendState.error}</p>}
          </div>
        </form>
      </Card>

      <p className="mt-6 text-center text-sm text-mist-600">
        Signed up with the wrong email?{' '}
        <Link href="/register" className={authLinkClass}>
          Sign up again
        </Link>
      </p>
    </>
  );
}
