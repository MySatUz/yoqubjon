import { cache, Suspense } from "react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildSectionResultSummaries, formatResultTime } from "@/lib/resultSections";
import { getTestCollections } from "@/lib/testCatalog";
import { getCollectionVisibilityRows } from "@/lib/testCollections";
import { Award, BookOpen, Calendar, Crown, Mail, Target, TrendingUp, User } from "lucide-react";
import Link from "next/link";

/**
 * How many attempts the section history renders. The headline metrics below are
 * database aggregates over *all* attempts, so this cap only shortens the list —
 * it never changes a number on screen.
 */
const HISTORY_LIMIT = 50;

/**
 * Two regions need the same row, so the reads are memoized per request: React
 * `cache()` collapses them into a single Prisma call even though they now live
 * behind separate `<Suspense>` boundaries.
 */
const getActiveSubscription = cache((userId: string) =>
  prisma.subscription.findFirst({
    where: {
      userId,
      isActive: true,
      expiresAt: { gt: new Date() },
    },
    orderBy: { expiresAt: "desc" },
  })
);

const getResultTotals = cache((userId: string) =>
  prisma.result.aggregate({
    where: { userId },
    _count: { _all: true },
    _avg: { score: true },
    _max: { score: true },
    _sum: { timeSpent: true },
  })
);

/**
 * `auth()` and the "Unauthorized" branch stay above every boundary: after a
 * fallback is flushed the HTTP status can no longer change (`loading.md`,
 * "Status Codes"). Everything below streams in independently.
 */
export default async function ProfilePage() {
  const session = await auth();

  if (!session?.user?.id) return <div>Unauthorized</div>;

  const userId = session.user.id;
  const displayName = session.user.name || "MYSAT Student";
  const email = session.user.email;

  return (
    <div className="px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-blue-600">Student workspace</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-900">Personal Cabinet</h1>
          <p className="mt-2 font-medium text-slate-500">Your account, progress, subscription, and latest practice history.</p>
        </div>
        <Link
          href="/dashboard"
          className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-black text-white shadow-xl shadow-slate-200 transition hover:bg-blue-600"
        >
          Continue Practice
        </Link>
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Suspense fallback={<ProfileCardFallback />}>
          <ProfileCard userId={userId} displayName={displayName} email={email} />
        </Suspense>

        <Suspense fallback={<StatsGridFallback />}>
          <StatsGrid userId={userId} />
        </Suspense>

        <Suspense fallback={<SectionHistoryFallback />}>
          <SectionHistory userId={userId} />
        </Suspense>

        <Suspense fallback={<SubscriptionBannerFallback />}>
          <SubscriptionBanner userId={userId} />
        </Suspense>
      </div>
    </div>
  );
}

async function ProfileCard({
  userId,
  displayName,
  email,
}: {
  userId: string;
  displayName: string;
  email?: string | null;
}) {
  const subscription = await getActiveSubscription(userId);
  const isPremium = subscription?.planId === "PREMIUM";
  const userInitial = displayName[0] || "U";

  return (
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
              <p className="mt-1 text-sm font-bold text-slate-300">{email}</p>
            </div>
          </div>
          <div className={`rounded-2xl px-5 py-4 ${isPremium ? "bg-green-500/15 text-green-200" : "bg-white/10 text-slate-200"}`}>
            <div className="flex items-center gap-2 text-sm font-black">
              <Crown className="h-5 w-5" />
              {isPremium ? "Premium active" : "Free Starter"}
            </div>
            <p className="mt-1 text-xs font-bold opacity-80">
              {isPremium && subscription
                ? `Until ${subscription.expiresAt.toLocaleDateString()}`
                : "Upgrade when you are ready for full access."}
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
            <p className="truncate text-base font-black text-slate-900">{email}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

async function StatsGrid({ userId }: { userId: string }) {
  const totals = await getResultTotals(userId);
  // Headline metrics come from the aggregate, never from the truncated list.
  const totalAttempts = totals._count._all;
  const avgScore = totals._avg.score !== null ? Math.round(totals._avg.score) : 0;
  const bestScore = totals._max.score ?? 0;
  const formattedTime = formatResultTime(totals._sum.timeSpent ?? 0);

  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {[
        { label: "Average Score", value: avgScore, icon: Award, className: "bg-blue-50 text-blue-600" },
        { label: "Best Score", value: bestScore, icon: Target, className: "bg-emerald-50 text-emerald-600" },
        { label: "Tests Taken", value: totalAttempts, icon: BookOpen, className: "bg-indigo-50 text-indigo-600" },
        { label: "Total Practice", value: formattedTime, icon: TrendingUp, className: "bg-amber-50 text-amber-600" },
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
  );
}

async function SectionHistory({ userId }: { userId: string }) {
  const [userResults, totals, visibilityRows] = await Promise.all([
    prisma.result.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: HISTORY_LIMIT,
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
    }),
    getResultTotals(userId),
    getCollectionVisibilityRows(),
  ]);

  const collections = getTestCollections(visibilityRows);
  const sectionSummaries = buildSectionResultSummaries(userResults, collections);
  const totalAttempts = totals._count._all;
  const latestResult = userResults[0] || null;
  const isHistoryTruncated = totalAttempts > userResults.length;

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-600">Section results</p>
          <h2 className="mt-2 text-2xl font-black text-slate-900">Practice history by section</h2>
          {isHistoryTruncated && (
            <p className="mt-2 text-xs font-bold text-slate-400">
              Showing your latest {userResults.length} of {totalAttempts} attempts.
            </p>
          )}
        </div>
        {latestResult && (
          <Link href={`/dashboard/results/${latestResult.id}`} className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-700">
            Open Latest Result
          </Link>
        )}
      </div>

      {totalAttempts === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 p-8 text-center text-sm font-bold text-slate-400">
          No attempts yet. Start a module and this area will become your progress map.
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
                  <Link
                    key={result.id}
                    href={`/dashboard/results/${result.id}`}
                    className="rounded-3xl border border-slate-200 bg-white p-5 transition hover:border-blue-200 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-base font-black text-slate-900">{result.testTitle}</p>
                        <p className="mt-1 text-xs font-bold text-slate-400">
                          {new Date(result.createdAt).toLocaleDateString()} - {formatResultTime(result.timeSpent)}
                        </p>
                      </div>
                      <span className="rounded-2xl bg-slate-900 px-3 py-2 text-sm font-black text-white">
                        {result.score}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

async function SubscriptionBanner({ userId }: { userId: string }) {
  const subscription = await getActiveSubscription(userId);
  const isPremium = subscription?.planId === "PREMIUM";

  return (
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
              : "You are currently on the Free Starter plan. Upgrade when you want all modules and full review."}
          </p>
        </div>
        <Link href="/dashboard/subscription" className="rounded-2xl bg-blue-600 px-8 py-4 text-center text-sm font-black text-white transition hover:bg-blue-500">
          Manage Subscription
        </Link>
      </div>
    </section>
  );
}

/* Fallback geometry mirrors `PageLoadingSkeleton variant="profile"` block by block. */

function ProfileCardFallback() {
  return <div className="h-80 animate-pulse rounded-[2rem] border border-slate-200 bg-white" />;
}

function StatsGridFallback() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-40 animate-pulse rounded-3xl border border-slate-200 bg-white" />
      ))}
    </div>
  );
}

function SectionHistoryFallback() {
  return <div className="h-72 animate-pulse rounded-[2rem] border border-slate-200 bg-white xl:col-span-2" />;
}

function SubscriptionBannerFallback() {
  return <div className="h-44 animate-pulse rounded-[2rem] bg-slate-200 xl:col-span-2" />;
}
