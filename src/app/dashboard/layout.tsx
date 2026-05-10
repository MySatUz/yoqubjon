import React from 'react';
import { auth } from "@/auth";
import Link from 'next/link';
import { LayoutDashboard, User, CreditCard, LogOut, Settings, GraduationCap, ShieldCheck } from 'lucide-react';
import { signOut } from "@/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Mobile Nav Header */}
      <div className="md:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between">
        <span className="text-xl font-black text-slate-900">MYSATuz</span>
        <div className="flex items-center gap-3">
          <Link href="/admin" className="p-2 text-slate-500 hover:text-blue-600">
            <ShieldCheck className="w-5 h-5" />
          </Link>
          <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold">
            {session?.user?.name?.[0] || 'U'}
          </div>
        </div>
      </div>

      {/* Sidebar for Desktop */}
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
          <Link 
            href="/dashboard" 
            className="flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 hover:text-blue-600 rounded-xl transition-all font-bold"
          >
            <LayoutDashboard className="w-5 h-5" />
            Practice Center
          </Link>
          <Link 
            href="/dashboard/profile" 
            className="flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 hover:text-blue-600 rounded-xl transition-all font-bold"
          >
            <User className="w-5 h-5" />
            Personal Cabinet
          </Link>
          <Link 
            href="/dashboard/subscription" 
            className="flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 hover:text-blue-600 rounded-xl transition-all font-bold"
          >
            <CreditCard className="w-5 h-5" />
            Subscription
          </Link>
          <Link 
            href="/admin" 
            className="flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 hover:text-blue-600 rounded-xl transition-all font-bold"
          >
            <ShieldCheck className="w-5 h-5" />
            Admin Panel
          </Link>
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="bg-slate-50 rounded-2xl p-4 flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black">
              {session?.user?.name?.[0] || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-slate-900 truncate">{session?.user?.name || 'User'}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{session?.user?.email}</p>
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

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
