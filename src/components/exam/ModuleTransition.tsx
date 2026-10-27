"use client";

import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { ArrowRight, Calculator, Check, Clock3, HardDrive, ListChecks, Lock, Trophy } from 'lucide-react';
import { formatDuration, formatOlympiadMoment, OLYMPIAD_TIME_ZONE } from '@/lib/olympiad';
import { Badge } from '@/components/ui/Badge';
import { buttonClass } from '@/components/ui/Button';
import { cardClass } from '@/components/ui/Card';
import { Alert, Skeleton } from '@/components/ui/Feedback';
import { cn } from '@/components/ui/cn';

interface ModuleTransitionProps {
  title: string;
  moduleIndex: number;
  moduleCount: number;
  durationSeconds: number;
  /** This module and every one after it: the time a full attempt still needs from here. */
  secondsToFinish: number;
  questionCount: number;
  /** An olympiad's closing time, in ms: the attempt has to be in by then. Null for an ordinary test. */
  olympiadEndsAtMs?: number | null;
  onStart: () => void;
}

type Rule = { icon: React.ReactNode; text: React.ReactNode };

const ruleIconClass = 'mt-0.5 h-4 w-4 shrink-0 text-gray-500';

/*
 * A coarse clock for the olympiad's closing time. The exam page lets a
 * student in only while a full attempt can still finish before the window
 * closes, but this screen waits for Start, and nothing stops them sitting on
 * it past that point. The snapshot is rounded to the step, so it is the same
 * number between ticks, as `useSyncExternalStore` needs.
 */
const CLOCK_STEP_MS = 15_000;
function subscribeToClock(onChange: () => void) {
  const interval = setInterval(onChange, CLOCK_STEP_MS);
  return () => clearInterval(interval);
}
const subscribeToNothing = () => () => {};
const readClock = () => Math.floor(Date.now() / CLOCK_STEP_MS) * CLOCK_STEP_MS;
const readServerClock = () => null;

/** `18:00`, in the zone every olympiad time is shown in. */
const closingTimeFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: OLYMPIAD_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** Whole minutes: the seconds would change while the student reads them. */
function formatMinutesLeft(seconds: number) {
  return seconds < 60 ? 'less than a minute' : formatDuration(Math.floor(seconds / 60) * 60);
}

/**
 * The start screen of every module. Module 1's clock no longer starts the
 * moment the test opens: the student sees what is ahead and starts it
 * themselves, and every later module waits here the same way, so time left
 * over from one module is never carried into the next.
 */
export default function ModuleTransition({
  title,
  moduleIndex,
  moduleCount,
  durationSeconds,
  secondsToFinish,
  questionCount,
  olympiadEndsAtMs = null,
  onStart,
}: ModuleTransitionProps) {
  const isFirst = moduleIndex <= 1;
  const isModular = moduleCount > 1;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const isOlympiad = olympiadEndsAtMs !== null;
  const now = useSyncExternalStore<number | null>(
    isOlympiad ? subscribeToClock : subscribeToNothing,
    readClock,
    readServerClock
  );
  const closesInSeconds = isOlympiad && now !== null ? Math.floor((olympiadEndsAtMs - now) / 1000) : null;
  // Less time before the window closes than the rest of the attempt takes:
  // said on this screen, before Start, rather than learned from the ranking.
  const isShortOfTime = closesInSeconds !== null && closesInSeconds < secondsToFinish;

  // Between modules this screen replaces the one the student finished on, and
  // focus would be left on nothing; it starts here, as a screen reader should.
  // Module 1 is the page itself, read from the top as usual.
  useEffect(() => {
    if (!isFirst) headingRef.current?.focus();
  }, [isFirst]);

  // Two or three lines, each one something that changes what the student
  // does - not a page of instructions read once and skipped after.
  const rules: Rule[] = isFirst
    ? [
      {
        icon: <Clock3 className={ruleIconClass} />,
        text: 'The clock starts when you press Start and keeps running if you leave the page.',
      },
      {
        icon: <Calculator className={ruleIconClass} />,
        text: 'The graphing calculator and the reference sheet are in the top bar.',
      },
      {
        icon: <HardDrive className={ruleIconClass} />,
        text: 'Your answers are saved in this browser as you go. Nothing is sent until you finish.',
      },
    ]
    : [
      {
        icon: <Lock className={ruleIconClass} />,
        text: `Module ${moduleIndex - 1} is closed: you cannot go back to its questions.`,
      },
      {
        icon: <Clock3 className={ruleIconClass} />,
        text: 'This module has its own clock. Time left over from the last one is not added.',
      },
    ];

  if (isOlympiad && !isShortOfTime) {
    rules.push({
      icon: <Trophy className={ruleIconClass} />,
      text: (
        <>
          The attempt counts if it is finished before{' '}
          <span className="font-medium text-gray-900">{formatOlympiadMoment(new Date(olympiadEndsAtMs))}</span>.
        </>
      ),
    });
  }

  // Amber, the system's colour for "expiring": nothing has gone wrong yet,
  // and the student can still choose to start.
  let shortOfTime: React.ReactNode = null;
  if (isOlympiad && isShortOfTime && closesInSeconds !== null) {
    const closingTime = closingTimeFormat.format(olympiadEndsAtMs);
    const span = secondsToFinish > durationSeconds ? (isFirst ? ' for the whole test' : ' for the rest of the test') : '';
    shortOfTime = closesInSeconds <= 0 ? (
      <Alert tone="warning" title={`The olympiad closed at ${closingTime}`} className="mt-5">
        An attempt finished now does not count in the ranking.
      </Alert>
    ) : (
      <Alert tone="warning" title={`The olympiad closes at ${closingTime}`} className="mt-5">
        <span className="tabular-nums">
          You will have {formatMinutesLeft(closesInSeconds)}{span}, not {formatDuration(secondsToFinish)}: only an
          attempt finished by {closingTime} counts in the ranking.
        </span>
      </Alert>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-8 sm:py-16">
      <div className={cn(cardClass, 'mx-auto w-full max-w-md p-5')}>
        {/* Neutral, not green: green means a correct answer. */}
        {!isFirst && (
          <Badge className="mb-3">
            <Check />
            Module {moduleIndex - 1} complete
          </Badge>
        )}

        <h2
          ref={headingRef}
          tabIndex={-1}
          className="text-xl font-semibold tracking-tight break-words text-gray-900 focus:outline-hidden"
        >
          {isModular ? `Module ${moduleIndex} of ${moduleCount}` : title}
        </h2>
        {isModular && isFirst && <p className="mt-1 text-sm break-words text-gray-500">{title}</p>}

        <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-700 tabular-nums">
          <span className="inline-flex items-center gap-1.5">
            <ListChecks className="h-4 w-4 text-gray-500" />
            {questionCount} {questionCount === 1 ? 'question' : 'questions'}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock3 className="h-4 w-4 text-gray-500" />
            {formatDuration(durationSeconds)}
          </span>
        </p>

        <ul className="mt-5 space-y-3 border-t border-gray-100 pt-5">
          {rules.map((rule, index) => (
            <li key={index} className="flex gap-3 text-sm text-gray-700">
              {rule.icon}
              <span>{rule.text}</span>
            </li>
          ))}
        </ul>

        {shortOfTime}

        <button
          type="button"
          onClick={onStart}
          className={buttonClass({ size: 'lg', block: true, className: 'mt-6' })}
        >
          {isModular ? `Start module ${moduleIndex}` : 'Start test'}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * The start screen's shape while the attempt is read from this browser - and
 * the exam route's loading screen - so a new attempt opens without a jump.
 */
export function ModuleTransitionSkeleton() {
  return (
    <div aria-hidden className="flex-1 overflow-hidden px-4 py-8 sm:py-16">
      <div className={cn(cardClass, 'mx-auto w-full max-w-md p-5')}>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-2 h-4 w-28" />
        <Skeleton className="mt-4 h-4 w-44" />
        <div className="mt-5 space-y-3 border-t border-gray-100 pt-5">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-10/12" />
        </div>
        <Skeleton className="mt-6 h-10 w-full" />
      </div>
    </div>
  );
}
