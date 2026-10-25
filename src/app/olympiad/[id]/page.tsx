import { cache } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Trophy, Users } from 'lucide-react';
import { auth } from '@/auth';
import {
  canStartOlympiadAttempt,
  formatDuration,
  getLatestStart,
  getOlympiadStatus,
  type OlympiadStatus,
} from '@/lib/olympiad';
import { getOlympiadResults, getOlympiadTest } from '@/lib/olympiadQueries';
import { formatModuleBadge } from '@/lib/examModules';
import { formatCreditTotal } from '@/lib/resultAnswers';
import { hasScoreEstimate } from '@/lib/scoreDisplay';
import { formatDateTime } from '@/lib/formatDate';
import { getCategoryQueryValue, getTestCategory } from '@/lib/testCatalog';
import { getCachedTestCollections } from '@/lib/testCollections';
import { getActiveSectionAccessCategories } from '@/lib/sectionAccess';
import { getViewerAccess } from '@/lib/studentView';
import { prisma } from '@/lib/prisma';
import { PREMIUM_PLAN } from '@/lib/plans';
import { readSalesOpen } from '@/app/dashboard/salesOpen';
import { BackLink, Page, PageHeader, SectionHeading } from '@/components/ui/Page';
import { Badge, type Tone } from '@/components/ui/Badge';
import { buttonClass } from '@/components/ui/Button';
import { Card, cardClass } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/Feedback';
import { KeyValue } from '@/components/ui/Misc';
import { tableClass, tableWrapClass, tdClass, thClass } from '@/components/ui/List';
import { cn } from '@/components/ui/cn';
import { loginUrl } from '@/lib/safeRedirect';

const STATUS_BADGE: Record<OlympiadStatus, { label: string; tone: Tone }> = {
  // Amber is the pending colour in this design system, which is exactly what an
  // olympiad that has not opened yet is.
  upcoming: { label: 'Upcoming', tone: 'warning' },
  running: { label: 'Live now', tone: 'accent' },
  finished: { label: 'Finished', tone: 'neutral' },
};

const numericThClass = cn(thClass, 'text-right');
const numericTdClass = cn(tdClass, 'text-right tabular-nums');

/** One read per request: the tab title and the page both need the test. */
const readOlympiad = cache(getOlympiadTest);

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  // A guest is sent to sign in (src/proxy.ts, then the page); no database read for them.
  const session = await auth();
  if (!session?.user?.id) return {};

  const olympiad = await readOlympiad(id);
  // A hidden test's title stays out of the tab, as on the exam page: the page
  // itself is a 404 for everyone but an admin.
  if (!olympiad) return {};
  return { title: olympiad.test.visible ? olympiad.test.title : 'Olympiad' };
}

/**
 * Where "Back" goes: the Practice collection this olympiad is listed in, as
 * the catalogue links it (`?set=`), or Practice itself for a test outside any
 * collection. getOlympiadTest already reads the fields this needs.
 */
function backHrefOf(test: { title: string; description: string | null; collectionCategory: string | null }) {
  const category = getTestCategory(test);
  return category ? `/dashboard?set=${encodeURIComponent(getCategoryQueryValue(category))}` : null;
}

export default async function OlympiadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    // Olympiad links go out in Telegram; come back here after signing in.
    // src/proxy.ts does this first; this is the second line behind it.
    redirect(loginUrl(`/olympiad/${id}`));
  }

  const myUserId = session.user.id;
  const [olympiad, viewer] = await Promise.all([readOlympiad(id), getViewerAccess(myUserId)]);

  // Not an olympiad at all, or a test that no longer exists: there is nothing
  // here to show, and inventing an empty page would only confuse.
  if (!olympiad) {
    notFound();
  }

  const { test, window, totalDurationSeconds } = olympiad;
  // An admin in student view is not an admin here, as on the exam page.
  const isAdmin = viewer.isAdmin;

  // A hidden test is a 404 on the exam page for everyone but an admin, so it
  // is one here too - its Start button only led there, and its ranking named
  // the participants of a test that is not shown.
  if (!test.visible && !isAdmin) {
    notFound();
  }

  const collectionHref = backHrefOf(test);
  const status = getOlympiadStatus(window);
  const badge = STATUS_BADGE[status];
  const latestStart = getLatestStart(window, totalDurationSeconds);
  const category = getTestCategory(test);

  // The rest of the exam page's gates, read beside the ranking: Start is only
  // offered where the exam would open, not where it would send the student to
  // the subscription page or back to Practice with "attempt limit reached".
  const [results, subscription, accessCategories, attemptsUsed, collections, salesOpen] = await Promise.all([
    status === 'finished' ? getOlympiadResults(test.id, window) : null,
    test.isFree || isAdmin
      ? null
      : prisma.subscription.findFirst({
          where: { userId: myUserId, isActive: true, expiresAt: { gt: new Date() } },
          select: { id: true },
        }),
    getActiveSectionAccessCategories(myUserId, session.user.email),
    prisma.result.count({ where: { userId: myUserId, testId: test.id } }),
    getCachedTestCollections(),
    readSalesOpen('Olympiad'),
  ]);

  const canAccess =
    isAdmin ||
    test.isFree ||
    Boolean(subscription) ||
    viewer.simulatesSubscription ||
    Boolean(category && accessCategories.includes(category));
  const attemptsLeft = isAdmin ? null : Math.max(0, test.maxAttempts - attemptsUsed);
  const entryOpen = canStartOlympiadAttempt(window, totalDurationSeconds);
  // A hidden course only leaves the lists: its tests open to anyone the exam
  // page lets in. Its ranking, a private group's names, is shown to the same
  // people and to those who took part, and no one else.
  const courseHidden = Boolean(
    category && collections.some((collection) => collection.value === category && !collection.visible)
  );
  const showRanking = canAccess || attemptsUsed > 0 || !courseHidden;
  // Below MIN_QUESTIONS_FOR_SCORE an estimate is noise (scoreDisplay.ts), and
  // Results and the result page show none: a short olympiad ranks by solved
  // and time only, so there is no Score column to read as a real score.
  const showScore = results !== null && hasScoreEstimate(results.totalQuestions);

  // Dates in the app's one format (formatDate.ts): "20 Oct 2026, 09:00",
  // Tashkent time, the same as on results and payments.
  const opensAt = formatDateTime(window.startsAt);
  const closesAt = formatDateTime(window.endsAt);
  const startBy = formatDateTime(latestStart);
  // "2 modules × 35 min" for a two-module test, the one timer's length for a
  // test in one block.
  const timeLimit = formatModuleBadge(test) ?? formatDuration(totalDurationSeconds);

  // Inside the student shell (olympiad/layout.tsx): <Page> sets the width and
  // rhythm; the canvas behind it is the shell's.
  return (
    <Page>
      <PageHeader
        back={
          <BackLink href={collectionHref ?? '/dashboard'}>
            {collectionHref ? 'Back to course' : 'Back to Practice'}
          </BackLink>
        }
        title={test.title}
        meta={
          // onCanvas: the neutral "Finished" pill is mist-100, the canvas
          // colour itself, and disappeared on it.
          <Badge tone={badge.tone} onCanvas>
            <Trophy />
            {badge.label}
          </Badge>
        }
      />

      {/* One column on phones (KeyValue truncates), three from sm. The zone
          is said once, under the window it applies to. */}
      <div className={cardClass}>
        <dl className="grid grid-cols-1 gap-3 px-5 py-4 sm:grid-cols-3 sm:gap-4">
          <KeyValue label="Opens" value={<span className="tabular-nums">{opensAt}</span>} />
          <KeyValue label="Closes" value={<span className="tabular-nums">{closesAt}</span>} />
          <KeyValue label="Time limit" value={<span className="tabular-nums">{timeLimit}</span>} />
        </dl>
        <p className="border-t border-mist-100 px-5 py-2.5 text-xs text-mist-500">Times are Tashkent time.</p>
      </div>

      {status === 'upcoming' && (
        <Card as="section" padded>
          <h2 className="text-base font-semibold text-mist-900">This olympiad has not started yet</h2>
          <p className="mt-1 text-sm text-mist-600">
            It opens on {opensAt}. Start by {startBy} to finish before it closes. The ranking appears here once
            the olympiad is over.
          </p>
        </Card>
      )}

      {status === 'running' && (
        <Card as="section" padded>
          {entryOpen && !canAccess ? (
            <>
              <h2 className="text-base font-semibold text-mist-900">The olympiad is live</h2>
              <p className="mt-1 text-sm text-mist-600">
                It is open to students with {PREMIUM_PLAN.name} or with access to its course. The ranking appears
                here once the olympiad is over.
              </p>
              {/* As on the catalog's locked card: never a link to a page
                  with nothing to buy while an admin has paused sales. */}
              {salesOpen ? (
                <Link href="/dashboard/subscription" className={buttonClass({ variant: 'secondary', className: 'mt-4' })}>
                  Unlock with {PREMIUM_PLAN.name}
                </Link>
              ) : (
                <p className="mt-2 text-sm text-mist-600">{PREMIUM_PLAN.name} is paused for now.</p>
              )}
            </>
          ) : entryOpen && attemptsLeft === 0 ? (
            <>
              <h2 className="text-base font-semibold text-mist-900">You have used every attempt</h2>
              <p className="mt-1 text-sm text-mist-600">
                Your best attempt counts. The ranking appears here once the olympiad closes at {closesAt}.
              </p>
            </>
          ) : entryOpen ? (
            <>
              <h2 className="text-base font-semibold text-mist-900">The olympiad is live</h2>
              <p className="mt-1 text-sm text-mist-600">
                The clock starts when you press Start test. Start by {startBy}: an attempt counts only if it is
                sent before {closesAt}. Your best attempt counts.
              </p>
              <Link href={`/exam/${test.id}`} className={buttonClass({ className: 'mt-4' })}>
                Start test
              </Link>
            </>
          ) : (
            <>
              <h2 className="text-base font-semibold text-mist-900">Entry is closed</h2>
              <p className="mt-1 text-sm text-mist-600">
                A new attempt needs {formatDuration(totalDurationSeconds)}, and less than that is left before it
                closes at {closesAt}. The last moment to start was {startBy}. The ranking appears here once the
                olympiad is over.
              </p>
            </>
          )}
        </Card>
      )}

      {status === 'finished' && !showRanking && (
        <Card as="section" padded>
          <h2 className="text-base font-semibold text-mist-900">This olympiad is over</h2>
          <p className="mt-1 text-sm text-mist-600">Its ranking is shown to the students of its course.</p>
        </Card>
      )}

      {status === 'finished' && showRanking && results && (
        <section className="space-y-3">
          <SectionHeading
            title="Ranking"
            description={
              showScore
                ? 'The best attempt counts: most questions solved first, then the shorter time. Score is the estimated SAT Math score for that attempt.'
                : 'The best attempt counts: most questions solved first, then the shorter time.'
            }
            actions={
              // None with nobody in it: the empty state below says so, and
              // "0 participants" beside it was the same news twice.
              results.participants > 0 && (
                <span className="inline-flex items-center gap-1.5 text-sm text-mist-600">
                  <Users className="h-4 w-4" />
                  <span className="tabular-nums">{results.participants}</span>
                  {results.participants === 1 ? ' participant' : ' participants'}
                </span>
              )
            }
          />

          {results.standings.length === 0 ? (
            <EmptyState icon={<Users />} title="Nobody took part in this olympiad" />
          ) : (
            <div className={tableWrapClass}>
              <table className={cn(tableClass, 'min-w-[560px]')}>
                <thead>
                  <tr>
                    <th scope="col" className={cn(thClass, 'w-16')}>Rank</th>
                    <th scope="col" className={thClass}>Participant</th>
                    <th scope="col" className={numericThClass}>Solved</th>
                    <th scope="col" className={numericThClass}>Time</th>
                    {showScore && <th scope="col" className={numericThClass}>Score</th>}
                  </tr>
                </thead>
                <tbody className="[&>tr:last-child>td]:border-b-0">
                  {results.standings.map((standing) => {
                    const isMe = standing.userId === myUserId;

                    return (
                      <tr key={standing.userId} className={isMe ? 'bg-board-50' : undefined}>
                        <td className={cn(tdClass, 'tabular-nums')}>
                          {/* First place is marked, not coloured: lime means
                              "correct" in this app and amber "pending". */}
                          {standing.rank === 1 ? (
                            <span className="inline-flex items-center gap-1.5 font-semibold text-mist-900">
                              {standing.rank}
                              <Trophy className="h-3.5 w-3.5 text-mist-500" />
                            </span>
                          ) : (
                            <span className="text-mist-500">{standing.rank}</span>
                          )}
                        </td>
                        {/* wrap-anywhere: names are typed by students (up to 60
                            characters), and one unbroken name would otherwise
                            widen the whole table. */}
                        <td className={cn(tdClass, 'wrap-anywhere')}>
                          <span className="font-medium text-mist-900">
                            {standing.name ?? 'Participant'}
                          </span>
                          {isMe && <span className="ml-2 text-xs font-medium text-board-700">You</span>}
                          {standing.attempts > 1 && (
                            <span className="ml-2 text-xs text-mist-500">
                              <span className="tabular-nums">{standing.attempts}</span> attempts
                            </span>
                          )}
                        </td>
                        <td className={cn(numericTdClass, 'whitespace-nowrap')}>
                          <span className="font-semibold text-mist-900">
                            {formatCreditTotal(standing.correctCount)}
                          </span>
                          {/* mist-500, not 400: the total is part of the figure. */}
                          <span className="text-mist-500"> / {results.totalQuestions}</span>
                        </td>
                        <td className={cn(numericTdClass, 'whitespace-nowrap')}>
                          {formatDuration(standing.timeSpent)}
                        </td>
                        {showScore && <td className={numericTdClass}>{standing.score}</td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </Page>
  );
}
