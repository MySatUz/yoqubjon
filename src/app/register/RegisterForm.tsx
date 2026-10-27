'use client';

import React, { useActionState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Check, Loader2 } from 'lucide-react';
import { register } from '@/lib/auth-actions';
import { FREE_PLAN } from '@/lib/plans';
import { Card } from '@/components/ui/Card';
import { Field, Input } from '@/components/ui/Field';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Feedback';
import { authLinkClass } from '@/components/layout/AuthShell';

/** See LoginForm for why this is a form action and not an onSubmit handler. */
export default function RegisterForm({ callbackUrl, loginHref }: { callbackUrl: string; loginHref: string }) {
  const [state, formAction, pending] = useActionState(register, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.field) formRef.current?.querySelector<HTMLInputElement>(`#${state.field}`)?.focus();
  }, [state]);

  const fieldError = (field: 'name' | 'email' | 'password') => {
    if (state?.field !== field) return undefined;
    if (field === 'email' && state.accountExists) {
      return (
        <>
          {state.error}{' '}
          <Link href={loginHref} className={authLinkClass}>
            Sign in
          </Link>{' '}
          or{' '}
          <Link href="/reset-password" className={authLinkClass}>
            reset the password
          </Link>
          .
        </>
      );
    }
    return state.error;
  };

  return (
    <>
      <Card padded>
        <h1 className="text-xl font-semibold tracking-tight text-gray-900 sm:text-2xl">Create your free account</h1>
        {/* The plan's own name and lines (src/lib/plans.ts), the ones the
            landing and the subscription page show, so sign-up cannot promise
            something else. */}
        <p className="mt-1.5 text-sm text-gray-600">You start on {FREE_PLAN.name}. No payment details.</p>
        <ul className="mt-3 grid gap-1.5">
          {FREE_PLAN.features.map((feature) => (
            <li key={feature} className="flex gap-2 text-sm text-gray-600">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-ink-600" aria-hidden />
              {feature}
            </li>
          ))}
        </ul>

        <form ref={formRef} action={formAction} className="mt-5 space-y-4" aria-busy={pending}>
          <input type="hidden" name="callbackUrl" value={callbackUrl} />

          <Field
            label="Full name"
            htmlFor="name"
            hint="Shown on olympiad rankings. Practice results are not shown to other students."
            error={fieldError('name')}
          >
            <Input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              autoCapitalize="words"
              autoCorrect="off"
              spellCheck={false}
              maxLength={60}
              required
              size="lg"
              placeholder="e.g. Aziza Rahimova"
              defaultValue={state?.values?.name}
            />
          </Field>

          <Field
            label="Email"
            htmlFor="email"
            hint="Joined a course? Use the email you gave your teacher — the course opens with it."
            error={fieldError('email')}
          >
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              size="lg"
              placeholder="name@example.com"
              defaultValue={state?.values?.email}
            />
          </Field>

          <Field label="Password" htmlFor="password" hint="At least 8 characters." error={fieldError('password')}>
            <PasswordInput id="password" name="password" autoComplete="new-password" minLength={8} required size="lg" />
          </Field>

          {state?.error && !state.field && <Alert tone="danger">{state.error}</Alert>}

          <Button type="submit" size="lg" block>
            {pending && <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden />}
            {pending ? 'Creating your account…' : 'Create free account'}
          </Button>
          <p className="sr-only" aria-live="polite">
            {pending ? 'Creating your account' : ''}
          </p>
        </form>
      </Card>

      <p className="mt-6 text-center text-sm text-gray-600">
        Already have an account?{' '}
        <Link href={loginHref} className={authLinkClass}>
          Sign in
        </Link>
      </p>
    </>
  );
}
