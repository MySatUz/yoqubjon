import { prisma } from '@/lib/prisma';
import { isTestCategory, normalizeCategoryId } from '@/lib/testCatalog';
import { extractEmailAddress, isValidAccessEmail } from '@/components/admin/courses/accessPlan';

/** An account's or a stored entry's email as access entries are matched: trimmed, lower-cased. */
export function normalizeAccessEmail(value: unknown) {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

/**
 * An email an admin typed, for a new access entry: the bare address taken out
 * of "Name <a@b.com>", quotes or a trailing full stop, by the same rule as the
 * Give access dialog, so what is stored is what a student signs up with.
 */
export function validateAccessEmail(value: unknown) {
  const email = typeof value === 'string' ? extractEmailAddress(value) : '';
  if (!email || !isValidAccessEmail(email)) {
    throw new Error('Enter a valid email address');
  }

  return email;
}

export function normalizeAccessCategory(value: unknown) {
  if (!isTestCategory(value)) {
    throw new Error('Selected section is invalid');
  }

  return normalizeCategoryId(value);
}

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * How an access end is stored: the last millisecond of the chosen day in UTC,
 * so the admin's date is the UTC calendar date of `expiresAt` (see
 * src/components/admin/courses/accessPlan.ts). Explicitly UTC: the form used
 * to append no zone, which meant UTC on Vercel and whatever zone a local dev
 * machine ran in.
 */
export function accessEndsAt(dateKey: string) {
  if (!DATE_KEY_PATTERN.test(dateKey)) {
    throw new Error('Expiration date is invalid');
  }

  const date = new Date(`${dateKey}T23:59:59.999Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Expiration date is invalid');
  }

  return date;
}

function activeAccessFilter(now = new Date()) {
  return {
    OR: [
      { expiresAt: null },
      { expiresAt: { gt: now } },
    ],
  };
}

function accessIdentityFilter(userId: string, email?: string | null) {
  const normalizedEmail = normalizeAccessEmail(email);
  return {
    OR: [
      { userId },
      ...(normalizedEmail ? [{ email: normalizedEmail }] : []),
    ],
  };
}

async function resolveUserEmail(userId: string, email?: string | null) {
  const normalizedEmail = normalizeAccessEmail(email);
  if (normalizedEmail) return normalizedEmail;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  return normalizeAccessEmail(user?.email);
}

export type SectionAccessGrant = {
  category: string;
  /** When the course access ends; null for access without an end date. */
  expiresAt: Date | null;
  grantedAt: Date;
};

/**
 * The student's live course grants, one per section, with their dates - what
 * the Practice home needs to show a course and how long it stays open. Where
 * two grants cover one section (one by email, one by account), the one that
 * lasts longer wins.
 */
export async function getActiveSectionAccessGrants(userId: string, email?: string | null): Promise<SectionAccessGrant[]> {
  const normalizedEmail = await resolveUserEmail(userId, email);
  const rows = await prisma.sectionAccess.findMany({
    where: {
      AND: [
        activeAccessFilter(),
        accessIdentityFilter(userId, normalizedEmail),
      ],
    },
    select: { category: true, expiresAt: true, createdAt: true },
  });

  const byCategory = new Map<string, SectionAccessGrant>();
  for (const row of rows) {
    const category = normalizeCategoryId(row.category);
    const known = byCategory.get(category);
    const lastsLonger = !known || (known.expiresAt !== null && (row.expiresAt === null || row.expiresAt > known.expiresAt));
    if (lastsLonger) byCategory.set(category, { category, expiresAt: row.expiresAt, grantedAt: row.createdAt });
  }
  return [...byCategory.values()];
}

export async function getActiveSectionAccessCategories(userId: string, email?: string | null) {
  const grants = await getActiveSectionAccessGrants(userId, email);
  return grants.map((grant) => grant.category);
}

export async function userHasActiveSectionAccess(
  userId: string,
  email: string | null | undefined,
  category: string | null | undefined
) {
  if (!category || !isTestCategory(category)) return false;

  const normalizedEmail = await resolveUserEmail(userId, email);
  const access = await prisma.sectionAccess.findFirst({
    where: {
      category: normalizeCategoryId(category),
      AND: [
        activeAccessFilter(),
        accessIdentityFilter(userId, normalizedEmail),
      ],
    },
    select: { id: true },
  });

  return Boolean(access);
}
