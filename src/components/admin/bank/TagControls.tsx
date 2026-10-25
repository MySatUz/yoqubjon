'use client';

import React from 'react';
import { Select } from '@/components/ui/Field';
import { segmentClass, segmentedClass } from '@/components/ui/Misc';
import { BANK_DIFFICULTIES, BANK_DOMAINS, isBankDomain, type BankDifficulty, type BankDomain } from '@/lib/questionBank';

/**
 * The domain picker: a select, not chips - four College Board names, one of
 * them 33 characters long, do not fit a row of a table side by side. The
 * empty first option is "not chosen yet", never a fifth domain.
 */
export function DomainSelect({
  value,
  onChange,
  id,
  name,
  'aria-label': ariaLabel,
  invalid,
  disabled,
  className,
}: {
  value: BankDomain | null;
  onChange: (value: BankDomain | null) => void;
  id?: string;
  name?: string;
  'aria-label'?: string;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Select
      id={id}
      name={name}
      aria-label={ariaLabel}
      aria-invalid={invalid || undefined}
      value={value ?? ''}
      disabled={disabled}
      onChange={(event) => onChange(isBankDomain(event.target.value) ? event.target.value : null)}
      className={className}
    >
      <option value="">Choose domain</option>
      {BANK_DOMAINS.map((domain) => (
        <option key={domain.value} value={domain.value}>{domain.label}</option>
      ))}
    </Select>
  );
}

/**
 * Easy / Medium / Hard as a segmented control - three options on one line.
 * A radio group to assistive tech: one is chosen, or none yet. Arrow keys
 * move the choice, as in any radio group.
 */
export function DifficultySegments({
  value,
  onChange,
  'aria-label': ariaLabel,
  disabled,
}: {
  value: BankDifficulty | null;
  onChange: (value: BankDifficulty) => void;
  'aria-label': string;
  disabled?: boolean;
}) {
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown'
      ? 1
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (step === 0 || disabled) return;

    event.preventDefault();
    const index = BANK_DIFFICULTIES.findIndex((difficulty) => difficulty.value === value);
    const next = BANK_DIFFICULTIES[(index + step + BANK_DIFFICULTIES.length) % BANK_DIFFICULTIES.length];
    onChange(next.value);
    const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>('button');
    buttons[BANK_DIFFICULTIES.indexOf(next)]?.focus();
  };

  return (
    <div role="radiogroup" aria-label={ariaLabel} className={segmentedClass} onKeyDown={onKeyDown}>
      {BANK_DIFFICULTIES.map((difficulty, index) => {
        const active = value === difficulty.value;
        // One stop in the tab order: the chosen one, or the first while none is.
        const focusable = active || (value === null && index === 0);

        return (
          <button
            key={difficulty.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={focusable ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(difficulty.value)}
            className={segmentClass(active)}
          >
            {difficulty.label}
          </button>
        );
      })}
    </div>
  );
}
