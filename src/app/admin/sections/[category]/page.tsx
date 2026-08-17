import { requireAdminPage } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import {
  SECTION_LEADERBOARD_PAGE_SIZE,
  countSectionParticipants,
  fetchSectionLeaderboard,
  formatResultTime,
} from "@/lib/resultSections";
import {
  getCategoryLabel,
  getTestCollections,
  isTestCategory,
  normalizeCategoryId,
} from "@/lib/testCatalog";
import { getCollectionVisibilityRows } from "@/lib/testCollections";
import {
  ArrowLeft,
  Award,
  BarChart3,
  BookOpen,
  ChevronLeft,
  ChevronRight,
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

function parsePage(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);

  return Number.isFinite(parsed) && parsed > 1 ? Math.floor(parsed) : 1;
}

export default async function AdminSectionResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const [{ category }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  // Kept here on purpose: access must not depend on the segment layout.
  await requireAdminPage();
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

  const currentPage = parsePage(resolvedSearchParams?.page);
  const skip = (currentPage - 1) * SECTION_LEADERBOARD_PAGE_SIZE;

  const [visibilityRows, leaderboard, participants, totals] = await Promise.all([
    getCollectionVisibilityRows(),
    fetchSectionLeaderboard(normalizedCategory, {
      take: SECTION_LEADERBOARD_PAGE_SIZE,
      skip,
    }),
    countSectionParticipants(normalizedCategory),
    prisma.result.aggregate({
      where: {
        test: {
          collectionCategory: normalizedCategory,
        },
      },
      _count: { _all: true },
      _sum: { score: true, timeSpent: true },
      _max: { score: true },
    }),
  ]);

  const collections = getTestCollections(visibilityRows);
  const collection = collections.find((item) => item.value === normalizedCategory);
  const sectionLabel = getCategoryLabel(normalizedCategory, collections);
  const sectionDescription = collection?.description || "Practice results in this section.";
  const totalAttempts = totals._count._all;
  const totalScore = totals._sum.score ?? 0;
  const bestScore = totals._max.score ?? 0;
  const totalTimeSpent = totals._sum.timeSpent ?? 0;
  const topThree = currentPage === 1 ? leaderboard.slice(0, 3) : [];
  const totalPages = Math.max(1, Math.ceil(participants / SECTION_LEADERBOARD_PAGE_SIZE));
  const categoryHref = `/admin/sections/${encodeURIComponent(normalizedCategory)}`;

  return (
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
                <p className="mt-1 text-3xl font-black">{participants}</p>
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
            { label: "Participants", value: participants, icon: UserRound, tone: "bg-blue-50 text-blue-600" },
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
              {participants > 0 && (
                <p className="mt-1 text-xs font-bold text-slate-400">
                  Showing {leaderboard.length ? skip + 1 : 0}&ndash;{skip + leaderboard.length} of {participants}
                </p>
              )}
            </div>
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-500">
              <Clock className="h-4 w-4" />
              {formatResultTime(totalTimeSpent)}
            </span>
          </div>

          {leaderboard.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm font-bold text-slate-400">
              {participants > 0
                ? "No users on this page. Go back to the first page."
                : "No users have completed tests in this section yet."}
            </div>
          ) : (
            <div className="space-y-3">
              {leaderboard.map((entry, index) => {
                const rank = skip + index + 1;

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

          {totalPages > 1 && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              {currentPage > 1 ? (
                <Link
                  href={currentPage - 1 === 1 ? categoryHref : `${categoryHref}?page=${currentPage - 1}`}
                  prefetch={false}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 transition hover:border-blue-200 hover:text-blue-600"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Link>
              ) : (
                <span />
              )}
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">
                Page {currentPage} of {totalPages}
              </span>
              {currentPage < totalPages ? (
                <Link
                  href={`${categoryHref}?page=${currentPage + 1}`}
                  prefetch={false}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 transition hover:border-blue-200 hover:text-blue-600"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Link>
              ) : (
                <span />
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
