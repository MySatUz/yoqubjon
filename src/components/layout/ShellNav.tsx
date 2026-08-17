'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CreditCard, LayoutDashboard, ShieldCheck, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type NavItem = {
  href: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
};

type ShellNavVariant = 'desktop' | 'mobile';

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Practice Center', shortLabel: 'Practice', icon: LayoutDashboard },
  { href: '/dashboard/profile', label: 'Personal Cabinet', shortLabel: 'Cabinet', icon: User },
  { href: '/dashboard/subscription', label: 'Subscription', shortLabel: 'Subscription', icon: CreditCard },
];

const adminItem: NavItem = {
  href: '/admin',
  label: 'Admin Panel',
  shortLabel: 'Admin',
  icon: ShieldCheck,
};

function isActivePath(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * No `prefetch` prop on purpose — the default is what we want here.
 *
 * These are three or four permanently visible entries (fixed sidebar on
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
        className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[10px] font-medium transition-colors ${
          active
            ? 'bg-blue-50 text-blue-600'
            : 'text-slate-500 hover:bg-blue-50 hover:text-blue-600'
        }`}
      >
        <Icon className="h-5 w-5" />
        <span className="max-w-full truncate">{item.shortLabel}</span>
      </Link>
    );
  }

  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 rounded-xl px-4 py-3 font-semibold transition-all ${
        active
          ? 'bg-blue-50 text-blue-600'
          : 'text-slate-600 hover:bg-slate-50 hover:text-blue-600'
      }`}
    >
      <Icon className="w-5 h-5" />
      {item.label}
    </Link>
  );
}

/**
 * The "Admin Panel" entry rendered on its own, so it can be streamed in from a
 * <Suspense> island once `isAdminUser()` resolves without blocking the rest of
 * the nav. Client component because the active state needs `usePathname()`.
 */
export function ShellAdminNavLink({ variant }: { variant: ShellNavVariant }) {
  const pathname = usePathname();

  return <NavLink item={adminItem} variant={variant} active={isActivePath(pathname, adminItem.href)} />;
}

type ShellNavProps = {
  variant: ShellNavVariant;
  /** Slot for the admin entry (a <Suspense> island, or nothing for regular users). */
  adminSlot?: React.ReactNode;
};

export default function ShellNav({ variant, adminSlot }: ShellNavProps) {
  const pathname = usePathname();

  const links = navItems.map((item) => (
    <NavLink key={item.href} item={item} variant={variant} active={isActivePath(pathname, item.href)} />
  ));

  if (variant === 'mobile') {
    return (
      <div className="mx-auto flex max-w-md gap-1">
        {links}
        {adminSlot}
      </div>
    );
  }

  return (
    <nav className="flex-1 px-4 space-y-2">
      {links}
      {adminSlot}
    </nav>
  );
}
