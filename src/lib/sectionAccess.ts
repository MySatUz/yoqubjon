import { prisma } from '@/lib/prisma';
import { isTestCategory, normalizeCategoryId } from '@/lib/testCatalog';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeAccessEmail(value: unknown) {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

export function validateAccessEmail(value: unknown) {
  const email = normalizeAccessEmail(value);
  if (!email || !EMAIL_PATTERN.test(email)) {
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

export async function getActiveSectionAccessCategories(userId: string, email?: string | null) {
  const normalizedEmail = await resolveUserEmail(userId, email);
  const rows = await prisma.sectionAccess.findMany({
    where: {
      AND: [
        activeAccessFilter(),
        accessIdentityFilter(userId, normalizedEmail),
      ],
    },
    select: { category: true },
  });

  return Array.from(new Set(rows.map((row) => normalizeCategoryId(row.category))));
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
