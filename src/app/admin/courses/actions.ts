'use server';

import { revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { deleteTestCollection, updateSectionSettings } from '@/app/admin/actions';
import { requireAdmin } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { isTestCategory, normalizeCategoryId } from '@/lib/testCatalog';
import { normalizeTestMaxAttempts } from '@/lib/testAttempts';
import { TEST_COLLECTIONS_CACHE_TAG, storeDefaultCoursesIfEmpty } from '@/lib/testCollections';
import { courseHref } from '@/components/admin/courses/courseLinks';

/*
 * Course actions the existing ones in ../actions.ts do not cover. Where one
 * of those does the job it is called, not copied: `updateSectionSettings`
 * saves a course and `deleteTestCollection` deletes one.
 */

const MAX_COURSE_NAME_LENGTH = 80;
const MAX_COURSE_DESCRIPTION_LENGTH = 180;
/** Latin letters, digits, dashes and underscores; dashes are stored as underscores. */
const LINK_NAME_PATTERN = /^[A-Za-z0-9_-]{3,40}$/;

type ActionResult = { success: true } | { success: false; error: string };

function readText(value: FormDataEntryValue | null) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Creates a course under the id its link name gives, the next free one if it
 * is taken (`_2`, `_3`, as `createTestCollection` numbers them), and opens it.
 * Unlike `createTestCollection`, the id comes from a link name of its own, so
 * a course can have a long Uzbek or Russian name and a short Latin link.
 */
export async function createCourse(formData: FormData): Promise<ActionResult> {
  let courseId: string;

  try {
    await requireAdmin();

    const name = readText(formData.get('name'));
    if (!name) throw new Error('Enter a name.');
    if (name.length > MAX_COURSE_NAME_LENGTH) throw new Error(`Use at most ${MAX_COURSE_NAME_LENGTH} characters in the name.`);

    const linkName = readText(formData.get('linkName'));
    if (!LINK_NAME_PATTERN.test(linkName)) throw new Error('Use 3–40 Latin letters, digits and dashes in the link name.');

    const description = readText(formData.get('description')) || null;
    if (description && description.length > MAX_COURSE_DESCRIPTION_LENGTH) {
      throw new Error(`Use at most ${MAX_COURSE_DESCRIPTION_LENGTH} characters in the description.`);
    }

    const maxAttempts = normalizeTestMaxAttempts(formData.get('maxAttempts'));
    const baseId = normalizeCategoryId(linkName.replace(/-/g, '_'));
    if (!isTestCategory(baseId)) throw new Error('Use 3–40 Latin letters, digits and dashes in the link name.');

    await storeDefaultCoursesIfEmpty();
    const existing = await prisma.testCollectionVisibility.findMany({ select: { category: true, position: true } });
    const taken = new Set(existing.map((row) => row.category));
    courseId = baseId;
    for (let suffix = 2; taken.has(courseId); suffix += 1) courseId = `${baseId}_${suffix}`;

    await prisma.testCollectionVisibility.create({
      data: {
        category: courseId,
        label: name,
        description,
        visible: true,
        maxAttempts,
        position: Math.max(0, ...existing.map((row) => row.position)) + 10,
      },
    });

    revalidateTag(TEST_COLLECTIONS_CACHE_TAG, { expire: 0 });
  } catch (error: unknown) {
    console.error('Create course failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'The course was not created.' };
  }

  // Outside the try: `redirect` works by throwing.
  redirect(courseHref(courseId));
}

/**
 * Saves a course's settings through `updateSectionSettings`, which needs the
 * course's row - a built-in course shown in place of an empty table gets its
 * row first.
 */
export async function saveCourseSettings(formData: FormData) {
  try {
    await requireAdmin();
    await storeDefaultCoursesIfEmpty();
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : 'Update failed' };
  }

  return updateSectionSettings(formData);
}

/**
 * Deletes a course that holds no tests, with its access entries, and goes to
 * Courses. The page blocks the button while tests remain, but another admin
 * may have added one since: `deleteTestCollection` alone would leave those
 * tests in no course.
 */
export async function deleteCourse(courseId: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    if (!isTestCategory(courseId)) throw new Error('This course no longer exists.');

    const tests = await prisma.test.count({ where: { collectionCategory: normalizeCategoryId(courseId) } });
    if (tests > 0) {
      throw new Error(`This course still holds ${tests} ${tests === 1 ? 'test' : 'tests'}. Move or delete them first.`);
    }

    const result = await deleteTestCollection(courseId);
    if (!result.success) {
      return {
        success: false,
        error: result.error === 'Keep at least one section' ? 'Keep at least one course.' : result.error ?? 'Not deleted. Try again.',
      };
    }
  } catch (error: unknown) {
    console.error('Delete course failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Not deleted. Try again.' };
  }

  redirect('/admin/courses');
}
