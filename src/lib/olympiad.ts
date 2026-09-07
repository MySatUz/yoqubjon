// Deliberately free of Prisma: the admin form and other client components
// import the formatting and window helpers from here, and pulling the database
// client into a client bundle breaks the build. Anything that queries lives in
// `olympiadQueries.ts`.

/** A test carrying the two window columns, however it was selected. */
export interface OlympiadTest {
  olympiadStartsAt: Date | null;
  olympiadEndsAt: Date | null;
}

export interface OlympiadWindow {
  startsAt: Date;
  endsAt: Date;
}

export type OlympiadStatus = 'upcoming' | 'running' | 'finished';

/**
 * The window, or null for an ordinary test. Both columns must be set: a half
 * configured window would otherwise silently lock a test with no way to open it.
 */
export function readOlympiadWindow(test: OlympiadTest): OlympiadWindow | null {
  const { olympiadStartsAt: startsAt, olympiadEndsAt: endsAt } = test;
  if (!startsAt || !endsAt) return null;
  if (endsAt <= startsAt) return null;

  return { startsAt, endsAt };
}

export function getOlympiadStatus(window: OlympiadWindow, now = new Date()): OlympiadStatus {
  if (now < window.startsAt) return 'upcoming';
  if (now >= window.endsAt) return 'finished';
  return 'running';
}

/**
 * Whether a new attempt may be started right now.
 *
 * An attempt counts only if it is *submitted* before the window closes, so the
 * entrance shuts one full test length before the end. Otherwise someone could
 * start twenty minutes before closing, work the whole test, and have the result
 * thrown away — the worst possible way to learn the rule.
 */
export function canStartOlympiadAttempt(
  window: OlympiadWindow,
  totalDurationSeconds: number,
  now = new Date()
) {
  if (getOlympiadStatus(window, now) !== 'running') return false;

  const latestStart = window.endsAt.getTime() - totalDurationSeconds * 1000;
  return now.getTime() <= latestStart;
}

/** The instant after which a test can no longer be started and still finish. */
export function getLatestStart(window: OlympiadWindow, totalDurationSeconds: number) {
  return new Date(window.endsAt.getTime() - totalDurationSeconds * 1000);
}

/**
 * Windows are shown and entered in Tashkent time rather than the viewer's own
 * zone. The audience is in Uzbekistan, and a fixed zone keeps the server render
 * and the browser in agreement — otherwise the page would have to hydrate the
 * dates a second time to correct them. Uzbekistan has no daylight saving, so the
 * offset is a constant.
 */
export const OLYMPIAD_TIME_ZONE = 'Asia/Tashkent';
export const OLYMPIAD_UTC_OFFSET = '+05:00';

export function formatOlympiadMoment(date: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: OLYMPIAD_TIME_ZONE,
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/**
 * `3720` -> `1 h 2 min`, for the time column and the window length. Kept in the
 * same vocabulary as the catalogue's own duration label ("min", "hour"), but
 * carries seconds too: a participant's time is rarely a round minute.
 */
export function formatDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;

  if (hours > 0) return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`;
  if (minutes > 0) return rest > 0 ? `${minutes} min ${rest} s` : `${minutes} min`;
  return `${seconds} s`;
}

/**
 * Turns a `datetime-local` value from the admin form into an instant. The input
 * carries no zone, so it is read as Tashkent time — the same zone the admin sees
 * everywhere else. Returns null for an empty or unparsable value, which is how
 * the form clears a window.
 */
export function parseOlympiadMoment(value: unknown): Date | null {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  // `2026-09-12T09:00` and `2026-09-12T09:00:00` are both produced by browsers.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) return null;

  const withSeconds = trimmed.length === 16 ? `${trimmed}:00` : trimmed;
  const parsed = new Date(`${withSeconds}${OLYMPIAD_UTC_OFFSET}`);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** The inverse, for pre-filling the form with an existing window. */
export function toOlympiadInputValue(date: Date | null) {
  if (!date) return '';

  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: OLYMPIAD_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);

  // `sv-SE` formats as `2026-09-12 09:00`; the input wants a `T`.
  return parts.replace(' ', 'T');
}

export interface OlympiadStanding {
  rank: number;
  userId: string;
  /**
   * Null when the account has no name. The table is public to every
   * participant, so an e-mail is never used as a fallback — the page shows a
   * neutral placeholder instead.
   */
  name: string | null;
  correctCount: number;
  timeSpent: number;
  score: number;
  /** How many attempts this participant made inside the window. */
  attempts: number;
  submittedAt: Date;
}

export interface OlympiadResults {
  standings: OlympiadStanding[];
  totalQuestions: number;
  participants: number;
}

/** One submitted attempt, as the ranking needs it. */
export interface RankableAttempt {
  userId: string;
  correctCount: number | null;
  score: number;
  timeSpent: number;
  createdAt: Date;
  user: { name: string | null };
}

/**
 * Ranks participants: most solved first, and on a tie the faster time wins —
 * the two things the ranking was asked to show.
 *
 * Every participant is represented by their best attempt alone, so making more
 * attempts cannot push anyone else down the table.
 *
 * Equal pairs share a place (1, 2, 2, 4), because two people who solved the same
 * number in the same time did not in fact finish one above the other.
 *
 * Kept free of the database so the tie and best-attempt rules can be tested
 * directly; `getOlympiadResults` supplies the rows.
 */
export function rankOlympiadAttempts(attempts: RankableAttempt[]): OlympiadStanding[] {
  const best = new Map<string, OlympiadStanding>();

  for (const attempt of attempts) {
    // A row written before `correctCount` existed cannot be ranked honestly, and
    // counting it as zero would place that person below people who scored zero
    // in more time. Skipping is the lesser wrong, and no such row exists today.
    if (attempt.correctCount === null) continue;

    const current = best.get(attempt.userId);
    const candidate: OlympiadStanding = {
      rank: 0,
      userId: attempt.userId,
      name: attempt.user.name?.trim() || null,
      correctCount: attempt.correctCount,
      timeSpent: attempt.timeSpent,
      score: attempt.score,
      attempts: (current?.attempts ?? 0) + 1,
      submittedAt: attempt.createdAt,
    };

    if (!current) {
      best.set(attempt.userId, candidate);
      continue;
    }

    const isBetter =
      candidate.correctCount > current.correctCount ||
      (candidate.correctCount === current.correctCount &&
        candidate.timeSpent < current.timeSpent);

    best.set(attempt.userId, isBetter ? candidate : { ...current, attempts: candidate.attempts });
  }

  const standings = [...best.values()].sort(
    (a, b) => b.correctCount - a.correctCount || a.timeSpent - b.timeSpent
  );

  let previous: OlympiadStanding | undefined;
  for (const [index, standing] of standings.entries()) {
    const tiesPrevious =
      previous !== undefined &&
      previous.correctCount === standing.correctCount &&
      previous.timeSpent === standing.timeSpent;

    standing.rank = previous && tiesPrevious ? previous.rank : index + 1;
    previous = standing;
  }

  return standings;
}
