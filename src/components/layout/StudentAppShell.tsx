import React, { Suspense } from 'react';
import AppShellFrame from '@/components/layout/AppShellFrame';
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
 * The student-facing app shell with its streamed islands: the shell itself
 * renders at once, and the user row, the admin entries and the student-view
 * banner each arrive in their own <Suspense> boundary (see AppShellFrame).
 * Shared by every layout a student works in, so an olympiad page wears the
 * same sidebar and tab bar as Practice.
 *
 * The admin entries hide in student view: an admin looking at the site as a
 * student sees the nav a student sees, and the banner is the way back.
 */
export default function StudentAppShell({ children }: { children: React.ReactNode }) {
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
      {children}
    </AppShellFrame>
  );
}
