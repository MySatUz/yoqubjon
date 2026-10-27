'use client';

import { useId, useRef, useState } from 'react';
import {
  formatDuration,
  formatOlympiadMoment,
  parseOlympiadMoment,
  toOlympiadInputValue,
} from '@/lib/olympiad';
import { Button } from '@/components/ui/Button';
import { Input, errorTextClass, hintClass, labelClass } from '@/components/ui/Field';
import { cn } from '@/components/ui/cn';

type OlympiadWindowFieldsProps = {
  initialStartsAt?: Date | null;
  initialEndsAt?: Date | null;
  /** Under the fields: creating a test and editing one need different words. */
  hint: string;
  className?: string;
};

/**
 * The olympiad window, shared by the upload form and the test editor. A
 * datetime input shows the moment in the browser's own format and says
 * nothing about the zone, so the line under the two reads the window back the
 * way the rest of the admin says it - "12 September, 09:00 to 12:00, Tashkent
 * time" - and catches a window that closes before it opens before the server
 * refuses the save.
 *
 * Controlled, unlike the fields around it, for that line and for "Clear":
 * emptying two datetime inputs by keyboard takes a dozen presses. A parent
 * that resets its form remounts this through a `key`.
 */
export default function OlympiadWindowFields({
  initialStartsAt = null,
  initialEndsAt = null,
  hint,
  className,
}: OlympiadWindowFieldsProps) {
  const [opens, setOpens] = useState(() => toOlympiadInputValue(initialStartsAt));
  const [closes, setCloses] = useState(() => toOlympiadInputValue(initialEndsAt));
  const fieldId = useId();
  const opensRef = useRef<HTMLInputElement>(null);
  const readbackId = `${fieldId}-readback`;
  const hintId = `${fieldId}-hint`;

  const startsAt = parseOlympiadMoment(opens);
  const endsAt = parseOlympiadMoment(closes);
  const isBackwards = startsAt !== null && endsAt !== null && endsAt <= startsAt;
  let readback: string | null = null;
  if (startsAt && endsAt && !isBackwards) {
    const length = formatDuration((endsAt.getTime() - startsAt.getTime()) / 1000);
    readback = `${formatOlympiadMoment(startsAt)} to ${formatOlympiadMoment(endsAt)}, Tashkent time · ${length}`;
  } else if (isBackwards) {
    readback = 'The window closes before it opens.';
  } else if (startsAt || endsAt) {
    // Still being filled in: a fact, not an error yet.
    readback = 'Set both ends, or clear both for an ordinary test.';
  }
  const describedBy = readback ? `${readbackId} ${hintId}` : hintId;

  return (
    <fieldset className={className}>
      <legend className={cn(labelClass, 'mb-1.5')}>Olympiad window</legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <label htmlFor={`${fieldId}-opens`} className="mb-1 block text-xs text-gray-500">
            Opens
          </label>
          <Input
            ref={opensRef}
            id={`${fieldId}-opens`}
            name="olympiadStartsAt"
            type="datetime-local"
            value={opens}
            onChange={(event) => setOpens(event.target.value)}
            aria-describedby={describedBy}
            aria-invalid={isBackwards || undefined}
          />
        </div>
        <div>
          <label htmlFor={`${fieldId}-closes`} className="mb-1 block text-xs text-gray-500">
            Closes
          </label>
          <Input
            id={`${fieldId}-closes`}
            name="olympiadEndsAt"
            type="datetime-local"
            value={closes}
            onChange={(event) => setCloses(event.target.value)}
            aria-describedby={describedBy}
            aria-invalid={isBackwards || undefined}
          />
        </div>
      </div>

      <div className="mt-1.5 flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-0 max-w-2xl space-y-1">
          {readback && (
            <p
              id={readbackId}
              aria-live="polite"
              className={isBackwards ? errorTextClass : 'text-xs font-medium tabular-nums text-gray-700'}
            >
              {readback}
            </p>
          )}
          <p id={hintId} className={hintClass}>{hint}</p>
        </div>
        {/* Outlined, not ghost: under a form a bare "Clear window" read as
            text. It goes away once both are empty, so focus moves to Opens. */}
        {(opens || closes) && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setOpens('');
              setCloses('');
              opensRef.current?.focus();
            }}
          >
            Clear window
          </Button>
        )}
      </div>
    </fieldset>
  );
}
