'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, KeyRound, Loader2 } from 'lucide-react';
import { unlockTestWithCode } from '@/app/exam/[id]/actions';
import { ACCESS_CODE_LENGTH } from '@/lib/accessCodeFormat';

export default function AccessCodeGate({ testId, title }: { testId: string; title: string }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (code.length !== ACCESS_CODE_LENGTH || isChecking) return;

    setIsChecking(true);
    setError(null);

    try {
      // On success the action refreshes the route, and the exam replaces this
      // screen; the spinner stays up until it does.
      const result = await unlockTestWithCode(testId, code);

      if (!result.success) {
        setError(result.error);
        setCode('');
        setIsChecking(false);
      }
    } catch {
      setError('Could not check the code. Please try again.');
      setIsChecking(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md">
        <Link
          href="/dashboard"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to tests
        </Link>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <KeyRound className="h-6 w-6" />
          </span>
          <h1 className="mt-5 text-xl font-semibold text-slate-900">Enter the test code</h1>
          <p className="mt-2 text-sm text-slate-500">
            <span className="font-medium text-slate-700">{title}</span> opens with a{' '}
            {ACCESS_CODE_LENGTH}-digit code from your teacher.
          </p>

          <label className="mt-6 block">
            <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
              Code
            </span>
            <input
              value={code}
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, '').slice(0, ACCESS_CODE_LENGTH))
              }
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              placeholder={'0'.repeat(ACCESS_CODE_LENGTH)}
              aria-invalid={error ? true : undefined}
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-center text-2xl font-semibold tabular-nums tracking-[0.4em] text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            />
          </label>

          {error && (
            <p role="alert" className="mt-3 text-sm font-medium text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={code.length !== ACCESS_CODE_LENGTH || isChecking}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isChecking && <Loader2 className="h-4 w-4 animate-spin" />}
            Start test
          </button>
        </form>
      </div>
    </div>
  );
}
