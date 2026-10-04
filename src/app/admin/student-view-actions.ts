'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/admin';
import {
  readStudentViewMode,
  STUDENT_VIEW_COOKIE,
  STUDENT_VIEW_MAX_AGE_SECONDS,
} from '@/lib/studentView';

/**
 * Setting or deleting a cookie in a Server Action also clears the client
 * router cache, so the 30 s `staleTimes` cannot replay the admin's version of
 * a page that was visited just before switching.
 */
export async function enterStudentView(formData: FormData) {
  await requireAdmin();

  const mode = readStudentViewMode(formData.get('mode'));
  if (!mode) {
    throw new Error('Unknown student view');
  }

  (await cookies()).set(STUDENT_VIEW_COOKIE, mode, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: STUDENT_VIEW_MAX_AGE_SECONDS,
  });

  redirect('/dashboard');
}

/** No admin check: dropping the cookie can only take privileges away. */
export async function exitStudentView() {
  (await cookies()).delete(STUDENT_VIEW_COOKIE);

  redirect('/admin');
}
