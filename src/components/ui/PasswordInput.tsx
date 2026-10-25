'use client';

import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { inputClass } from '@/components/ui/Field';
import { iconButtonClass } from '@/components/ui/Button';

/* ComponentProps<'input'> includes `ref`, passed on to the <input> (React 19). */
type PasswordInputProps = Omit<React.ComponentProps<'input'>, 'size' | 'type'> & {
  size?: 'md' | 'lg';
};

/**
 * A password field with a show/hide button inside it. On a phone a password is
 * typed blind, and a typo made at sign-up only shows up at the next sign-in, so
 * being able to look at it is worth the one button.
 */
export function PasswordInput({ size, className, ...props }: PasswordInputProps) {
  const [shown, setShown] = useState(false);

  return (
    <div className="relative">
      <input type={shown ? 'text' : 'password'} className={inputClass({ size, trailing: true, className })} {...props} />
      <button
        type="button"
        onClick={() => setShown((value) => !value)}
        aria-label={shown ? 'Hide password' : 'Show password'}
        aria-pressed={shown}
        className={iconButtonClass({ size: 'sm', className: 'absolute right-1 top-1/2 -translate-y-1/2' })}
      >
        {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
