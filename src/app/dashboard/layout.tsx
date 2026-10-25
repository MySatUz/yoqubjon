import React from 'react';
import StudentAppShell from '@/components/layout/StudentAppShell';

/**
 * Synchronous on purpose. `loading.tsx` sits below `layout.tsx` in the
 * component hierarchy, so it cannot cover runtime data read by the layout
 * itself — and with Cache Components disabled the navigation simply blocks
 * until the layout finishes rendering. Session and admin lookups therefore
 * live in their own <Suspense> islands, inside StudentAppShell — the same
 * shell the olympiad pages use, so the two cannot drift apart.
 *
 * Anonymous access is still handled above this point by src/proxy.ts, so no
 * redirect happens after streaming has started.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <StudentAppShell>{children}</StudentAppShell>;
}
