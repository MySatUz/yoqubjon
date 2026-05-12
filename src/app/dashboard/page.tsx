import React from 'react';
import { auth } from "@/auth";
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { History, LayoutDashboard, CheckCircle2, Lock } from 'lucide-react';

export default async function DashboardPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const session = await auth();
  const isSuccess = searchParams.payment === 'success';
  
  if (!session?.user?.id) {
    return <div>Unauthorized</div>;
  }

  // Fetch data in parallel
  const [results, tests, subscription] = await Promise.all([
    prisma.result.findMany({
      where: { userId: session.user.id },
      include: { test: true },
      orderBy: { createdAt: 'desc' },
      take: 5
    }),
    prisma.test.findMany({
      orderBy: { createdAt: 'desc' }
    }),
    prisma.subscription.findFirst({
      where: { 
        userId: session.user.id,
        isActive: true,
        expiresAt: { gt: new Date() }
      }
    })
  ]);

  const isPremium = !!subscription;

  return (
    <div className="py-10 px-4 sm:px-6 lg:px-8">
      {isSuccess && (
        <div className="mb-8 p-4 bg-green-500 text-white rounded-2xl font-black flex items-center justify-between shadow-lg shadow-green-200 animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6" />
            <span>Welcome to Premium! Your account has been upgraded.</span>
          </div>
          <Link href="/dashboard" className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg transition-colors">Dismiss</Link>
        </div>
      )}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-3">
            <header className="mb-10">
              <h1 className="text-4xl font-black text-slate-900 tracking-tight">Practice Center</h1>
              <p className="text-slate-500 mt-2 text-lg font-medium">Select a module to sharpen your skills.</p>
            </header>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {tests.map((test) => {
                const canAccess = test.isFree || isPremium;
                
                return (
                  <div 
                    key={test.id}
                    className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200 hover:shadow-xl hover:shadow-blue-900/5 transition-all group relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -mr-16 -mt-16 transition-transform group-hover:scale-110"></div>
                    
                    <div className="relative z-10">
                      <div className="flex justify-between items-start mb-6">
                        <div className={`p-4 rounded-2xl ${canAccess ? 'bg-blue-600' : 'bg-slate-100'} text-white shadow-lg ${canAccess ? 'shadow-blue-200' : ''}`}>
                          {canAccess ? <LayoutDashboard className="w-6 h-6" /> : <Lock className="w-6 h-6 text-slate-400" />}
                        </div>
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                          test.isFree 
                            ? 'bg-green-100 text-green-700 border-green-200' 
                            : 'bg-amber-100 text-amber-700 border-amber-200'
                        }`}>
                          {test.isFree ? 'Free Access' : 'Premium'}
                        </span>
                      </div>
                      
                      <h3 className="text-2xl font-black text-slate-900 mb-3">{test.title}</h3>
                      <p className="text-slate-500 text-sm mb-8 font-medium leading-relaxed">
                        {test.description || 'Standard Digital SAT practice module.'}
                      </p>

                      {canAccess ? (
                        <Link 
                          href={`/exam/${test.id}`}
                          className="inline-flex items-center justify-center w-full py-4 px-6 rounded-2xl text-sm font-black text-white bg-slate-900 hover:bg-blue-600 transition-all transform active:scale-95 shadow-xl shadow-slate-200"
                        >
                          Start Practice Module
                        </Link>
                      ) : (
                        <div className="space-y-4">
                          <Link 
                            href="/dashboard/subscription"
                            className="inline-flex items-center justify-center w-full py-4 px-6 rounded-2xl text-sm font-black text-white bg-blue-600 hover:bg-blue-700 transition-all transform active:scale-95 shadow-xl shadow-blue-100"
                          >
                            Unlock with Premium
                          </Link>
                          <button disabled className="w-full py-3 text-xs font-bold text-slate-400 uppercase tracking-widest">
                            Module Locked
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {tests.length === 0 && (
                <div className="col-span-full py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 text-center">
                  <p className="text-slate-400 font-bold">No tests available yet. Check back later!</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar: Recent Activity */}
          <div className="lg:col-span-1">
            <h2 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
              <History className="w-5 h-5 text-blue-600" />
              Recent Activity
            </h2>
            
            <div className="space-y-4">
              {results.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 border border-dashed border-slate-300 text-center">
                  <p className="text-slate-400 text-sm font-medium">No tests completed yet. Start your first practice!</p>
                </div>
              ) : (
                results.map((res) => (
                  <Link 
                    key={res.id} 
                    href={`/dashboard/results/${res.id}`}
                    className="block bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-300 hover:shadow-md transition-all group"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {new Date(res.createdAt).toLocaleDateString()}
                      </span>
                      <span className="text-lg font-black text-blue-600 group-hover:scale-110 transition-transform">
                        {res.score}
                      </span>
                    </div>
                    <h4 className="text-sm font-black text-slate-900 mb-1 group-hover:text-blue-600 transition-colors">
                      {res.test.title}
                    </h4>
                    <div className="flex items-center gap-2 mt-3">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-600 rounded-full" 
                          style={{ width: `${(res.score / 800) * 100}%` }}
                        ></div>
                      </div>
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    </div>
                  </Link>
                ))
              )}
            </div>

            <div className="mt-8 p-6 bg-slate-900 rounded-2xl text-white overflow-hidden relative">
              <div className="relative z-10">
                <h3 className="font-black text-lg mb-2">Target Score: 800</h3>
                <p className="text-slate-400 text-xs font-medium leading-relaxed mb-4">
                  Keep practicing to reach your goal. Our AI analysis will help you identify weak areas.
                </p>
                <button className="text-xs font-black text-blue-400 hover:text-blue-300 transition-colors uppercase tracking-widest">
                  View Analytics →
                </button>
              </div>
              <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-blue-600/20 rounded-full blur-2xl"></div>
            </div>
          </div>
        </div>
    </div>
  );
}
