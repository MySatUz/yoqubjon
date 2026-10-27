import { EyeOff, KeyRound, Trophy } from 'lucide-react';
import { readModuleDurations, secondsToMinutes, type ModularTest } from '@/lib/examModules';
import { formatDuration, formatOlympiadMoment, readOlympiadWindow, type OlympiadTest } from '@/lib/olympiad';
import { Badge } from '@/components/ui/Badge';

/*
 * Facts about a test as the admin list, the editor and the stats page say
 * them. No 'use client' and no hooks: the list renders these in the browser,
 * the editor and stats pages on the server.
 */

/**
 * How long a test runs, said once: "2 modules × 35 min" for an SAT-style test,
 * "1 h 10 min" for a single timer. A row used to carry a duration pill and a
 * module pill that said the same thing twice.
 */
export function formatTestLength(test: ModularTest) {
  const durations = readModuleDurations(test);
  if (durations.length < 2) return formatDuration(durations[0]);

  const minutes = durations.map(secondsToMinutes);
  return minutes.every((value) => value === minutes[0])
    ? `${durations.length} modules × ${minutes[0]} min`
    : `${durations.length} modules, ${minutes.join(' + ')} min`;
}

/** "1 question", "44 questions". */
export function formatQuestionCount(count: number) {
  return `${count} ${count === 1 ? 'question' : 'questions'}`;
}

type BadgeTest = ModularTest & OlympiadTest & {
  visible: boolean;
  isFree: boolean;
  accessCode: string | null;
  maxAttempts: number;
};

/** Whether `TestBadges` would draw anything, so a caller can drop the row it sits in. */
export function hasTestBadges(test: BadgeTest, sectionMaxAttempts?: number) {
  return !test.visible
    || readOlympiadWindow(test) !== null
    || Boolean(test.accessCode)
    || (sectionMaxAttempts !== undefined && test.maxAttempts !== sectionMaxAttempts)
    || test.isFree;
}

/**
 * Pills for what sets a test apart from the rest of its course - and only
 * that. The norm (shown, paid, the course's attempt limit, the course the
 * page already names) gets no pill, and no pill is coloured: a blue "Free" and
 * a green "Shown" on every row read as alerts and hid the rows that were
 * actually different.
 */
export function TestBadges({
  test,
  sectionMaxAttempts,
  onCanvas = false,
}: {
  test: BadgeTest;
  sectionMaxAttempts?: number;
  /** In a page header on the gray-100 canvas, where a neutral pill would vanish. */
  onCanvas?: boolean;
}) {
  const olympiadWindow = readOlympiadWindow(test);
  const hasOwnAttemptLimit = sectionMaxAttempts !== undefined && test.maxAttempts !== sectionMaxAttempts;

  return (
    <>
      {!test.visible && (
        <Badge onCanvas={onCanvas} title="Students do not see this test in Practice">
          <EyeOff />
          Hidden
        </Badge>
      )}
      {olympiadWindow && (
        <Badge
          onCanvas={onCanvas}
          title={`${formatOlympiadMoment(olympiadWindow.startsAt)} to ${formatOlympiadMoment(olympiadWindow.endsAt)}, Tashkent time`}
        >
          <Trophy />
          Olympiad
        </Badge>
      )}
      {test.accessCode && (
        <Badge onCanvas={onCanvas} title="Students enter this code before the test opens">
          <KeyRound />
          Test code <span className="tabular-nums">{test.accessCode}</span>
        </Badge>
      )}
      {hasOwnAttemptLimit && (
        <Badge onCanvas={onCanvas} title={`The course allows ${sectionMaxAttempts}`}>
          <span className="tabular-nums">{test.maxAttempts}</span>
          {test.maxAttempts === 1 ? 'attempt' : 'attempts'}
        </Badge>
      )}
      {test.isFree && <Badge onCanvas={onCanvas} title="Open without a subscription">Free</Badge>}
    </>
  );
}
