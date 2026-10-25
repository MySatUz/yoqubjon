import { OLYMPIAD_TIME_ZONE } from '@/lib/olympiad';

/**
 * The one way the app prints a date: English (`en-GB`), Tashkent time.
 *
 * A bare `toLocaleDateString()` follows the machine it runs on, so the same
 * result read "15.10.2026" in one place and "15 окт. 2026 г." in a Russian
 * browser in another, and a client component rendered on the server (UTC) and
 * then in the browser could print two different days. A fixed locale and zone
 * give one spelling everywhere and identical server and client output.
 * Uzbekistan has no daylight saving, so the zone is a constant offset.
 */
const dateFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: OLYMPIAD_TIME_ZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const dateTimeFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: OLYMPIAD_TIME_ZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

type DateInput = Date | string | number;

/**
 * Recent ICU spells September "Sept" in en-GB and older ICU "Sep", so the
 * month is rebuilt from parts: the app reads "Sep" like every other
 * three-letter month, and a server and a browser on different ICU versions
 * still print the same string (a client component would fail to hydrate).
 */
function formatWith(format: Intl.DateTimeFormat, value: DateInput) {
  return format
    .formatToParts(new Date(value))
    .map((part) => (part.type === 'month' ? part.value.slice(0, 3) : part.value))
    .join('');
}

/** `15 Oct 2026` */
export function formatDate(value: DateInput) {
  return formatWith(dateFormat, value);
}

/** `15 Oct 2026, 14:05` */
export function formatDateTime(value: DateInput) {
  return formatWith(dateTimeFormat, value);
}
