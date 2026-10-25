'use server';

import { signOut } from '@/auth';

/** Sign-out for the shell's user menu (a client component, so it needs a module-level action). */
export async function signOutAction() {
  await signOut({ redirectTo: '/' });
}
