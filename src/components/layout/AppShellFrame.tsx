import React from 'react';
import Link from 'next/link';
import BrandMark from '@/components/layout/BrandMark';
import ShellNav, { ShellSubscriptionLink } from '@/components/layout/ShellNav';
import SidebarToggle from '@/components/layout/SidebarToggle';
import { focusRingClass } from '@/components/ui/Button';

type AppShellFrameProps = {
  children: React.ReactNode;
  /** Avatar in the mobile header, opening the account menu — session dependent. */
  userAvatar: React.ReactNode;
  /** Name/email row at the bottom of the desktop sidebar, opening the account menu — session dependent. */
  userCard: React.ReactNode;
  /** The admin places for the desktop sidebar nav (admins only). */
  desktopAdminNav?: React.ReactNode;
  /** The "Admin" tab for the mobile bottom bar (admins only). */
  mobileAdminNav?: React.ReactNode;
  /** The sidebar's Subscription row; an admin's carries the payments waiting. */
  subscriptionNav?: React.ReactNode;
  /** Bar above the page content — the student-view notice. */
  banner?: React.ReactNode;
};

/**
 * Purely synchronous shell: no `auth()`, no database access, nothing to await.
 * It goes out in the first byte, so `loading.tsx` below it can actually be
 * shown. Everything that needs runtime data is injected through the slots
 * above, wrapped by the caller in its own <Suspense> boundary.
 *
 * The page canvas is `bg-gray-100` and the sidebar is deep navy (`ink-950`)
 * with no border: the active nav row is drawn in the canvas colour, so it reads
 * as a tab cut out of the sidebar and joined to the page (see SidebarNotch in
 * ShellNav). The mobile header and bottom bar stay white.
 */
export default function AppShellFrame({
  children,
  userAvatar,
  userCard,
  desktopAdminNav,
  mobileAdminNav,
  subscriptionNav = <ShellSubscriptionLink />,
  banner,
}: AppShellFrameProps) {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row">
      {/* The first stop for the keyboard, so a page is not reached through every
          sidebar link on every visit. Off screen until focused, never sr-only:
          a sighted keyboard user has to see where the first Tab went. */}
      <a
        href="#content"
        className={`fixed left-4 top-3 z-50 inline-flex h-10 -translate-y-20 items-center rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-ink-600 focus:translate-y-0 focus:shadow-lg ${focusRingClass}`}
      >
        Skip to content
      </a>

      {/* Opaque, no `backdrop-blur`: this bar and the bottom nav are on screen for
          the whole session, and a backdrop filter makes the compositor re-blur the
          full screen width on every scroll frame — for a 95 %-opaque background
          nobody can see. */}
      <div className="sticky top-0 z-40 md:hidden bg-white border-b border-gray-200 h-14 px-4 flex items-center justify-between">
        <Link href="/dashboard" className={`flex items-center gap-2.5 rounded-lg ${focusRingClass}`}>
          <BrandMark size="sm" />
          <span className="text-base font-semibold tracking-tight text-gray-900">MYSATuz</span>
        </Link>
        {userAvatar}
      </div>

      {/* z-30: the rail's tooltips and the account menu open past its edge,
          over the page, and must not slide under a positioned card there. */}
      {/* w-56: wide enough for the longest label ("Question bank") beside its
          socket, no wider - at w-60 the right third of the panel was empty. */}
      <aside className="hidden md:flex w-56 collapsed:w-20 shrink-0 bg-ink-950 flex-col sticky top-0 z-30 h-screen">
        {/* The logo row is the same in both states; collapsed, the name goes
            sr-only and the logo stays where it was, above the sockets. */}
        <div className="flex h-16 items-center gap-3 pl-4 pr-3">
          {/* Outline outside the logo, not sidebarFocusClass's inset one: inset,
              a white outline on the logo's white disc disappears. */}
          <Link
            href="/dashboard"
            className="flex min-w-0 items-center gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <BrandMark />
            {/* sr-only when collapsed, not hidden: it is the link's name. */}
            <span className="truncate text-lg font-semibold tracking-tight text-white collapsed:sr-only">MYSATuz</span>
          </Link>
        </div>
        {/* On the sidebar's edge, level with the logo, in both states. */}
        <SidebarToggle />

        <ShellNav variant="desktop" adminSlot={desktopAdminNav} />

        {/* Account group: subscription, then the user's own row, which opens
            the account menu (profile, help, student view, sign out). pb-6, not pb-4:
            on /dashboard/profile that row wears the active tab, and the tab's
            lower concave corner (20px, SidebarNotch) has to fit under it. */}
        {/* A hairline between the places and the account: the bottom group is
            about you, not about the work. */}
        <span aria-hidden className="mx-4 mb-3 h-px shrink-0 bg-ink-900" />
        <div className="flex flex-col gap-1 pb-6 pl-3">
          {subscriptionNav}
          {userCard}
        </div>
      </aside>

      {/* tabIndex -1: the skip link moves focus here, so the next Tab starts
          inside the page rather than back at the top of the sidebar. */}
      <main id="content" tabIndex={-1} className="flex-1 min-w-0 overflow-y-auto pb-24 md:pb-0 focus:outline-none">
        {banner}
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-[0_-12px_30px_rgba(15,23,42,0.08)] md:hidden">
        <ShellNav variant="mobile" adminSlot={mobileAdminNav} />
      </nav>
    </div>
  );
}
