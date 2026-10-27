'use client';

import { useId, useRef, useState } from 'react';
import { ACCESS_CODE_LENGTH, generateAccessCode } from '@/lib/accessCodeFormat';
import { Button } from '@/components/ui/Button';
import { Field, inputClass } from '@/components/ui/Field';

type AccessCodeFieldProps = {
  initialCode?: string | null;
  /** Shown under the input: creating a test and editing one need different words. */
  hint: string;
  className?: string;
};

/**
 * The optional test code, shared by the upload form and the test editor so
 * both read and behave the same. Controlled, unlike the fields around it,
 * because "Generate" and "Remove" have to write into the input.
 */
export default function AccessCodeField({ initialCode, hint, className = 'block' }: AccessCodeFieldProps) {
  const [code, setCode] = useState(initialCode ?? '');
  const inputRef = useRef<HTMLInputElement>(null);
  // Several tests can be open in the list at once, so the id cannot be fixed.
  const inputId = useId();

  return (
    <Field
      label={
        <>
          Test code
          {/* Text the admin reads, so gray-500: gray-400 is for icons. */}
          <span className="font-normal text-gray-500"> · {ACCESS_CODE_LENGTH} digits, optional</span>
        </>
      }
      htmlFor={inputId}
      hint={hint}
      className={className}
    >
      <div className="flex flex-wrap items-center gap-2">
        {/* Field finds the input by its id inside this row and points it at the hint. */}
        <input
          ref={inputRef}
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
          // The base class is w-full; max-w caps it without a second width class.
          className={inputClass({ className: 'max-w-36 tabular-nums tracking-widest placeholder:tracking-normal' })}
        />
        <Button variant="secondary" onClick={() => setCode(generateAccessCode())}>
          Generate
        </Button>
        {/* Outlined like Generate beside it: a ghost "Remove" read as a
            word, not a button. It goes away with the code, so focus moves to
            the now empty field. */}
        {code && (
          <Button
            variant="secondary"
            onClick={() => {
              setCode('');
              inputRef.current?.focus();
            }}
          >
            Remove
          </Button>
        )}
      </div>
    </Field>
  );
}
