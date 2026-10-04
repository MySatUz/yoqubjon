'use client';

import { useId, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { ACCESS_CODE_LENGTH, generateAccessCode } from '@/lib/accessCodeFormat';

type AccessCodeFieldProps = {
  initialCode?: string | null;
  /** Shown under the input: creating a test and editing one need different words. */
  hint: string;
  className?: string;
};

/**
 * The optional start code, shared by the upload form and the test editor so
 * both read and behave the same. Controlled, unlike the fields around it,
 * because "Generate" and "Remove" have to write into the input.
 */
export default function AccessCodeField({ initialCode, hint, className = 'block' }: AccessCodeFieldProps) {
  const [code, setCode] = useState(initialCode ?? '');
  // Several tests can be open in the list at once, so the id cannot be fixed.
  const inputId = useId();

  return (
    <div className={className}>
      <label
        htmlFor={inputId}
        className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-slate-400"
      >
        <KeyRound className="h-4 w-4" />
        Start code
        <span className="normal-case tracking-normal text-slate-400">
          — {ACCESS_CODE_LENGTH} digits, empty for no code
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={inputId}
          name="accessCode"
          value={code}
          onChange={(event) =>
            setCode(event.target.value.replace(/\D/g, '').slice(0, ACCESS_CODE_LENGTH))
          }
          inputMode="numeric"
          autoComplete="off"
          pattern={`\\d{${ACCESS_CODE_LENGTH}}`}
          title={`Exactly ${ACCESS_CODE_LENGTH} digits`}
          placeholder="No code"
          className="w-36 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold tabular-nums tracking-widest text-slate-900 outline-none transition placeholder:font-medium placeholder:tracking-normal placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
        />
        <button
          type="button"
          onClick={() => setCode(generateAccessCode())}
          className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-600"
        >
          Generate
        </button>
        {code && (
          <button
            type="button"
            onClick={() => setCode('')}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-700 transition hover:border-red-200 hover:text-red-600"
          >
            Remove
          </button>
        )}
      </div>
      <p className="mt-2 text-xs text-slate-500">{hint}</p>
    </div>
  );
}
