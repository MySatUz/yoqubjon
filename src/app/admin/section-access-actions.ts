'use server';

import { refresh } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin';
import {
  normalizeAccessCategory,
  validateAccessEmail,
} from '@/lib/sectionAccess';

function parseExpiresAt(value: FormDataEntryValue | null) {
  if (typeof value !== 'string' || !value.trim()) return null;

  const date = new Date(`${value.trim()}T23:59:59.999`);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Expiration date is invalid');
  }

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
