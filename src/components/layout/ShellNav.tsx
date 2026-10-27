'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClipboardList, CreditCard, GraduationCap, LayoutDashboard, Library, Presentation, ShieldCheck, User, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { RailTooltip, sidebarFocusClass } from '@/components/layout/RailTooltip';
import { focusRingClass } from '@/components/ui/Button';

type NavItem = {
  href: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
};

type ShellNavVariant = 'desktop' | 'mobile';

/**
 * The top of the desktop sidebar holds only the places a student works in.
 * Account things sit in the sidebar's bottom group: the subscription, and the
 * user's own row, which opens the account menu (ShellUserMenu: profile, help,
 * student view, sign out), as in most product UIs. The mobile bottom bar shows
 * the places plus Subscription and Profile.
 */
const workItems: NavItem[] = [
  { href: '/dashboard', label: 'Practice', shortLabel: 'Practice', icon: LayoutDashboard },
  // Also lit on /dashboard/results/[id]: a single result is part of the list.
  { href: '/dashboard/results', label: 'Results', shortLabel: 'Results', icon: ClipboardList },
];

const subscriptionItem: NavItem = {
  href: '/dashboard/subscription',
  label: 'Subscription',
  shortLabel: 'Subscription',
  icon: CreditCard,
};

const profileItem: NavItem = {
  href: '/dashboard/profile',
  label: 'Profile',
  shortLabel: 'Profile',
  icon: User,
};

/**
 * The phone's one admin tab. There is no admin hub page: it opens Courses,
 * and every admin page carries the other admin places on a phone
 * (AdminMobileNav).
 */
const adminItem: NavItem = {
  href: '/admin/courses',
  label: 'Admin',
  shortLabel: 'Admin',
  icon: ShieldCheck,
};

function isActivePath(pathname: string, href: string) {
  // An olympiad is opened from a Practice collection and sits in the same
  // shell, so Practice stays lit on it.
  if (href === '/dashboard') return pathname === href || pathname.startsWith('/olympiad/');
  if (href === adminItem.href) return pathname === '/admin' || pathname.startsWith('/admin/');
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The two concave corners that make the active row look cut out of the
 * sidebar: each is a 20px square of the canvas colour minus a quarter circle,
 * sitting just above and below the row at the sidebar's right edge. Plain
 * SVG paths — no gradient or shadow tricks. `fill-gray-100` must match the
 * canvas behind the sidebar (AppShellFrame) and the row's own background.
 */
export function SidebarNotch() {
  return (
    <>
      <svg aria-hidden viewBox="0 0 20 20" className="pointer-events-none absolute -top-5 right-0 h-5 w-5 fill-gray-100">
        <path d="M20 0V20H0A20 20 0 0 0 20 0Z" />
      </svg>
      <svg aria-hidden viewBox="0 0 20 20" className="pointer-events-none absolute -bottom-5 right-0 h-5 w-5 fill-gray-100">
        <path d="M0 0H20V20A20 20 0 0 0 0 0Z" />
      </svg>
    </>
  );
}

/**
 * One desktop sidebar row. It runs to the sidebar's right edge (the groups have
 * no right padding), so when active its canvas-coloured band joins the page
 * beside it. `socket` is the 40px circle on the left — an icon, or the avatar
 * on the profile row — which fills with the accent when the row is active.
 *
 * Colours are for the navy sidebar (`ink-950`): labels `ink-100`,
 * icons `ink-200`, hover `ink-900`. The active socket stays `ink-600`, the
 * accent, so it is the brightest thing in the panel. Keyboard focus is a
 * white outline: the accent outline would vanish on `ink-950`.
 *
 * Collapsed, the label goes sr-only rather than away, so the link keeps its
 * name, and `tooltip` shows it beside the rail on hover and on focus.
 */
function SidebarRow({
  href,
  tooltip,
  active,
  socket,
  children,
}: {
  href: string;
  tooltip: string;
  active: boolean;
  socket: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`group relative flex h-12 items-center gap-3 rounded-l-full pl-1 pr-3 text-sm font-medium transition-colors ${sidebarFocusClass} ${
        active ? 'bg-gray-100 text-ink-600' : 'text-ink-100 hover:bg-ink-900 hover:text-white'
      }`}
    >
      {/* Hover lights the whole row in the active tab's own shape (rounded
          on the left, running to the edge), a faint preview of the tab. */}
      {active && <SidebarNotch />}
      <span
        className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${
          active ? 'bg-ink-600 text-white' : 'text-ink-200 group-hover:text-white'
        }`}
      >
        {socket}
      </span>
      <span className="min-w-0 flex-1 collapsed:sr-only">{children}</span>
      <RailTooltip>{tooltip}</RailTooltip>
    </Link>
  );
}

/**
 * No `prefetch` prop on purpose — the default is what we want here.
 *
 * These are a handful of permanently visible entries (fixed sidebar on
 * desktop, bottom bar on mobile), so viewport-triggered prefetching fires once
 * and is done. For a dynamic route the default only prefetches the shell down
 * to the nearest `loading.js` boundary, which every one of these targets has,
 * so the cost is small and the payoff is an instant skeleton on tap.
 *
 * The previous `prefetch={false}` + manual `router.prefetch()` on
 * `onMouseEnter`/`onFocus` did nothing on touch devices, where `mouseenter`
 * either never arrives or arrives simultaneously with the tap.
 */
function NavLink({ item, variant, active }: { item: NavItem; variant: ShellNavVariant; active: boolean }) {
  const Icon = item.icon;

  if (variant === 'mobile') {
    return (
      <Link
        href={item.href}
        aria-current={active ? 'page' : undefined}
        className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg py-1 text-[11px] font-medium transition-colors ${focusRingClass} ${
          active ? 'text-ink-600' : 'text-gray-500 hover:text-gray-900'
        }`}
      >
        <span
          className={`flex h-8 w-14 items-center justify-center rounded-full transition-colors ${
            active ? 'bg-ink-600 text-white' : ''
          }`}
        >
          <Icon className="h-5 w-5" />
        </span>
        <span className="max-w-full truncate">{item.shortLabel}</span>
      </Link>
    );
  }

  return (
    <SidebarRow href={item.href} tooltip={item.label} active={active} socket={<Icon className="h-5 w-5" />}>
      <span className="block truncate">{item.label}</span>
    </SidebarRow>
  );
}

/**
 * The admin's places, straight in the sidebar and seen by admins only: there
 * is no "Admin Panel" page to go through. A test belongs to a course, so a
 * test's editor and its stats keep Courses lit. Payments are not here: they
 * are part of Subscription, whose row carries the count of requests waiting.
 */
export const adminItems: NavItem[] = [
  { href: '/admin/courses', label: 'Courses', shortLabel: 'Courses', icon: GraduationCap },
  { href: '/admin/users', label: 'Users', shortLabel: 'Users', icon: Users },
  { href: '/admin/bank', label: 'Question bank', shortLabel: 'Bank', icon: Library },
  { href: '/admin/board', label: 'Board', shortLabel: 'Board', icon: Presentation },
];

export function isAdminActive(pathname: string, href: string) {
  if (href === '/admin/courses' && pathname.startsWith('/admin/tests')) return true;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The admin entries, streamed in from a <Suspense> island once `isAdminUser()`
 * resolves, without blocking the rest of the nav. Client component because
 * the active state needs `usePathname()`.
 *
 * On a phone it is the one "Admin" tab. On desktop it is a labelled group with
 * every admin place.
 */
export function ShellAdminNavLink({ variant }: { variant: ShellNavVariant }) {
  const pathname = usePathname();

  if (variant === 'mobile') {
    return <NavLink item={adminItem} variant="mobile" active={isActivePath(pathname, adminItem.href)} />;
  }

  return (
    <div role="group" aria-labelledby="admin-nav-label" className="mt-3 flex flex-col gap-1">
      <p id="admin-nav-label" className="px-4 pb-1 text-xs font-medium text-ink-200 collapsed:sr-only">
        Admin
      </p>
      {/* Collapsed, the "Admin" caption is gone from sight: a short rule under
          the icon column still marks where the student's places end. */}
      <span aria-hidden className="mb-2 ml-1 hidden h-px w-10 bg-ink-900 collapsed:block" />
      {adminItems.map((item) => (
        <NavLink key={item.href} item={item} variant="desktop" active={isAdminActive(pathname, item.href)} />
      ))}
    </div>
  );
}

/**
 * Subscription row for the desktop sidebar's bottom group. For an admin it
 * also holds the payment requests, and carries the number waiting for a
 * decision - shown only when there are some, so it means "act now".
 */
export function ShellSubscriptionLink({ pendingPayments = 0 }: { pendingPayments?: number }) {
  const pathname = usePathname();
  const item = subscriptionItem;
  const Icon = item.icon;
  const showCount = pendingPayments > 0;

  return (
    <SidebarRow
      href={item.href}
      tooltip={showCount ? `${item.label} · ${pendingPayments} ${pendingPayments === 1 ? 'payment' : 'payments'} waiting` : item.label}
      active={isActivePath(pathname, item.href)}
      socket={
        <>
          <Icon className="h-5 w-5" />
          {/* The count is in the label, which the collapsed rail hides: a dot
              on the icon keeps "act now" visible there. */}
          {showCount && (
            <span aria-hidden className="absolute right-1.5 top-1.5 hidden h-2 w-2 rounded-full bg-white collapsed:block" />
          )}
        </>
      }
    >
      <span className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        {showCount && (
          <span className="shrink-0 rounded-full bg-white px-1.5 text-xs font-medium tabular-nums text-ink-950">
            {pendingPayments}
            <span className="sr-only"> {pendingPayments === 1 ? 'payment' : 'payments'} waiting</span>
          </span>
        )}
      </span>
    </SidebarRow>
  );
}

type ShellNavProps = {
  variant: ShellNavVariant;
  /** Slot for the admin entry (a <Suspense> island, or nothing for regular users). */
  adminSlot?: React.ReactNode;
};

export default function ShellNav({ variant, adminSlot }: ShellNavProps) {
  const pathname = usePathname();
  const items = variant === 'mobile' ? [...workItems, subscriptionItem, profileItem] : workItems;

  const links = items.map((item) => (
    <NavLink key={item.href} item={item} variant={variant} active={isActivePath(pathname, item.href)} />
  ));

  if (variant === 'mobile') {
    return (
      <div className="mx-auto flex max-w-md">
        {links}
        {adminSlot}
      </div>
    );
  }

  return (
    <nav className="flex flex-1 flex-col gap-1 py-4 pl-3">
      {links}
      {adminSlot}
    </nav>
  );
}
