import React from 'react';
import Link from 'next/link';
import { GraduationCap } from 'lucide-react';
import ShellNav from '@/components/layout/ShellNav';
import ShellSignOutForm from '@/components/layout/ShellSignOutForm';

type AppShellFrameProps = {
  children: React.ReactNode;
  /** Avatar in the mobile header — session dependent. */
  userAvatar: React.ReactNode;
  /** Name/email card at the bottom of the desktop sidebar — session dependent. */
  userCard: React.ReactNode;
  /** "Admin Panel" entry for the desktop sidebar nav. */
  desktopAdminNav?: React.ReactNode;
  /** "Admin Panel" entry for the mobile bottom bar. */
  mobileAdminNav?: React.ReactNode;
  /** Bar above the page content — the student-view notice. */
  banner?: React.ReactNode;
};

/**
 * Purely synchronous shell: no `auth()`, no database access, nothing to await.
 * It goes out in the first byte, so `loading.tsx` below it can actually be
 * shown. Everything that needs runtime data is injected through the slots
 * above, wrapped by the caller in its own <Suspense> boundary.
 */
export default function AppShellFrame({
  children,
  userAvatar,
  userCard,
  desktopAdminNav,
  mobileAdminNav,
  banner,
}: AppShellFrameProps) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Opaque, no `backdrop-blur`: this bar and the bottom nav are on screen for
          the whole session, and a backdrop filter makes the compositor re-blur the
          full screen width on every scroll frame — for a 95 %-opaque background
          nobody can see. */}
      <div className="sticky top-0 z-40 md:hidden bg-white border-b border-slate-200 p-3 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-lg">
            <GraduationCap className="h-5 w-5" />
          </div>
          <span className="text-xl font-semibold text-slate-900">MYSATuz</span>
        </Link>
        <div className="flex items-center gap-3">
          {userAvatar}
          <ShellSignOutForm variant="mobile" />
        </div>
      </div>

      <aside className="hidden md:flex w-72 bg-white border-r border-slate-200 flex-col sticky top-0 h-screen">
        <div className="p-8">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center shadow-lg">
              <GraduationCap className="text-white w-6 h-6" />
            </div>
            <span className="text-2xl font-semibold text-slate-900 tracking-tight">MYSATuz</span>
          </Link>
        </div>

        <ShellNav variant="desktop" adminSlot={desktopAdminNav} />

        <div className="p-4 border-t border-slate-100">
          {userCard}
          <ShellSignOutForm variant="desktop" />
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto pb-24 md:pb-0">
        {banner}
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-[0_-12px_30px_rgba(15,23,42,0.08)] md:hidden">
        <ShellNav variant="mobile" adminSlot={mobileAdminNav} />
      </nav>
    </div>
  );
}
