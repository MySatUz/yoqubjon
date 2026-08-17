import { requireAdminPage } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import {
  buildSectionResultSummaries,
  formatResultTime,
} from "@/lib/resultSections";
import { getTestCollections } from "@/lib/testCatalog";
import { getCollectionVisibilityRows } from "@/lib/testCollections";
import {
  ArrowLeft,
  Award,
  BarChart3,
  BookOpen,
  Clock,
  Mail,
  Target,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// An active student accumulates attempts without bound, and every attempt used
// to add a card to this page. The summary numbers below come from an aggregate
// instead of this slice, so capping the list does not change them.
const RESULT_LIST_LIMIT = 100;

function formatDate(value: Date | string) {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function AdminUserResultsPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  // Kept here on purpose: access must not depend on the segment layout.
  await requireAdminPage();

  const [user, visibilityRows, totals] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        results: {
          orderBy: { createdAt: "desc" },
          take: RESULT_LIST_LIMIT,
          select: {
            id: true,
            testId: true,
            score: true,
            timeSpent: true,
            createdAt: true,
            test: {
              select: {
                id: true,
                title: true,
                description: true,
                collectionCategory: true,
                createdAt: true,
              },
            },
          },
        },
      },
    }),
    getCollectionVisibilityRows(),
    prisma.result.aggregate({
      where: { userId },
      _count: { _all: true },
      _sum: { score: true, timeSpent: true },
      _max: { score: true },
    }),
  ]);

  if (!user) {
    notFound();
  }

  const collections = getTestCollections(visibilityRows);
  const sectionSummaries = buildSectionResultSummaries(user.results, collections);
  // Computed over the full history in the database, not over the capped list.
  const totalAttempts = totals._count._all;
  const totalScore = totals._sum.score ?? 0;
  const bestScore = totals._max.score ?? 0;
  const averageScore = totalAttempts > 0 ? Math.round(totalScore / totalAttempts) : 0;
  const totalTimeSpent = totals._sum.timeSpent ?? 0;
  const listedAttempts = user.results.length;
  const isTruncated = totalAttempts > listedAttempts;
  const displayName = user.name || user.email;
  const initial = displayName[0] || "U";

  return (
    <div className="px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/admin/users"
          className="mb-6 inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to admin
        </Link>

        <header className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          <div className="bg-slate-900 p-8 text-white">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 items-center gap-5">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-blue-600 text-3xl font-black shadow-2xl shadow-blue-950/40">
                  {initial}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-300">
                    User result profile
                  </p>
                  <h1 className="mt-2 truncate text-3xl font-black tracking-tight md:text-4xl">
                    {displayName}
                  </h1>
                  <p className="mt-2 flex min-w-0 items-center gap-2 text-sm font-bold text-slate-300">
                    <Mail className="h-4 w-4 shrink-0" />
                    <span className="truncate">{user.email}</span>
                  </p>
                </div>
              </div>

              <div className="rounded-2xl bg-white/10 px-5 py-4 text-sm font-black text-slate-200">
                <div className="flex items-center gap-2">
                  <UserRound className="h-5 w-5 text-blue-300" />
                  {user.role}
                </div>
                <p className="mt-1 text-xs font-bold text-slate-400">
                  Joined {formatDate(user.createdAt)}
                </p>
              </div>
            </div>
          </div>
        </header>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Tests solved", value: totalAttempts, icon: BookOpen, tone: "bg-blue-50 text-blue-600" },
            { label: "Total score", value: totalScore, icon: BarChart3, tone: "bg-slate-100 text-slate-700" },
            { label: "Average score", value: averageScore, icon: Award, tone: "bg-emerald-50 text-emerald-600" },
            { label: "Best score", value: bestScore, icon: Target, tone: "bg-amber-50 text-amber-600" },
          ].map((stat) => {
            const Icon = stat.icon;

            return (
              <div key={stat.label} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className={`mb-5 inline-flex rounded-2xl p-3 ${stat.tone}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {stat.label}
                </p>
                <p className="mt-2 text-3xl font-black text-slate-900">{stat.value}</p>
              </div>
            );
          })}
        </section>

        <section className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-600">
                Section breakdown
              </p>
              <h2 className="mt-2 text-2xl font-black text-slate-900">Results by section</h2>
              {isTruncated && (
                // The four tiles above cover every attempt; this breakdown is
                // built from the capped list, so say so instead of showing
                // numbers that silently disagree with the tiles.
                <p className="mt-1 text-xs font-bold text-slate-400">
                  Latest {listedAttempts} of {totalAttempts} attempts
                </p>
              )}
            </div>
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-500">
              <Clock className="h-4 w-4" />
              {formatResultTime(totalTimeSpent)}
            </span>
          </div>

          {sectionSummaries.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm font-bold text-slate-400">
              This user has not completed any tests yet.
            </div>
          ) : (
            <div className="space-y-5">
              {sectionSummaries.map((section) => (
                <article key={section.categoryKey} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h3 className="text-xl font-black text-slate-900">{section.label}</h3>
                      <p className="mt-1 max-w-2xl text-sm font-bold leading-relaxed text-slate-500">
                        {section.description}
                      </p>
                    </div>
                    <div className="grid gap-2 text-xs font-black text-slate-600 sm:grid-cols-4 lg:min-w-[34rem]">
                      <span className="rounded-2xl bg-white px-3 py-2">{section.attempts} attempts</span>
                      <span className="rounded-2xl bg-white px-3 py-2">{section.uniqueTests} tests</span>
                      <span className="rounded-2xl bg-white px-3 py-2">{section.totalScore} total</span>
                      <span className="rounded-2xl bg-white px-3 py-2">{section.bestScore} best</span>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    {section.results.map((result) => (
                      <div
                        key={result.id}
                        className="rounded-2xl border border-slate-200 bg-white p-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-slate-900">
                              {result.testTitle}
                            </p>
                            <p className="mt-1 text-xs font-bold text-slate-400">
                              {formatDate(result.createdAt)} - {formatResultTime(result.timeSpent)}
                            </p>
                          </div>
                          <span className="rounded-2xl bg-slate-900 px-3 py-2 text-sm font-black text-white">
                            {result.score}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
