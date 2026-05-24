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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      <div className="md:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-lg shadow-slate-200">
            <GraduationCap className="h-5 w-5" />
          </div>
          <span className="text-xl font-black text-slate-900">MYSATuz</span>
        </Link>
        <div className="flex items-center gap-3">
          {canManageTests && (
            <Link href="/admin" className="p-2 text-slate-500 hover:text-blue-600" aria-label="Admin panel">
              <ShieldCheck className="w-5 h-5" />
            </Link>
          )}
          <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold uppercase">
            {userInitial}
          </div>
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

      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
