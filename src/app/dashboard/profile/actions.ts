'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

/** The cap sign-up uses (src/lib/auth-actions.ts), so a renamed account fits everywhere a new one does. */
const MAX_NAME_LENGTH = 60;

export type NameFormState = {
  error?: string;
  /** Set after a save, so the form can say so. */
  saved?: boolean;
  /** What was typed: React resets the form after the action, and an error must not lose it. */
  values?: { name: string };
} | null;

/**
 * Renames the signed-in student. The name is public in one place - olympiad
 * rankings - so it is validated the way sign-up validates it: trimmed, cut to
 * 60 characters, and never empty (the ranking would show a placeholder).
 */
export async function updateName(_previous: NameFormState, formData: FormData): Promise<NameFormState> {
  const raw = formData.get('name');
  // Trimmed again after the cut, so a space at character 60 is not kept.
  const name = (typeof raw === 'string' ? raw.trim() : '').slice(0, MAX_NAME_LENGTH).trim();
  const values = { name };

  if (!name) {
    return { error: 'Enter your name — it appears on olympiad rankings.', values };
  }

  const session = await auth();
  if (!session?.user?.id) {
    return { error: 'Your session has expired. Please sign in again.', values };
  }

  // A thrown error would reach the form as a rejected action and take the page
  // down with it; a database hiccup is answered as a message to retry.
  try {
    await prisma.user.update({ where: { id: session.user.id }, data: { name } });
  } catch (error) {
    console.error('Update Name Error:', error);
    return { error: "We couldn't save your name. Try again in a minute.", values };
  }

  // From the layout down: the profile reads the name from the database, and
  // so does anything in the shell that reads it from there rather than from
  // the session token, which keeps the name it was signed in with.
  revalidatePath('/dashboard', 'layout');
  return { saved: true, values };
}
