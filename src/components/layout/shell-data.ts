import { cache } from 'react';
import { auth } from '@/auth';
import { isAdminUser } from '@/lib/admin';

/**
 * Request-scoped memoization for the shell islands. The shell renders the user
 * block twice (mobile header + desktop sidebar) and the admin nav item twice
 * (mobile bar + desktop sidebar), each inside its own <Suspense> boundary, so
 * without `cache()` a single dashboard render would decode the JWT and hit the
 * database several times.
 */
export const getShellSession = cache(async () => auth());

export const getShellCanManageTests = cache(async () => {
  const session = await getShellSession();
  return isAdminUser(session?.user?.id);
});
