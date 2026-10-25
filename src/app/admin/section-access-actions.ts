'use server';

import { refresh } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin';
import {
  accessEndsAt,
  normalizeAccessCategory,
  normalizeAccessEmail,
  validateAccessEmail,
} from '@/lib/sectionAccess';
import { storeDefaultCoursesIfEmpty } from '@/lib/testCollections';
import {
  MAX_ACCESS_EMAILS,
  MAX_ACCESS_NOTE_LENGTH,
  accessStateToken,
  extractEmailAddress,
  isAccessMonths,
  isValidAccessEmail,
  planAccess,
  readAccessStateToken,
  tashkentDateKey,
  utcDateKey,
  type AccessAccountState,
  type AccessChange,
} from '@/components/admin/courses/accessPlan';

function parseExpiresAt(value: FormDataEntryValue | null) {
  if (typeof value !== 'string' || !value.trim()) return null;

  const date = accessEndsAt(value.trim());

  if (date <= new Date()) {
    throw new Error('Expiration date must be in the future');
  }

  return date;
}

function parseNote(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') return null;
  const note = value.trim();
  return note ? note.slice(0, 300) : null;
}

export async function grantSectionAccess(formData: FormData) {
  try {
    const session = await requireAdmin();
    const email = validateAccessEmail(formData.get('email'));
    const category = normalizeAccessCategory(formData.get('category'));
    const expiresAt = parseExpiresAt(formData.get('expiresAt'));
    const note = parseNote(formData.get('note'));

    const [collection, user] = await Promise.all([
      prisma.testCollectionVisibility.findUnique({
        where: { category },
        select: { category: true },
      }),
      prisma.user.findUnique({
        where: { email },
        select: { id: true },
      }),
    ]);

    if (!collection) {
      throw new Error('Selected section was not found');
    }

    await prisma.sectionAccess.upsert({
      where: {
        email_category: { email, category },
      },
      update: {
        userId: user?.id ?? null,
        expiresAt,
        note,
        grantedById: session?.user?.id ?? null,
      },
      create: {
        email,
        userId: user?.id ?? null,
        category,
        expiresAt,
        note,
        grantedById: session?.user?.id ?? null,
      },
    });

    refresh();
    return { success: true };
  } catch (error: unknown) {
    console.error('Grant section access failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Could not grant section access',
    };
  }
}

export async function revokeSectionAccess(accessId: string) {
  try {
    await requireAdmin();

    if (!/^[0-9a-f-]{36}$/i.test(accessId)) {
      throw new Error('Invalid access id');
    }

    await prisma.sectionAccess.delete({
      where: { id: accessId },
    });

    refresh();
    return { success: true };
  } catch (error: unknown) {
    console.error('Revoke section access failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Could not revoke section access',
    };
  }
}

/* ------------------------------------------------------------------------ */
/* Give access: one dialog, many emails, one course, 1-3 months.            */
/* ------------------------------------------------------------------------ */

export type AccessStudentMatch = {
  id: string;
  email: string;
  name: string | null;
  account: AccessAccountState;
};

const MIN_SEARCH_LENGTH = 2;
const MAX_SEARCH_LENGTH = 100;
const MAX_SEARCH_RESULTS = 20;

const accountSelect = {
  id: true,
  email: true,
  name: true,
  pendingEmailVerification: { select: { userId: true } },
} as const;

function readAccountState(user: { pendingEmailVerification: { userId: string } | null } | undefined): AccessAccountState {
  if (!user) return 'none';
  return user.pendingEmailVerification ? 'waiting' : 'confirmed';
}

/**
 * Accounts whose name or email contains the query, for the dialog's "Find
 * students". A server action, so the query travels in a POST body and never
 * in a URL or a server log line.
 */
export async function findStudentsForAccess(query: string): Promise<
  { success: true; users: AccessStudentMatch[] } | { success: false; error: string }
> {
  try {
    await requireAdmin();

    const term = typeof query === 'string' ? query.trim().slice(0, MAX_SEARCH_LENGTH) : '';
    if (term.length < MIN_SEARCH_LENGTH) return { success: true, users: [] };

    const users = await prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: term, mode: 'insensitive' } },
          { name: { contains: term, mode: 'insensitive' } },
        ],
      },
      orderBy: { email: 'asc' },
      take: MAX_SEARCH_RESULTS,
      select: accountSelect,
    });

    return {
      success: true,
      users: users.map((user) => ({
        id: user.id,
        email: normalizeAccessEmail(user.email),
        name: user.name,
        account: readAccountState(user),
      })),
    };
  } catch (error: unknown) {
    console.error('Find students for access failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Could not search accounts' };
  }
}

/**
 * Bare addresses (`extractEmailAddress`), valid, unique, at most the per-run
 * limit - checked again here, whatever the dialog sent.
 */
function readEmailList(emails: unknown) {
  if (!Array.isArray(emails)) throw new Error('Enter a valid email address');

  const unique = [...new Set(
    emails
      .filter((email): email is string => typeof email === 'string')
      .map(extractEmailAddress)
      .filter(isValidAccessEmail)
  )];

  if (unique.length === 0) throw new Error('Enter a valid email address');
  if (unique.length > MAX_ACCESS_EMAILS) {
    throw new Error(`Give access to up to ${MAX_ACCESS_EMAILS} emails at a time`);
  }

  return unique;
}

async function readCourse(categoryValue: unknown) {
  const category = normalizeAccessCategory(categoryValue);
  // A built-in course shown in place of an empty table has no row yet.
  await storeDefaultCoursesIfEmpty();

  const collection = await prisma.testCollectionVisibility.findUnique({
    where: { category },
    select: { category: true },
  });
  if (!collection) throw new Error('Selected section was not found');

  return category;
}

type AccessState = {
  users: Map<string, { id: string; name: string | null; account: AccessAccountState }>;
  grants: Map<string, { endKey: string | null; note: string | null }>;
};

/** Accounts and access entries for these emails in this course: two reads, grouped in memory. */
async function readAccessState(category: string, emails: string[]): Promise<AccessState> {
  const [users, grants] = await Promise.all([
    prisma.user.findMany({ where: { email: { in: emails } }, select: accountSelect }),
    prisma.sectionAccess.findMany({
      where: { category, email: { in: emails } },
      select: { email: true, expiresAt: true, note: true },
    }),
  ]);

  return {
    users: new Map(users.map((user) => [
      normalizeAccessEmail(user.email),
      { id: user.id, name: user.name, account: readAccountState(user) },
    ])),
    grants: new Map(grants.map((grant) => [
      grant.email,
      { endKey: grant.expiresAt ? utcDateKey(grant.expiresAt) : null, note: grant.note },
    ])),
  };
}

export type AccessPreviewRow = {
  email: string;
  name: string | null;
  account: AccessAccountState;
  /** Null when this email has no access entry in the course yet. */
  current: { endKey: string | null; note: string | null } | null;
};

/**
 * What the dialog's preview is built from: each email's account and its
 * current access in the course. Nothing is written. The dates of the change
 * are computed from this with `planAccess`, in the dialog and again in
 * `giveCourseAccess`, against the same Tashkent "today" returned here.
 */
export async function previewCourseAccess(input: { category: string; emails: string[] }): Promise<
  { success: true; todayKey: string; rows: AccessPreviewRow[] } | { success: false; error: string }
> {
  try {
    await requireAdmin();
    const category = normalizeAccessCategory(input?.category);
    const emails = readEmailList(input?.emails);
    const state = await readAccessState(category, emails);

    return {
      success: true,
      todayKey: tashkentDateKey(new Date()),
      rows: emails.map((email) => {
        const user = state.users.get(email);
        const grant = state.grants.get(email);
        return {
          email,
          name: user?.name ?? null,
          account: user?.account ?? 'none',
          current: grant ?? null,
        };
      }),
    };
  } catch (error: unknown) {
    console.error('Preview course access failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Could not check these emails' };
  }
}

export type GiveAccessRowResult =
  | { email: string; outcome: 'given'; change: Exclude<AccessChange, 'unchanged'>; endKey: string }
  | { email: string; outcome: 'unchanged' }
  /** The access is no longer what the admin saw before sending, and was not touched. */
  | { email: string; outcome: 'changed' }
  | { email: string; outcome: 'failed'; error: string };

/** Rows written at once; each is its own upsert, so one failure does not undo the rest. */
const GIVE_ACCESS_CONCURRENCY = 8;

/** Each email's access as the admin saw it (`accessStateToken`), by bare address. */
function readExpectedStates(value: unknown) {
  const expected = new Map<string, string>();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return expected;

  for (const [email, token] of Object.entries(value)) {
    if (typeof token === 'string') expected.set(extractEmailAddress(email), token);
  }
  return expected;
}

/**
 * Gives or extends access for a list of emails in one course. Each row is
 * recomputed here from a fresh read, never taken from what the dialog showed,
 * and only ever lengthens access: from the current end, or from today when
 * there is none or it has ended; an entry without an end date is left as it
 * is. An empty note keeps each entry's own note. One result per email.
 *
 * Idempotent per run: `expected` says what each email's access was when the
 * admin looked (`accessStateToken`), and only a row still in that state is
 * written. A resend after a lost answer finds its rows already at the new end
 * and reports them given without adding the months again; a row someone else
 * changed in between is left alone and reported as changed.
 */
export async function giveCourseAccess(input: {
  category: string;
  emails: string[];
  months: number;
  note?: string;
  expected: Record<string, string>;
}): Promise<{ success: true; todayKey: string; rows: GiveAccessRowResult[] } | { success: false; error: string }> {
  try {
    const session = await requireAdmin();
    const grantedById = session?.user?.id ?? null;
    const category = await readCourse(input?.category);
    const emails = readEmailList(input?.emails);
    const expected = readExpectedStates(input?.expected);
    const months = input?.months;
    if (!isAccessMonths(months)) throw new Error('Choose 1, 2 or 3 months');
    const note = typeof input?.note === 'string' && input.note.trim()
      ? input.note.trim().slice(0, MAX_ACCESS_NOTE_LENGTH)
      : null;

    const todayKey = tashkentDateKey(new Date());
    const state = await readAccessState(category, emails);

    const giveOne = async (email: string): Promise<GiveAccessRowResult> => {
      const stored = state.grants.get(email) ?? null;
      const seenToken = expected.get(email);

      if (seenToken !== accessStateToken(stored)) {
        // Already where this run would put it: this run, saved before its
        // answer was lost, or the same change by someone else. Reported as
        // given, not given again. Anything else is the admin's to look at.
        const seen = readAccessStateToken(seenToken);
        const planned = seen === undefined ? null : planAccess(seen, todayKey, months);
        if (planned && planned.change !== 'unchanged' && planned.afterKey && stored?.endKey === planned.afterKey) {
          return { email, outcome: 'given', change: planned.change, endKey: planned.afterKey };
        }
        return { email, outcome: 'changed' };
      }

      const plan = planAccess(stored, todayKey, months);
      if (plan.change === 'unchanged' || !plan.afterKey) return { email, outcome: 'unchanged' };

      try {
        const expiresAt = accessEndsAt(plan.afterKey);
        const userId = state.users.get(email)?.id ?? null;
        await prisma.sectionAccess.upsert({
          where: { email_category: { email, category } },
          update: { userId, expiresAt, grantedById, ...(note !== null ? { note } : {}) },
          create: { email, userId, category, expiresAt, note, grantedById },
        });
        return { email, outcome: 'given', change: plan.change, endKey: plan.afterKey };
      } catch (error: unknown) {
        console.error(`Give course access failed for one email in ${category}:`, error);
        return { email, outcome: 'failed', error: 'Could not grant section access' };
      }
    };

    const rows: GiveAccessRowResult[] = [];
    for (let start = 0; start < emails.length; start += GIVE_ACCESS_CONCURRENCY) {
      rows.push(...await Promise.all(emails.slice(start, start + GIVE_ACCESS_CONCURRENCY).map(giveOne)));
    }

    if (rows.some((row) => row.outcome === 'given')) refresh();
    return { success: true, todayKey, rows };
  } catch (error: unknown) {
    console.error('Give course access failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Could not grant section access' };
  }
}
