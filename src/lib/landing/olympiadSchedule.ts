// The landing's olympiad date block, the part both sides need: the shape the
// server hands over and the countdown wording. Free of Prisma so the client
// island can import it; the query lives in `nextOlympiad.ts`.

export type LandingOlympiad =
  | {
      state: 'scheduled';
      id: string;
      startsAt: string;
      endsAt: string;
      /** `formatOlympiadMoment` output, made on the server in Tashkent time. */
      opensLabel: string;
      closesLabel: string;
    }
  /** Nothing visible is upcoming or open. */
  | { state: 'none' }
  /** The schedule could not be read; the block says so rather than guess. */
  | { state: 'unavailable' };

/** What the page renders from: the schedule, and when the server read it. */
export interface LandingSchedule {
  olympiad: LandingOlympiad;
  checkedAt: number;
}

export type ScheduleStatus = 'upcoming' | 'running' | 'finished';

export function scheduleStatus(startsAt: string, endsAt: string, now: number): ScheduleStatus {
  if (now < Date.parse(startsAt)) return 'upcoming';
  if (now >= Date.parse(endsAt)) return 'finished';
  return 'running';
}

/**
 * "17 days 4 h", "5 h 12 min", "12 min". Minutes only: no ticking seconds.
 * Unpadded and with a zero part dropped, like `formatDuration`.
 */
export function formatOpensIn(ms: number) {
  const minutes = Math.max(1, Math.ceil(ms / 60000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const rest = minutes % 60;

  if (days > 0) {
    const dayText = `${days} ${days === 1 ? 'day' : 'days'}`;
    return hours > 0 ? `${dayText} ${hours} h` : dayText;
  }
  if (hours > 0) return rest > 0 ? `${hours} h ${rest} min` : `${hours} h`;
  return `${rest} min`;
}
