import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { requireAdminPage } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { buildSectionTestSummaries } from "@/lib/resultSections";
import { getCategoryLabel, getTestCollections } from "@/lib/testCatalog";
import { getCollectionVisibilityRows } from "@/lib/testCollections";
import { linkRowClass, rowLinkClass } from "@/components/admin/adminControls";
import { courseHref } from "@/components/admin/courses/courseLinks";
import { formatDateKey, utcDateKey } from "@/components/admin/courses/accessPlan";
import { isGrantActive, readToday } from "@/app/admin/courses/courseData";
import { formatDuration } from "@/lib/olympiad";
import { formatDate } from "@/lib/formatDate";
import { formatCorrectOf, hasScoreEstimate } from "@/lib/scoreDisplay";
import { normalizeAccessEmail } from "@/lib/sectionAccess";
import { linkClass } from "@/components/ui/Button";
import { ChevronRight, ClipboardList } from "lucide-react";
import { notFound } from "next/navigation";
import { BackLink, Page, PageHeader, SectionHeading } from "@/components/ui/Page";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Misc";
import { Stat, StatGroup } from "@/components/ui/Stat";
import { EmptyState } from "@/components/ui/Feedback";
import { listRowClass, rowChevronClass, tableClass, tdClass, thClass } from "@/components/ui/List";
import { cn } from "@/components/ui/cn";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Attempts read to build the per-test table. Rows are folded into one line per
 * test, so the page no longer grows with every attempt, but an account that
 * somehow piled up thousands still should not pull them all in one request.
 * The tiles come from an aggregate over the full history either way.
 */
const RESULT_READ_LIMIT = 2000;

// The tables run edge to edge in their card; the outer columns line up with
// the card header's px-5 instead of the table's default px-4.
const sectionThClass = cn(thClass, "first:pl-5 last:pr-5");
const sectionTdClass = cn(tdClass, "first:pl-5 last:pr-5");
const numericThClass = cn(sectionThClass, "text-right");
const numericTdClass = cn(sectionTdClass, "text-right tabular-nums");

/**
 * A score, or under 10 questions the questions solved ("7 of 9"): there a
 * score is noise. A dash when an old attempt stored no count.
 */
function formatOutcome(score: number, correct: number | null, questionCount: number | null) {
  if (questionCount === null || hasScoreEstimate(questionCount)) return score;
  return correct === null ? "—" : formatCorrectOf(correct, questionCount);
}

/** One read per request, shared by the tab title and the page. */
const readUser = cache((userId: string) => prisma.user.findUnique({
  where: { id: userId },
  select: {
    id: true,
    email: true,
    name: true,
    role: true,
    createdAt: true,
  },
}));

export async function generateMetadata({
  params,
}: {
  params: Promise<{ userId: string }>;
}): Promise<Metadata> {
  const { userId } = await params;
  // Same gate as the page: a user's name is not for anyone else's tab.
  await requireAdminPage();
  const user = await readUser(userId);

  return { title: user ? user.name || user.email : "User" };
}

export default async function AdminUserResultsPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  // Kept here on purpose: access must not depend on the segment layout.
  await requireAdminPage();

  const [user, results, visibilityRows, totals] = await Promise.all([
    readUser(userId),
    prisma.result.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: RESULT_READ_LIMIT,
      select: {
        id: true,
        testId: true,
        score: true,
        correctCount: true,
        timeSpent: true,
        createdAt: true,
        test: {
          select: {
            id: true,
            title: true,
            description: true,
            collectionCategory: true,
            createdAt: true,
            // Under 10 shown questions a score is noise; a copy shows its original's.
            _count: { select: { questions: true } },
            questionSource: { select: { _count: { select: { questions: true } } } },
          },
        },
      },
    }),
    getCollectionVisibilityRows(),
    prisma.result.aggregate({
      where: { userId },
      _count: { _all: true },
      _sum: { timeSpent: true },
      _max: { createdAt: true },
    }),
  ]);

  if (!user) {
    notFound();
  }

  const collections = getTestCollections(visibilityRows);
  // Access is given by email, often before sign-up, so the entry may carry no user id yet.
  const grants = await prisma.sectionAccess.findMany({
    where: { OR: [{ userId }, { email: normalizeAccessEmail(user.email) }] },
    select: { id: true, category: true, expiresAt: true, note: true },
  });
  const { now, todayKey } = readToday();
  const courseAccess = grants
    .map((grant) => ({
      ...grant,
      label: getCategoryLabel(grant.category, collections),
      endKey: grant.expiresAt ? utcDateKey(grant.expiresAt) : null,
      active: isGrantActive(grant, now),
    }))
    .sort((a, b) => Number(b.active) - Number(a.active) || a.label.localeCompare(b.label));

  const sections = buildSectionTestSummaries(
    results.map((result) => ({
      ...result,
      test: { ...result.test, questionCount: result.test.questionSource?._count.questions ?? result.test._count.questions },
    })),
    collections,
  );
  // Computed over the full history in the database, not over the capped read.
  const totalAttempts = totals._count._all;
  const totalTimeSpent = totals._sum.timeSpent ?? 0;
  const lastActiveAt = totals._max.createdAt;
  const testCount = sections.reduce((total, section) => total + section.tests.length, 0);
  const isTruncated = totalAttempts > results.length;
  const displayName = user.name || user.email;

  return (
    <Page>
      <PageHeader
        back={<BackLink href="/admin/users">Back to users</BackLink>}
        title={
          <span className="flex min-w-0 items-center gap-3">
            {/* Hidden from screen readers by Avatar itself: the initial would
                otherwise be read out before the name. */}
            <Avatar name={displayName} />
            <span className="truncate">{displayName}</span>
          </span>
        }
        // A user without a name is titled by their email; do not print it twice.
        description={user.name ? user.email : undefined}
        meta={
          <>
            <Badge tone={user.role === "ADMIN" ? "accent" : "neutral"} onCanvas>
              {user.role === "ADMIN" ? "Admin" : "User"}
            </Badge>
            {/* On the mist-100 canvas, where mist-500 misses AA. */}
            <span className="text-xs text-mist-600">Joined {formatDate(user.createdAt)}</span>
          </>
        }
      />

      {/* No sum of scores: adding up SAT-scale scores of different tests gave
          a number that measured nothing. These are counts and dates. */}
      <StatGroup>
        <Stat label="Attempts" value={totalAttempts} />
        <Stat label="Tests taken" value={testCount} hint={isTruncated ? `From the latest ${results.length} attempts` : undefined} />
        <Stat label="Time practising" value={totalAttempts > 0 ? formatDuration(totalTimeSpent) : "None"} />
        <Stat label="Last active" value={lastActiveAt ? formatDate(lastActiveAt) : "Never"} />
      </StatGroup>

      {courseAccess.length > 0 && (
        <Card as="section" className="overflow-hidden">
          <CardHeader title="Course access" />
          <ul className="divide-y divide-mist-100">
            {courseAccess.map((grant) => (
              <li key={grant.id} className={listRowClass}>
                <div className="min-w-0 flex-1">
                  <Link href={courseHref(grant.category)} prefetch={false} className={cn(linkClass, "block truncate")}>
                    {grant.label}
                  </Link>
                  {grant.note && <p className="mt-0.5 truncate text-xs text-mist-500">{grant.note}</p>}
                </div>
                {/* The end is the UTC date the admin chose (see accessPlan.ts). */}
                <span className={cn("shrink-0 text-sm tabular-nums", grant.active ? "text-mist-700" : "text-mist-500")}>
                  {grant.endKey === null
                    ? "No end date"
                    : grant.active
                      ? `Until ${formatDateKey(grant.endKey, todayKey)}`
                      : `Ended ${formatDateKey(grant.endKey, todayKey)}`}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <section className="space-y-4">
        <SectionHeading
          title="Results by test"
          description={
            isTruncated
              ? // The tiles above cover every attempt; the tables are built
                // from the capped read, so say so instead of showing numbers
                // that silently disagree with the tiles.
                `Built from the latest ${results.length} of ${totalAttempts} attempts.`
              : "Best and latest score of each test, most recent first. Under 10 questions, the questions solved."
          }
        />

        {sections.length === 0 ? (
          <EmptyState icon={<ClipboardList />} title="This user has not completed any tests yet" />
        ) : (
          sections.map((section) => (
            <Card as="section" key={section.categoryKey} className="overflow-hidden">
              <CardHeader
                title={collections.some((course) => course.value === section.categoryKey) ? (
                  <Link href={courseHref(section.categoryKey, "results")} prefetch={false} className={linkClass}>
                    {section.label}
                  </Link>
                ) : section.label}
                description={`${section.tests.length} ${section.tests.length === 1 ? "test" : "tests"} · ${section.attempts} ${section.attempts === 1 ? "attempt" : "attempts"}`}
              />
              <div className="overflow-x-auto">
                <table className={tableClass}>
                  <thead>
                    <tr>
                      <th scope="col" className={sectionThClass}>Test</th>
                      <th scope="col" className={numericThClass}>Attempts</th>
                      <th scope="col" className={numericThClass}>Best</th>
                      <th scope="col" className={numericThClass}>Latest</th>
                      <th scope="col" className={cn(numericThClass, "hidden sm:table-cell")}>Time spent</th>
                      <th scope="col" className={numericThClass}>Last attempt</th>
                      <th scope="col" className={cn(sectionThClass, "w-10")}><span className="sr-only">Open</span></th>
                    </tr>
                  </thead>
                  <tbody className="[&>tr:last-child>td]:border-b-0">
                    {section.tests.map((test) => (
                      // The whole row opens the test's stats (see `linkRowClass`); the chevron says so.
                      <tr key={test.testId} className={cn(linkRowClass, "group")}>
                        <td className={sectionTdClass}>
                          {/* The test's stats show this student among everyone who sat it. */}
                          <Link
                            href={`/admin/tests/${test.testId}/stats`}
                            prefetch={false}
                            className={cn(rowLinkClass, "block max-w-80 truncate")}
                          >
                            {test.testTitle}
                          </Link>
                        </td>
                        <td className={numericTdClass}>{test.attempts}</td>
                        <td className={cn(numericTdClass, "font-semibold text-mist-900")}>
                          {formatOutcome(test.bestScore, test.bestCorrect, test.questionCount)}
                        </td>
                        {/* Only a single attempt makes latest and best the same sitting. */}
                        <td className={cn(numericTdClass, test.attempts === 1 && "text-mist-500")}>
                          {formatOutcome(test.latestScore, test.latestCorrect, test.questionCount)}
                        </td>
                        <td className={cn(numericTdClass, "hidden whitespace-nowrap sm:table-cell")}>
                          {formatDuration(test.totalTimeSpent)}
                        </td>
                        <td className={cn(numericTdClass, "whitespace-nowrap")}>{formatDate(test.latestAt)}</td>
                        <td className={cn(sectionTdClass, "w-10")}>
                          <ChevronRight aria-hidden className={rowChevronClass} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ))
        )}
      </section>
    </Page>
  );
}
