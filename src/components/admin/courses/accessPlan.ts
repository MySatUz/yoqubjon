import { formatDate } from '@/lib/formatDate';
import { OLYMPIAD_TIME_ZONE } from '@/lib/olympiad';

/*
 * The arithmetic of course access, shared by the Give access dialog (the
 * preview) and the server actions (the run), so what the preview promises is
 * what gets stored. Pure: no Prisma, no React - the dialog bundles it.
 *
 * Dates travel as `YYYY-MM-DD` keys. An access end is the UTC calendar date
 * of `SectionAccess.expiresAt`, which is stored as 23:59:59.999 UTC of the
 * day the admin chose (`accessEndsAt` in src/lib/sectionAccess.ts). Read in
 * Tashkent time it would be the next morning, and the admin's "until 14 Dec"
 * would print as 15 Dec. "Today" is the Tashkent calendar date.
 */

export const MAX_ACCESS_EMAILS = 100;
export const MAX_ACCESS_NOTE_LENGTH = 300;
export const ACCESS_MONTH_CHOICES = [1, 2, 3] as const;
export type AccessMonths = (typeof ACCESS_MONTH_CHOICES)[number];

export function isAccessMonths(value: unknown): value is AccessMonths {
  return ACCESS_MONTH_CHOICES.includes(value as AccessMonths);
}

/*
 * The one address rule, for the dialog and for the server: the actions and
 * `validateAccessEmail` in src/lib/sectionAccess.ts import it from here, since
 * that file imports Prisma and cannot be bundled for the browser. No spaces,
 * brackets, quotes, commas or colons - what is left of a pasted
 * "Name <a@b.com>" whose wrapping was not taken off is reported as invalid,
 * never stored - and a domain of dotted labels ending in two letters or more.
 */
const EMAIL_PATTERN = /^[^\s@<>()[\]",;:\\]+@(?:[^\s@<>()[\]",;:\\'`.]+\.)+[^\s@<>()[\]",;:\\'`.]{2,}$/;

/* What a copied address comes wrapped in: brackets, straight and typographic
   quotes, and at its end the full stop or comma of the sentence it was in. */
const LEADING_WRAPPING = /^[\s<>()[\]{}"'`«»“”‘’]+/;
const TRAILING_WRAPPING = /[\s<>()[\]{}"'`«»“”‘’.,;:!?]+$/;

/**
 * The bare address in what an admin pasted or typed, lower-cased: the part
 * inside <…> of "Madina Yusupova <madina@gmail.com>", without a mailto:
 * prefix, the quotes or brackets around it, or a trailing full stop or comma.
 * Saved as typed, "<madina@gmail.com>" was access no sign-up could ever match.
 */
export function extractEmailAddress(value: string) {
  let text = value.trim();
  const angled = text.match(/<([^<>]*)>/);
  if (angled) text = angled[1];

  let previous: string;
  do {
    previous = text;
    text = text
      .replace(LEADING_WRAPPING, '')
      .replace(TRAILING_WRAPPING, '')
      // A mailto: link may carry ?subject=… after the address.
      .replace(/^mailto:([^?]*)(?:\?.*)?$/i, '$1');
  } while (text !== previous);

  return text.toLowerCase();
}

export function isValidAccessEmail(email: string) {
  return EMAIL_PATTERN.test(email);
}

/**
 * A pasted list cut into addresses: on commas, semicolons and new lines, then
 * on spaces. In a part that holds "<…>" - a copied To: line, "Madina Yusupova
 * <madina@gmail.com>, Jasur <jasur@mail.ru>" - the words around the brackets
 * are a name, not addresses, and are left out. A quoted name may hold a comma
 * ("Yusupova, Madina" <madina@gmail.com>), so it goes first.
 */
function splitPastedEmails(text: string) {
  return text
    .replace(/"[^"\n]*"(?=\s*<)/g, ' ')
    .split(/[,;\r\n]+/)
    .flatMap((part) => {
      const tokens = part.match(/<[^<>]*>|[^\s<>]+/g) ?? [];
      const hasAngled = tokens.some((token) => token.startsWith('<'));
      return hasAngled ? tokens.filter((token) => token.startsWith('<') || token.includes('@')) : tokens;
    })
    .map(extractEmailAddress)
    .filter(Boolean);
}

export type PastedEmail = { email: string; status: 'valid' | 'invalid' | 'duplicate' };

/**
 * A pasted list as the dialog reads it: each address taken out of its
 * wrapping (`extractEmailAddress`) and lower-cased. A repeat of an address
 * already in the list is a duplicate and is sent once.
 */
export function parseEmailList(text: string): PastedEmail[] {
  const seen = new Set<string>();

  return splitPastedEmails(text).map((email): PastedEmail => {
    if (!isValidAccessEmail(email)) return { email, status: 'invalid' };
    if (seen.has(email)) return { email, status: 'duplicate' };
    seen.add(email);
    return { email, status: 'valid' };
  });
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function toKey(year: number, monthIndex: number, day: number) {
  return `${year}-${pad(monthIndex + 1)}-${pad(day)}`;
}

function splitKey(key: string) {
  const [year, month, day] = key.split('-').map(Number);
  return { year, monthIndex: month - 1, day };
}

const tashkentDateParts = new Intl.DateTimeFormat('en-GB', {
  timeZone: OLYMPIAD_TIME_ZONE,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
});

/** The Tashkent calendar date of an instant. */
export function tashkentDateKey(instant: Date) {
  const parts = Object.fromEntries(
    tashkentDateParts.formatToParts(instant).map((part) => [part.type, part.value]),
  );
  return toKey(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
}

/** The UTC calendar date of an instant: the access end the admin chose. */
export function utcDateKey(instant: Date) {
  return toKey(instant.getUTCFullYear(), instant.getUTCMonth(), instant.getUTCDate());
}

/** N calendar months later; a day the month lacks clamps to its end (31 Dec + 2 = 28 Feb). */
export function addMonthsToKey(key: string, months: number) {
  const { year, monthIndex, day } = splitKey(key);
  const target = new Date(Date.UTC(year, monthIndex + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return toKey(target.getUTCFullYear(), target.getUTCMonth(), Math.min(day, lastDay));
}

export function addDaysToKey(key: string, days: number) {
  const { year, monthIndex, day } = splitKey(key);
  return utcDateKey(new Date(Date.UTC(year, monthIndex, day + days)));
}

/** Whole days from one key to another; negative when `to` is earlier. */
export function daysBetweenKeys(from: string, to: string) {
  const a = splitKey(from);
  const b = splitKey(to);
  return Math.round((Date.UTC(b.year, b.monthIndex, b.day) - Date.UTC(a.year, a.monthIndex, a.day)) / 86_400_000);
}

/**
 * "14 Dec", or "14 Dec 2027" outside the current year. Through `formatDate`,
 * like every date in the app: noon in Tashkent of that day is the same
 * calendar day whatever the zone does.
 */
export function formatDateKey(key: string, todayKey: string) {
  const text = formatDate(`${key}T12:00:00+05:00`);
  const thisYear = ` ${todayKey.slice(0, 4)}`;
  return text.endsWith(thisYear) ? text.slice(0, -thisYear.length) : text;
}

/** An access ending within this many days counts as "ends soon". */
export const ENDS_SOON_DAYS = 7;

/**
 * Whether a live access entry ends within the week. For live entries only: an
 * end a day before today's Tashkent date is still live until 05:00 there.
 */
export function endsSoon(endKey: string | null, todayKey: string) {
  return endKey !== null && daysBetweenKeys(todayKey, endKey) <= ENDS_SOON_DAYS;
}

export type AccessChange = 'new' | 'extended' | 'renewed' | 'unchanged';

export const ACCESS_CHANGE_LABELS: Record<AccessChange, string> = {
  new: 'New',
  extended: 'Extended',
  renewed: 'Renewed',
  unchanged: 'Unchanged',
};

/**
 * What giving N months does to one email's access in one course. Access only
 * ever grows: it runs on from the current end when that is today or later,
 * from today when there is none or it has ended. An entry without an end date
 * is left alone - it cannot be made any longer.
 */
export function planAccess(
  current: { endKey: string | null } | null,
  todayKey: string,
  months: number,
): { change: AccessChange; afterKey: string | null } {
  if (!current) return { change: 'new', afterKey: addMonthsToKey(todayKey, months) };
  if (current.endKey === null) return { change: 'unchanged', afterKey: null };
  if (current.endKey < todayKey) return { change: 'renewed', afterKey: addMonthsToKey(todayKey, months) };
  return { change: 'extended', afterKey: addMonthsToKey(current.endKey, months) };
}

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * One email's access in a course as the admin saw it before sending: "none"
 * (no entry), "open" (no end date) or the end's date key. The run carries it
 * back for each email, and the server writes only rows still in that state
 * (`giveCourseAccess`): a resend after a lost answer, a double click, a
 * second admin - none of them gives the same month twice.
 */
export function accessStateToken(current: { endKey: string | null } | null) {
  if (!current) return 'none';
  return current.endKey ?? 'open';
}

/** The access a token stands for; undefined for anything that is not one. */
export function readAccessStateToken(token: unknown): { endKey: string | null } | null | undefined {
  if (token === 'none') return null;
  if (token === 'open') return { endKey: null };
  return typeof token === 'string' && DATE_KEY_PATTERN.test(token) ? { endKey: token } : undefined;
}

/** Whose account an access email is, in the three words used everywhere. */
export type AccessAccountState = 'confirmed' | 'waiting' | 'none';

export const ACCOUNT_STATE_LABELS: Record<AccessAccountState, string> = {
  confirmed: 'Confirmed',
  waiting: 'Waiting for email confirmation',
  none: 'No account yet',
};

/**
 * The server's messages in the admin's words. Anything else is shown as it
 * came, after "Not saved:".
 */
export function describeAccessError(message: string | undefined) {
  if (!message) return 'Not saved. Try again.';
  if (/section (was not found|is invalid|no longer exists)|invalid section/i.test(message)) {
    return 'This course no longer exists.';
  }
  if (/valid email/i.test(message)) return 'Not a valid email.';
  if (/expiration date/i.test(message)) return 'The end date must be after today.';
  if (message === 'Forbidden') return 'Not saved: your admin access was removed.';
  if (/could not (grant|give)/i.test(message)) return 'Not saved. Try again.';
  if (/could not revoke/i.test(message)) return 'Access was not removed. Try again.';
  return `Not saved: ${message}`;
}
