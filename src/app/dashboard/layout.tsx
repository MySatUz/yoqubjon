import React, { Suspense } from 'react';
import AppShellFrame from '@/components/layout/AppShellFrame';
import ShellAdminNav from '@/components/layout/ShellAdminNav';
import StudentViewBanner from '@/components/layout/StudentViewBanner';
import {
  ShellUserAvatar,
  ShellUserAvatarSkeleton,
  ShellUserCard,
  ShellUserCardSkeleton,
} from '@/components/layout/ShellUser';

/**
 * Synchronous on purpose. `loading.tsx` sits below `layout.tsx` in the
 * component hierarchy, so it cannot cover runtime data read by the layout
 * itself — and with Cache Components disabled the navigation simply blocks
 * until the layout finishes rendering. Session and admin lookups therefore
 * live in their own <Suspense> islands.
 *
 * Anonymous access is still handled above this point by src/proxy.ts, so no
 * redirect happens after streaming has started.
 */
export default function DashboardLayout({
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
          <ShellAdminNav variant="desktop" hideInStudentView />
        </Suspense>
      }
      mobileAdminNav={
        <Suspense fallback={null}>
          <ShellAdminNav variant="mobile" hideInStudentView />
        </Suspense>
      }
      banner={
        <Suspense fallback={null}>
          <StudentViewBanner />
        </Suspense>
      }
    >
      {children}
    </AppShellFrame>
  );
}
