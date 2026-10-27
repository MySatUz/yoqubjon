'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { unlockTestWithCode } from '@/app/exam/[id]/actions';
import { ACCESS_CODE_LENGTH } from '@/lib/accessCodeFormat';
import { BackLink } from '@/components/ui/Page';
import { buttonClass } from '@/components/ui/Button';
import { cardClass } from '@/components/ui/Card';
import { fieldFocusClass, labelClass } from '@/components/ui/Field';
import { cn } from '@/components/ui/cn';

export default function AccessCodeGate({ testId, title }: { testId: string; title: string }) {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isOpening, startOpening] = useTransition();
  const isBusy = isChecking || isOpening;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (code.length !== ACCESS_CODE_LENGTH || isBusy) return;

    setIsChecking(true);
    setError(null);

    try {
      const result = await unlockTestWithCode(testId, code);

      if (!result.success) {
        setError(result.error);
        setCode('');
        return;
      }

      // The page is fetched again from here, not refreshed by the action: a
      // test opened from Practice was prefetched in full - this screen
      // included - and an action's refresh() leaves that copy in the router,
      // which then showed this screen again with the spinner on for good.
      // router.refresh() drops the copy first. The spinner lasts as long as
      // the transition, so it cannot outlive the page it is waiting for.
      startOpening(() => router.refresh());
    } catch {
      setError('Could not check the code. Please try again.');
    } finally {
      setIsChecking(false);
    }
  };

  // Outside the app shell, so this screen paints the shell's canvas itself.
  // Held to the top like the auth forms and the start screen, not centred: a
  // wrong code's message must not move the field it is about.
  return (
    <div className="flex min-h-dvh justify-center bg-gray-100 px-4 py-8 sm:py-16">
      <div className="w-full max-w-md space-y-4">
        <BackLink href="/dashboard">Back to tests</BackLink>

        <form onSubmit={handleSubmit} className={cn(cardClass, 'p-5')}>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900">Enter the test code</h1>
          <p className="mt-1 text-sm break-words text-gray-500">
            <span className="font-medium text-gray-700">{title}</span> opens with a{' '}
            {ACCESS_CODE_LENGTH}-digit code from your teacher.
          </p>

          <label className="mt-5 block">
            <span className={cn(labelClass, 'mb-1.5')}>Test code</span>
            {/* `inputClass` colours and focus at code size, `focus:outline-hidden`
                included, so high-contrast mode still shows the focus; the wide
                tracking spaces the digits out so a mistyped one is easy to
                spot. No "000000" placeholder: at the system's readable
                gray-500 it looked like a code already typed in. */}
            <input
              value={code}
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, '').slice(0, ACCESS_CODE_LENGTH))
              }
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'access-code-error' : undefined}
              className={cn(
                'h-12 w-full rounded-lg border border-gray-400 bg-white px-3 text-center text-2xl font-semibold tabular-nums tracking-[0.4em] text-gray-900 transition-colors hover:border-gray-500 focus:outline-hidden aria-invalid:border-red-600 aria-invalid:focus:ring-red-600',
                fieldFocusClass
              )}
            />
          </label>

          {error && (
            <p id="access-code-error" role="alert" className="mt-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={code.length !== ACCESS_CODE_LENGTH || isBusy}
            className={buttonClass({ size: 'lg', block: true, className: 'mt-5' })}
          >
            {isBusy && <Loader2 className="h-4 w-4 animate-spin" />}
            Start test
          </button>
        </form>
      </div>
    </div>
  );
}
