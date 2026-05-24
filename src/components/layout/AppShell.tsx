import React from 'react';
import Link from 'next/link';
import { CreditCard, GraduationCap, LayoutDashboard, LogOut, ShieldCheck, User } from 'lucide-react';
import { signOut } from '@/auth';

type ShellSession = {
  user?: {
    name?: string | null;
    email?: string | null;
  } | null;
} | null;

type AppShellProps = {
  children: React.ReactNode;
  session: ShellSession;
  canManageTests: boolean;
};

const navItems = [
  { href: '/dashboard', label: 'Practice Center', icon: LayoutDashboard },
  { href: '/dashboard/profile', label: 'Personal Cabinet', icon: User },
  { href: '/dashboard/subscription', label: 'Subscription', icon: CreditCard },
];

export default function AppShell({ children, session, canManageTests }: AppShellProps) {
  const userInitial = session?.user?.name?.[0] || session?.user?.email?.[0] || 'U';
  const mobileNavItems = canManageTests
    ? [...navItems, { href: '/admin', label: 'Admin', icon: ShieldCheck }]
    : navItems;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      <div className="sticky top-0 z-40 md:hidden bg-white/95 backdrop-blur border-b border-slate-200 p-3 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-lg shadow-slate-200">
            <GraduationCap className="h-5 w-5" />
          </div>
          <span className="text-xl font-black text-slate-900">MYSATuz</span>
        </Link>
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold uppercase">
            {userInitial}
          </div>
          <form action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}>
            <button className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 transition-colors hover:bg-red-50" aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>

      <aside className="hidden md:flex w-72 bg-white border-r border-slate-200 flex-col sticky top-0 h-screen">
        <div className="p-8">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center shadow-lg shadow-slate-200">
              <GraduationCap className="text-white w-6 h-6" />
            </div>
            <span className="text-2xl font-black text-slate-900 tracking-tight">MYSATuz</span>
          </Link>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 hover:text-blue-600 rounded-xl transition-all font-bold"
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}

          {canManageTests && (
            <Link
              href="/admin"
              className="flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 hover:text-blue-600 rounded-xl transition-all font-bold"
            >
              <ShieldCheck className="w-5 h-5" />
              Admin Panel
            </Link>
          )}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="bg-slate-50 rounded-2xl p-4 flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black uppercase">
              {userInitial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-slate-900 truncate">{session?.user?.name || 'User'}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">
                {session?.user?.email}
              </p>
            </div>
          </div>
          <form action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}>
            <button className="flex items-center justify-center gap-2 w-full py-3 text-red-500 font-bold hover:bg-red-50 rounded-xl transition-colors">
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto pb-24 md:pb-0">
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-[0_-12px_30px_rgba(15,23,42,0.08)] backdrop-blur md:hidden">
        <div className={`mx-auto grid max-w-md gap-1 ${mobileNavItems.length === 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>
          {mobileNavItems.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[10px] font-black text-slate-500 transition-colors hover:bg-blue-50 hover:text-blue-600"
              >
                <Icon className="h-5 w-5" />
                <span className="max-w-full truncate">
                  {item.label === 'Practice Center'
                    ? 'Practice'
                    : item.label === 'Personal Cabinet'
                      ? 'Cabinet'
                      : item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
