import React, { Suspense } from 'react';
import AppShellFrame from '@/components/layout/AppShellFrame';
import ShellAdminNav from '@/components/layout/ShellAdminNav';
import {
  ShellUserAvatar,
  ShellUserAvatarSkeleton,
  ShellUserCard,
  ShellUserCardSkeleton,
} from '@/components/layout/ShellUser';

/**
 * Same construction as src/app/dashboard/layout.tsx: a synchronous frame that
 * goes out with the first byte, plus <Suspense> islands for everything that
 * needs runtime data. Hoisting the shell here means it is rendered once and
 * reused across `/admin/**` navigations instead of being part of each page's
 * payload, and `admin/loading.tsx` now sits below it — so the sidebar no longer
 * has to be duplicated in the skeleton and no longer flickers on every hop.
 *
 * NOT a security boundary. Layouts do not re-render on every navigation and are
 * skipped entirely for client-side transitions between sibling pages, so each
 * `/admin/**` page keeps its own `requireAdminPage()` call. The "Admin Panel"
 * nav entry is still gated by <ShellAdminNav>, which checks `isAdminUser()`
 * itself, so a non-admin who reaches the 404 rendered inside this layout does
 * not see an admin link.
 *
 * Anonymous access is handled above this point by src/proxy.ts (`/admin/:path*`
 * is in the matcher), so no redirect happens after streaming has started.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShellFrame
      userAvatar={
        <Suspense fallback={<ShellUserAvatarSkeleton />}>
          <ShellUserAvatar />
        </Suspense>
      }
      userCard={
        <Suspense fallback={<ShellUserCardSkeleton />}>
          <ShellUserCard />
        </Suspense>
      }
      desktopAdminNav={
        <Suspense fallback={null}>
          <ShellAdminNav variant="desktop" />
        </Suspense>
      }
      mobileAdminNav={
        <Suspense fallback={null}>
          <ShellAdminNav variant="mobile" />
        </Suspense>
      }
    >
      {children}
    </AppShellFrame>
  );
}
