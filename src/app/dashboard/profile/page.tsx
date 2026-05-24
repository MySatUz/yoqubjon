import React from 'react';
import { auth } from "@/auth";
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { Award, BookOpen, Calendar, Crown, Mail, Target, TrendingUp, User } from 'lucide-react';

export default async function ProfilePage() {
  const session = await auth();
  
  if (!session?.user?.id) return <div>Unauthorized</div>;

  const userResults = await prisma.result.findMany({
    where: { userId: session.user.id },
    include: { test: true },
    orderBy: { createdAt: 'desc' },
  });

  const avgScore = userResults.length > 0 
    ? Math.round(userResults.reduce((acc, curr) => acc + curr.score, 0) / userResults.length)
    : 0;
  const bestScore = userResults.reduce((best, result) => Math.max(best, result.score), 0);
  const latestResult = userResults[0] || null;

  const totalPracticedTime = userResults.reduce((acc, curr) => acc + curr.timeSpent, 0);
  const formattedTime = Math.round(totalPracticedTime / 60) + " min";
  const subscription = await prisma.subscription.findFirst({
    where: {
      userId: session.user.id,
      isActive: true,
      expiresAt: { gt: new Date() },
    },
    orderBy: { expiresAt: 'desc' },
  });
  const isPremium = subscription?.planId === 'PREMIUM';
  const displayName = session.user.name || 'MYSAT Student';
  const userInitial = displayName[0] || 'U';

  return (
    <div className="px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-blue-600">Student workspace</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-900">Personal Cabinet</h1>
          <p className="mt-2 text-slate-500 font-medium">Your account, progress, subscription, and latest practice history.</p>
        </div>
        <Link
          href="/dashboard"
          className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-black text-white shadow-xl shadow-slate-200 transition hover:bg-blue-600"
        >
          Continue Practice
        </Link>
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          <div className="bg-slate-900 p-8 text-white">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-5">
                <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-blue-600 text-4xl font-black shadow-2xl shadow-blue-950/40">
                  {userInitial}
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-300">Profile</p>
                  <h2 className="mt-2 text-3xl font-black tracking-tight">{displayName}</h2>
                  <p className="mt-1 text-sm font-bold text-slate-300">{session.user.email}</p>
                </div>
              </div>
              <div className={`rounded-2xl px-5 py-4 ${isPremium ? 'bg-green-500/15 text-green-200' : 'bg-white/10 text-slate-200'}`}>
                <div className="flex items-center gap-2 text-sm font-black">
                  <Crown className="h-5 w-5" />
                  {isPremium ? 'Premium active' : 'Free Starter'}
                </div>
                <p className="mt-1 text-xs font-bold opacity-80">
                  {isPremium && subscription
                    ? `Until ${subscription.expiresAt.toLocaleDateString()}`
                    : 'Upgrade when you are ready for full access.'}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-6 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-3xl bg-slate-50 p-5">
              <div className="rounded-2xl bg-white p-3 text-slate-400 shadow-sm">
                <User className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Full name</p>
                <p className="text-base font-black text-slate-900">{displayName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-3xl bg-slate-50 p-5">
              <div className="rounded-2xl bg-white p-3 text-slate-400 shadow-sm">
                <Mail className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email address</p>
                <p className="truncate text-base font-black text-slate-900">{session.user.email}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[
            { label: 'Average Score', value: avgScore, icon: Award, className: 'bg-blue-50 text-blue-600' },
            { label: 'Best Score', value: bestScore, icon: Target, className: 'bg-emerald-50 text-emerald-600' },
            { label: 'Tests Taken', value: userResults.length, icon: BookOpen, className: 'bg-indigo-50 text-indigo-600' },
            { label: 'Total Practice', value: formattedTime, icon: TrendingUp, className: 'bg-amber-50 text-amber-600' },
          ].map((stat) => {
            const Icon = stat.icon;

            return (
              <div key={stat.label} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className={`mb-5 inline-flex rounded-2xl p-3 ${stat.className}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{stat.label}</p>
                <p className="mt-2 text-3xl font-black text-slate-900">{stat.value}</p>
              </div>
            );
          })}
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-600">Recent attempts</p>
              <h2 className="mt-2 text-2xl font-black text-slate-900">Practice history</h2>
            </div>
            {latestResult && (
              <Link href={`/dashboard/results/${latestResult.id}`} className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-700">
                Open Latest Result
              </Link>
            )}
          </div>

          {userResults.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 p-8 text-center text-sm font-bold text-slate-400">
              No attempts yet. Start a module and this area will become your progress map.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {userResults.slice(0, 6).map((result) => (
                <Link
                  key={result.id}
                  href={`/dashboard/results/${result.id}`}
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-5 transition hover:border-blue-200 hover:bg-white hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-base font-black text-slate-900">{result.test.title}</p>
                      <p className="mt-1 text-xs font-bold text-slate-400">
                        {result.createdAt.toLocaleDateString()} · {Math.round(result.timeSpent / 60)} min
                      </p>
                    </div>
                    <span className="rounded-2xl bg-slate-900 px-3 py-2 text-sm font-black text-white">
                      {result.score}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-[2rem] bg-slate-900 p-8 text-white xl:col-span-2">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
            <div>
              <h3 className="flex items-center gap-2 text-2xl font-black">
                <Calendar className="h-6 w-6 text-blue-400" />
                Subscription Status
              </h3>
              <p className="mt-2 max-w-2xl text-sm font-bold leading-relaxed text-slate-300">
                {isPremium
                  ? `Premium access is active until ${subscription?.expiresAt.toLocaleDateString()}.`
                  : 'You are currently on the Free Starter plan. Upgrade when you want all modules and full review.'}
              </p>
            </div>
            <Link href="/dashboard/subscription" className="rounded-2xl bg-blue-600 px-8 py-4 text-center text-sm font-black text-white transition hover:bg-blue-500">
              Manage Subscription
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
