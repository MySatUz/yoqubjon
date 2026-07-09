'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { CreditCard, LayoutDashboard, ShieldCheck, User } from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Practice Center', shortLabel: 'Practice', icon: LayoutDashboard },
  { href: '/dashboard/profile', label: 'Personal Cabinet', shortLabel: 'Cabinet', icon: User },
  { href: '/dashboard/subscription', label: 'Subscription', shortLabel: 'Subscription', icon: CreditCard },
];

function isActivePath(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

type ShellNavProps = {
  canManageTests: boolean;
  variant: 'desktop' | 'mobile';
};

export default function ShellNav({ canManageTests, variant }: ShellNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const items = canManageTests
    ? [...navItems, { href: '/admin', label: 'Admin Panel', shortLabel: 'Admin', icon: ShieldCheck }]
    : navItems;

  if (variant === 'mobile') {
    return (
      <div className={`mx-auto grid max-w-md gap-1 ${items.length === 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              onMouseEnter={() => router.prefetch(item.href)}
              onFocus={() => router.prefetch(item.href)}
              className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[10px] font-black transition-colors ${
                active
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-slate-500 hover:bg-blue-50 hover:text-blue-600'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="max-w-full truncate">{item.shortLabel}</span>
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <nav className="flex-1 px-4 space-y-2">
      {items.map((item) => {
        const Icon = item.icon;
        const active = isActivePath(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            onMouseEnter={() => router.prefetch(item.href)}
            onFocus={() => router.prefetch(item.href)}
            className={`flex items-center gap-3 rounded-xl px-4 py-3 font-bold transition-all ${
              active
                ? 'bg-blue-50 text-blue-600'
                : 'text-slate-600 hover:bg-slate-50 hover:text-blue-600'
            }`}
          >
            <Icon className="w-5 h-5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
