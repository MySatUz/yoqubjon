'use client';

import { useActionState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { updateName } from '@/app/dashboard/profile/actions';
import { Field, Input } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';

/**
 * The student's public name: the field, then Save. The result of a save is
 * said next to the button and read out (`aria-live`), so the card does not
 * grow an alert box for one word.
 */
export default function NameForm({ name }: { name: string }) {
  const [state, formAction, pending] = useActionState(updateName, null);

  return (
    <form action={formAction} className="space-y-4 p-5" aria-busy={pending}>
      <Field label="Name" htmlFor="profile-name" hint="Up to 60 characters." error={state?.error} className="max-w-sm">
        <Input
          id="profile-name"
          name="name"
          type="text"
          autoComplete="name"
          autoCapitalize="words"
          autoCorrect="off"
          spellCheck={false}
          maxLength={60}
          required
          defaultValue={state?.values?.name ?? name}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        {/* Disabled while saving: a second click would queue a second save. */}
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden />}
          {pending ? 'Saving…' : 'Save name'}
        </Button>
        <p className="flex items-center gap-1.5 text-sm text-lime-800" aria-live="polite">
          {state?.saved && !pending && (
            <>
              <CheckCircle2 className="h-4 w-4 text-lime-700" aria-hidden />
              Saved
            </>
          )}
        </p>
      </div>
    </form>
  );
}
