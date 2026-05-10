import React from 'react';
import { auth } from "@/auth";
import { prisma } from '@/lib/prisma';
import { User, Mail, Calendar, Award, TrendingUp, BookOpen } from 'lucide-react';

export default async function ProfilePage() {
  const session = await auth();
  
  if (!session?.user?.id) return <div>Unauthorized</div>;

  const userResults = await prisma.result.findMany({
    where: { userId: session.user.id },
  });

  const avgScore = userResults.length > 0 
    ? Math.round(userResults.reduce((acc, curr) => acc + curr.score, 0) / userResults.length)
    : 0;

  const totalPracticedTime = userResults.reduce((acc, curr) => acc + curr.timeSpent, 0);
  const formattedTime = Math.round(totalPracticedTime / 60) + " min";

  return (
    <div className="py-10 px-4 sm:px-6 lg:px-8 max-w-4xl">
      <header className="mb-10">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Personal Cabinet</h1>
        <p className="text-slate-500 mt-2 font-medium">Manage your account and track your overall progress.</p>
      </header>

      <div className="grid grid-cols-1 gap-8">
        {/* User Info Card */}
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="h-24 w-24 rounded-3xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-4xl font-black shadow-xl shadow-blue-200">
              {session.user.name?.[0] || 'U'}
            </div>
            <div className="flex-1 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-50 rounded-lg">
                    <User className="w-5 h-5 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Full Name</p>
                    <p className="text-lg font-black text-slate-900">{session.user.name || 'Not provided'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-50 rounded-lg">
                    <Mail className="w-5 h-5 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Email Address</p>
                    <p className="text-lg font-black text-slate-900">{session.user.email}</p>
                  </div>
                </div>
              </div>
              <button className="text-sm font-bold text-blue-600 hover:underline">Edit Profile Info</button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col items-center text-center">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl mb-4">
              <Award className="w-6 h-6" />
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Average Score</p>
            <p className="text-3xl font-black text-slate-900">{avgScore}</p>
          </div>
          
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col items-center text-center">
            <div className="p-3 bg-green-50 text-green-600 rounded-2xl mb-4">
              <BookOpen className="w-6 h-6" />
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tests Taken</p>
            <p className="text-3xl font-black text-slate-900">{userResults.length}</p>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col items-center text-center">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl mb-4">
              <TrendingUp className="w-6 h-6" />
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Practice</p>
            <p className="text-3xl font-black text-slate-900">{formattedTime}</p>
          </div>
        </div>

        {/* Subscription Status */}
        <div className="bg-slate-900 rounded-3xl p-8 text-white relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
            <div>
              <h3 className="text-2xl font-black mb-2 flex items-center gap-2">
                <Calendar className="w-6 h-6 text-blue-400" />
                Subscription Status
              </h3>
              <p className="text-slate-400 font-medium">You are currently on the <span className="text-white font-black underline decoration-blue-500">Free Starter</span> plan.</p>
            </div>
            <button className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-2xl font-black text-sm transition-all transform active:scale-95 shadow-xl shadow-blue-900/50">
              Upgrade to Premium
            </button>
          </div>
          <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl"></div>
        </div>
      </div>
    </div>
  );
}
