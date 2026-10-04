import { cache } from 'react';
import { cookies } from 'next/headers';
import { isAdminUser } from '@/lib/admin';

/**
 * "View as student": an admin switches it on from the admin panel to see the
 * Practice Center and the exam the way a student does - hidden tests stay
 * hidden, and attempt limits, olympiad windows, subscriptions and start codes
 * all apply. It lives in a cookie, so it belongs to one browser, and it is
 * honoured only while the account really is an admin: a student who sets the
 * cookie by hand gets nothing from it, the simulated subscription included.
 */
export const STUDENT_VIEW_COOKIE = 'student-view';

/** Long enough to look around, short enough not to surprise anyone the next day. */
export const STUDENT_VIEW_MAX_AGE_SECONDS = 8 * 60 * 60;

const STUDENT_VIEW_MODES = ['free', 'subscribed'] as const;

export type StudentViewMode = (typeof STUDENT_VIEW_MODES)[number];

export function readStudentViewMode(value: unknown): StudentViewMode | null {
  return STUDENT_VIEW_MODES.find((mode) => mode === value) ?? null;
}

/** The view this admin switched into, or null - always null for anyone else. */
export const getStudentView = cache(async (userId?: string | null) => {
  const mode = readStudentViewMode((await cookies()).get(STUDENT_VIEW_COOKIE)?.value);
  if (!mode) return null;

  return await isAdminUser(userId) ? mode : null;
});

/**
 * How the student-facing pages should treat this viewer. An admin in student
 * view is not an admin there; in the "subscribed" view they also count as
 * subscribed, whether or not their own account has a subscription.
 */
export const getViewerAccess = cache(async (userId?: string | null) => {
  const [isAdmin, studentView] = await Promise.all([
    isAdminUser(userId),
    getStudentView(userId),
  ]);

  return {
    isAdmin: isAdmin && !studentView,
    simulatesSubscription: studentView === 'subscribed',
  };
});
