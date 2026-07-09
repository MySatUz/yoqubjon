import AppShell from "@/components/layout/AppShell";
import { requireAdminPage } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import {
  buildSectionLeaderboard,
  formatResultTime,
} from "@/lib/resultSections";
import {
  getCategoryLabel,
  getTestCategory,
  getTestCollections,
  isTestCategory,
  normalizeCategoryId,
} from "@/lib/testCatalog";
import {
  ArrowLeft,
  Award,
  BarChart3,
  BookOpen,
  Clock,
  Download,
  Medal,
  Trophy,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function formatDate(value: Date | string | null) {
  if (!value) return "No attempts";

  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getRankTone(rank: number) {
  if (rank === 1) return "bg-amber-100 text-amber-700";
  if (rank === 2) return "bg-slate-200 text-slate-700";
  if (rank === 3) return "bg-orange-100 text-orange-700";
  return "bg-white text-slate-500";
}

export default async function AdminSectionResultsPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const session = await requireAdminPage();
  let decodedCategory = category;

  try {
    decodedCategory = decodeURIComponent(category);
  } catch {
    notFound();
  }

  const normalizedCategory = normalizeCategoryId(decodedCategory);

  if (!isTestCategory(normalizedCategory)) {
    notFound();
  }

  const [visibilityRows, results] = await Promise.all([
    prisma.testCollectionVisibility.findMany({
      select: {
        category: true,
        visible: true,
        label: true,
        description: true,
        position: true,
      },
    }),
    prisma.result.findMany({
      where: {
        test: {
          collectionCategory: normalizedCategory,
        },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        testId: true,
        score: true,
        timeSpent: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
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
    }),
  ]);

  const collections = getTestCollections(visibilityRows);
  const collection = collections.find((item) => item.value === normalizedCategory);
  const sectionLabel = getCategoryLabel(normalizedCategory, collections);
  const sectionDescription = collection?.description || "Practice results in this section.";
  const sectionResults = results.filter((result) => getTestCategory(result.test) === normalizedCategory);
  const leaderboard = buildSectionLeaderboard(sectionResults);
  const totalAttempts = sectionResults.length;
  const totalScore = sectionResults.reduce((sum, result) => sum + result.score, 0);
  const bestScore = sectionResults.reduce((best, result) => Math.max(best, result.score), 0);
  const totalTimeSpent = sectionResults.reduce((sum, result) => sum + result.timeSpent, 0);
  const topThree = leaderboard.slice(0, 3);

  return (
    <AppShell session={session} canManageTests>
      <div className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <Link
              href="/admin/sections"
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-600"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to admin
            </Link>
            <span className="rounded-full bg-blue-50 px-4 py-2 text-xs font-black uppercase tracking-widest text-blue-700">
              Section leaderboard
            </span>
          </div>

          <header className="rounded-[2rem] border border-slate-200 bg-slate-900 p-8 text-white shadow-sm">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-300">
                  Practice section
                </p>
                <h1 className="mt-2 text-4xl font-black tracking-tight">{sectionLabel}</h1>
                <p className="mt-3 max-w-3xl text-sm font-bold leading-relaxed text-slate-300">
                  {sectionDescription}
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <div className="rounded-2xl bg-white/10 px-5 py-4">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">Participants</p>
                  <p className="mt-1 text-3xl font-black">{leaderboard.length}</p>
                </div>
                <a
                  href={`/api/admin/results/sections/export?category=${encodeURIComponent(normalizedCategory.toLowerCase())}`}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-900 transition hover:bg-blue-50 hover:text-blue-700"
                >
                  <Download className="h-4 w-4" />
                  Download CSV
                </a>
              </div>
            </div>
          </header>

          <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Participants", value: leaderboard.length, icon: UserRound, tone: "bg-blue-50 text-blue-600" },
              { label: "Tests solved", value: totalAttempts, icon: BookOpen, tone: "bg-emerald-50 text-emerald-600" },
              { label: "Total score", value: totalScore, icon: BarChart3, tone: "bg-slate-100 text-slate-700" },
              { label: "Best score", value: bestScore, icon: Award, tone: "bg-amber-50 text-amber-600" },
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

          {topThree.length > 0 && (
            <section className="mt-8 grid gap-4 md:grid-cols-3">
              {topThree.map((entry, index) => {
                const rank = index + 1;

                return (
                  <Link
                    key={entry.userId}
                    href={`/admin/users/${entry.userId}`}
                    prefetch={false}
                    className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl"
                  >
                    <div className="mb-5 flex items-start justify-between gap-4">
                      <span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${getRankTone(rank)}`}>
                        {rank === 1 ? <Trophy className="h-6 w-6" /> : <Medal className="h-6 w-6" />}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">
                        #{rank}
                      </span>
                    </div>
                    <h2 className="truncate text-xl font-black text-slate-900">
                      {entry.name || entry.email}
                    </h2>
                    <p className="mt-1 truncate text-sm font-bold text-slate-500">{entry.email}</p>
                    <div className="mt-5 grid grid-cols-2 gap-2 text-xs font-black text-slate-600">
                      <span className="rounded-2xl bg-slate-50 px-3 py-2">{entry.totalScore} total</span>
                      <span className="rounded-2xl bg-slate-50 px-3 py-2">{entry.attempts} attempts</span>
                      <span className="rounded-2xl bg-slate-50 px-3 py-2">{entry.averageScore} avg</span>
                      <span className="rounded-2xl bg-slate-50 px-3 py-2">{entry.bestScore} best</span>
                    </div>
                  </Link>
                );
              })}
            </section>
          )}

          <section className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-600">
                  Ranked users
                </p>
                <h2 className="mt-2 text-2xl font-black text-slate-900">Section results</h2>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-500">
                <Clock className="h-4 w-4" />
                {formatResultTime(totalTimeSpent)}
              </span>
            </div>

            {leaderboard.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm font-bold text-slate-400">
                No users have completed tests in this section yet.
              </div>
            ) : (
              <div className="space-y-3">
                {leaderboard.map((entry, index) => {
                  const rank = index + 1;

                  return (
                    <Link
                      key={entry.userId}
                      href={`/admin/users/${entry.userId}`}
                      prefetch={false}
                      className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-blue-200 hover:bg-white md:grid-cols-[auto_1fr_auto]"
                    >
                      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-black ${getRankTone(rank)}`}>
                        #{rank}
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-black text-slate-900">
                          {entry.name || entry.email}
                        </h3>
                        <p className="mt-1 truncate text-sm font-bold text-slate-500">{entry.email}</p>
                        <p className="mt-2 text-xs font-bold text-slate-400">
                          Last attempt: {formatDate(entry.latestAt)}
                        </p>
                      </div>
                      <div className="grid gap-2 text-xs font-black text-slate-600 sm:grid-cols-5 md:min-w-[36rem]">
                        <span className="rounded-2xl bg-white px-3 py-2">{entry.totalScore} total</span>
                        <span className="rounded-2xl bg-white px-3 py-2">{entry.attempts} attempts</span>
                        <span className="rounded-2xl bg-white px-3 py-2">{entry.uniqueTests} tests</span>
                        <span className="rounded-2xl bg-white px-3 py-2">{entry.averageScore} avg</span>
                        <span className="rounded-2xl bg-white px-3 py-2">{entry.bestScore} best</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
