import React, { Suspense } from 'react';
import AdminMobileNav from '@/components/admin/courses/AdminMobileNav';
import AppShellFrame from '@/components/layout/AppShellFrame';
import { getShellCanManageTests } from '@/components/layout/shell-data';
import ShellAdminNav, { ShellSubscriptionNav } from '@/components/layout/ShellAdminNav';
import { ShellSubscriptionLink } from '@/components/layout/ShellNav';
import StudentViewBanner from '@/components/layout/StudentViewBanner';
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
 * `/admin/**` page keeps its own `requireAdminPage()` call. The admin nav
 * entries are still gated by <ShellAdminNav> and the phone's row below, which
 * check `isAdminUser()` themselves, so a non-admin who reaches the 404 rendered
 * inside this layout does not see an admin link.
 *
 * Anonymous access is handled above this point by src/proxy.ts (`/admin/:path*`
 * is in the matcher), so no redirect happens after streaming has started.
 */

/**
 * The phone's row of admin places, for admins only: like the sidebar's group,
 * it must not show on the 404 a student gets inside this layout. Streamed, with
 * no placeholder, for the same reason as <ShellAdminNav>.
 */
async function AdminMobileNavIsland() {
  if (!(await getShellCanManageTests())) return null;
  return <AdminMobileNav />;
}

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
      subscriptionNav={
        <Suspense fallback={<ShellSubscriptionLink />}>
          <ShellSubscriptionNav />
        </Suspense>
      }
      banner={
        <Suspense fallback={null}>
          <StudentViewBanner />
        </Suspense>
      }
    >
      <Suspense fallback={null}>
        <AdminMobileNavIsland />
      </Suspense>
      {children}
    </AppShellFrame>
  );
}
