'use client';

import React, { useCallback, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { CalendarClock, Flag, Play, RotateCw } from 'lucide-react';
import { useExamStore } from '@/store/useExamStore';
import type { CourseSummary, PracticeOverview } from '@/lib/courseProgress';
import { getCategoryQueryValue } from '@/lib/testCatalog';
import { Card, insetClass } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { buttonClass } from '@/components/ui/Button';
import { Progress, iconCircleClass } from '@/components/ui/Misc';
import { cn } from '@/components/ui/cn';

/**
 * The top of the Practice home: one card per course the student is in, with
 * how far they are, what to do next and how their scores move - or, for a
 * brand-new student, the free module to start with. The catalog stays below.
 */
export default function CourseOverview({ overview, userId }: { overview: PracticeOverview; userId: string }) {
  if (overview.courses.length === 0) {
    return overview.startHere ? <StartHere test={overview.startHere} /> : null;
  }

  return (
    <section aria-label="Your courses" className={cn('grid grid-cols-1 gap-4', overview.courses.length > 1 && '@4xl:grid-cols-2')}>
      {overview.courses.map((course) => (
        <CourseCard key={course.category} course={course} userId={userId} />
      ))}
    </section>
  );
}

function StartHere({ test }: { test: NonNullable<PracticeOverview['startHere']> }) {
  return (
    <Card className="flex flex-wrap items-center gap-4 p-5">
      <span className={iconCircleClass}>
        <Flag />
      </span>
      {/* basis-60: on a phone Start wraps under the text instead of squeezing
          it into a narrow column between the icon and the button. */}
      <div className="min-w-0 flex-1 basis-60">
        {/* "Free" only when it is: a subscriber can be shown a paid test here. */}
        <h2 className="text-base font-semibold text-gray-900">{test.isFree ? 'Start here: a free test' : 'Start here'}</h2>
        <p className="mt-0.5 text-sm text-gray-600">
          {test.title} · {test.facts}.{' '}
          {/* A check under 10 questions gives no score estimate, so it is not promised one. */}
          {test.hasScore
            ? 'You get a score estimate and a review of every answer.'
            : 'You get a review of every answer.'}
        </p>
      </div>
      <Link href={`/exam/${test.id}`} className={buttonClass()}>
        <Play className="h-4 w-4" />
        Start test
      </Link>
    </Card>
  );
}

function AccessBadge({ access }: { access: NonNullable<CourseSummary['access']> }) {
  if (access.daysLeft === null) {
    return (
      <Badge>
        <CalendarClock />
        Course access
      </Badge>
    );
  }
  // Amber only when it is about to run out: expiring is what amber is for.
  const ending = access.daysLeft <= 7;
  return (
    <Badge tone={ending ? 'warning' : 'neutral'}>
      <CalendarClock />
      {ending
        ? access.daysLeft === 0
          ? 'Access ends today'
          : `Access ends in ${access.daysLeft} ${access.daysLeft === 1 ? 'day' : 'days'}`
        : `Access until ${access.until}`}
    </Badge>
  );
}

function CourseCard({ course, userId }: { course: CourseSummary; userId: string }) {
  const percent = course.testsTotal > 0 ? Math.round((course.testsDone / course.testsTotal) * 100) : 0;

  return (
    // Its own container: two course cards sit side by side from @4xl, and
    // measured against the catalog the score column still opened in each,
    // leaving the progress and the Start button ~170px.
    <Card as="article" className="@container flex min-w-0 flex-col p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-gray-900">{course.label}</h2>
          {course.description && <p className="mt-0.5 line-clamp-2 text-sm text-gray-600">{course.description}</p>}
        </div>
        {course.access && <AccessBadge access={course.access} />}
      </div>

      {/* The score column only once there is a score: the owner wants no
          preview of one before it exists, so a new course card is progress
          and the next step across its full width. */}
      <div className={cn('mt-4 grid grid-cols-1 gap-5', course.line.length > 0 && '@2xl:grid-cols-[minmax(0,1fr)_13rem]')}>
        <div className="min-w-0 space-y-4">
          <div>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium text-gray-900 tabular-nums">
                {course.testsDone} of {course.testsTotal} {course.testsTotal === 1 ? 'test' : 'tests'} done
              </span>
              <span className="text-xs tabular-nums text-gray-500">{percent}%</span>
            </div>
            <Progress className="mt-2" value={percent} />
          </div>
          <NextStep course={course} userId={userId} />
        </div>
        {course.line.length > 0 && <ScoreLine line={course.line} best={course.best} />}
      </div>

      {course.lastResult && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-gray-100 pt-3 text-sm">
          <span className="min-w-0 text-gray-600">
            Last: <span className="font-medium text-gray-900">{course.lastResult.title}</span> · {course.lastResult.date}
            {course.lastResult.score !== null && (
              <>
                {' · '}
                <span className="font-medium tabular-nums text-gray-900">{course.lastResult.score}</span>
              </>
            )}
          </span>
          {/* Straight to the first mistake: the review opens filtered to them.
              Outlined, not a text link: it is the card's second action. An
              olympiad still on has no review yet - the result page says when
              it opens - so there the button opens the result. */}
          <Link
            href={
              course.lastResult.toReview > 0 && !course.lastResult.reviewClosed
                ? `/dashboard/results/${course.lastResult.id}?review=mistakes#review`
                : `/dashboard/results/${course.lastResult.id}`
            }
            className={buttonClass({ variant: 'secondary', size: 'sm' })}
          >
            {course.lastResult.reviewClosed
              ? 'Open the result'
              : course.lastResult.toReview > 0
                ? `Review ${course.lastResult.toReview} ${course.lastResult.toReview === 1 ? 'question' : 'questions'}`
                : 'Open the review'}
          </Link>
        </div>
      )}
    </Card>
  );
}

/**
 * Continue the unfinished attempt when there is one in this browser for this
 * course and this account; otherwise start the next untaken test. The saved
 * attempt only exists on the client, so the server render shows "Start" and
 * the swap happens once the store has read localStorage.
 *
 * Only a started attempt counts as unfinished. Opening a test creates one that
 * waits on module 1's start screen - no clock, no answers - and a student who
 * only looked at a test was told to "Continue" something they never began.
 */
function NextStep({ course, userId }: { course: CourseSummary; userId: string }) {
  const activeTestId = useExamStore((state) => state.activeTestId);
  const isSubmitted = useExamStore((state) => state.isSubmitted);
  const ownerId = useExamStore((state) => state.ownerId);
  const moduleIndex = useExamStore((state) => state.currentModuleIndex);
  const modulePhase = useExamStore((state) => state.modulePhase);
  // One block or several modules: "Module 1 of 2" only where there is a 2.
  const moduleCount = useExamStore((state) => state.moduleDurations.length);
  // A boolean, not the answers object: whether there is any answer is all the
  // card needs, and a primitive keeps the selector stable between renders.
  const hasAnswer = useExamStore((state) =>
    Object.values(state.answers).some((answer) => answer.trim() !== '')
  );
  const isHydrated = useSyncExternalStore(
    useCallback((onStoreChange) => useExamStore.persist.onFinishHydration(onStoreChange), []),
    () => useExamStore.persist.hasHydrated(),
    () => false
  );

  // A later module waiting on its start screen is still an attempt under way:
  // module 1 is behind it.
  const isStarted = modulePhase === 'active' || moduleIndex > 1 || hasAnswer;
  const unfinished =
    isHydrated && activeTestId && !isSubmitted && isStarted && (ownerId === null || ownerId === userId)
      ? course.tests.find((test) => test.id === activeTestId)
      : undefined;

  if (unfinished) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {/* max-w-full and a truncated title: a button never wraps, and a long
            test title pushed it past the card's edge on a phone. */}
        <Link href={`/exam/${unfinished.id}`} className={buttonClass({ className: 'max-w-full' })}>
          <RotateCw className="h-4 w-4 shrink-0" />
          <span className="truncate">Continue {unfinished.title}</span>
        </Link>
        <span className="text-xs tabular-nums text-gray-500">
          {moduleCount > 1 ? `Unfinished · Module ${moduleIndex} of ${moduleCount}` : 'Unfinished'}
        </span>
      </div>
    );
  }

  if (course.nextTest) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Link href={`/exam/${course.nextTest.id}`} className={buttonClass({ className: 'max-w-full' })}>
          <Play className="h-4 w-4 shrink-0" />
          <span className="truncate">Start {course.nextTest.title}</span>
        </Link>
        <span className="text-xs text-gray-500">{course.nextTest.facts}</span>
      </div>
    );
  }

  // Nothing to start from here: either everything is taken, or what is left
  // is an olympiad or a test that needs its code - both open from the course.
  const allDone = course.testsTotal > 0 && course.testsDone === course.testsTotal;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <Link href={`/dashboard?set=${encodeURIComponent(getCategoryQueryValue(course.category))}`} className={buttonClass({ variant: 'secondary' })}>
        Open the course
      </Link>
      <span className="text-xs text-gray-500">
        {course.testsTotal === 0
          ? 'Tests for this course are on their way.'
          : allDone
            ? 'Every test is done. Retake one to see your progress.'
            : 'Its tests open from the course page.'}
      </span>
    </div>
  );
}

/**
 * The latest score of each full-length test in the course, oldest first, on
 * the 200-800 scale with 800 as a dashed line - the slope to the goal. Only
 * drawn once there is a score (the card leaves it out before that).
 */
function ScoreLine({ line, best }: { line: number[]; best: number | null }) {
  const latest = line.at(-1);
  if (latest === undefined) return null;

  if (line.length < 2) {
    return (
      <div className={cn(insetClass, 'p-3 text-xs text-gray-600')}>
        <span className="block text-2xl font-semibold tabular-nums text-gray-900">
          {latest}
          <span className="text-sm font-medium text-gray-500"> / 800</span>
        </span>
        Your line starts after the second full test in this course.
      </div>
    );
  }

  const width = 200;
  const height = 56;
  const y = (score: number) => 4 + ((800 - Math.min(800, Math.max(200, score))) / 600) * (height - 8);
  const x = (index: number) => 4 + (index * (width - 8)) / (line.length - 1);
  const points = line.map((score, index) => `${x(index).toFixed(1)},${y(score).toFixed(1)}`).join(' ');

  return (
    <div className={cn(insetClass, 'p-3')}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-2xl font-semibold tabular-nums text-gray-900">
          {latest}
          <span className="text-sm font-medium text-gray-500"> / 800</span>
        </span>
        {best !== null && <span className="text-xs tabular-nums text-gray-500">best {best}</span>}
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mt-2 block h-14 w-full"
        role="img"
        aria-label={`Latest scores in this course: ${line.join(', ')}`}
      >
        <line x1="4" x2={width - 4} y1={y(800)} y2={y(800)} className="stroke-gray-300" strokeDasharray="3 4" />
        <polyline points={points} fill="none" className="stroke-ink-600" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(line.length - 1)} cy={y(latest)} r="3.5" className="fill-ink-600" />
      </svg>
    </div>
  );
}
