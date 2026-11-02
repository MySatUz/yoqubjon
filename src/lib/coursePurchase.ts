import { prisma } from '@/lib/prisma';
import { getActiveSectionAccessGrants } from '@/lib/sectionAccess';
import { getCollectionVisibilityRows } from '@/lib/testCollections';
import { getTestCollections, isTestCategory, normalizeCategoryId } from '@/lib/testCatalog';
import { utcDateKey } from '@/components/admin/courses/accessPlan';

/*
 * Premium Pro is bought one course at a time (the owner's rule, 2026-10-31).
 * The student picks a course, pays by transfer, and an approved payment gives
 * them 30 days of that course as a SectionAccess entry: the same access an
 * admin gives from a course's Students tab, so the exam, the catalog, the
 * results and the olympiad already read it (approveManualPayment in
 * manual-payments.ts).
 *
 * Server only: Prisma.
 */

/** A course on sale to one student, with what they already have of it. */
export type PurchasableCourse = {
  value: string;
  label: string;
  description: string;
  /** Visible tests in it that need access: what a payment opens. */
  paidTests: number;
  /** Their access now, as a `YYYY-MM-DD` UTC key (accessPlan.ts); null when they have none. */
  accessEndKey: string | null;
};

/**
 * The courses this student can pay for, in the catalog's order: every visible
 * course with at least one test that needs access, and a hidden one they
 * already have, so a group course can be renewed. A course they hold with no
 * end date is left out: a payment could not make it any longer. Only stored
 * courses: access needs a row to point at.
 */
export async function getPurchasableCourses(userId: string, email: string | null | undefined): Promise<PurchasableCourse[]> {
  const [rows, paidTests, grants] = await Promise.all([
    getCollectionVisibilityRows(),
    prisma.test.findMany({
      where: { visible: true, isFree: false, collectionCategory: { not: null } },
      select: { collectionCategory: true },
    }),
    getActiveSectionAccessGrants(userId, email),
  ]);
  if (rows.length === 0) return [];

  const paidByCourse = new Map<string, number>();
  for (const test of paidTests) {
    if (!isTestCategory(test.collectionCategory)) continue;
    const category = normalizeCategoryId(test.collectionCategory);
    paidByCourse.set(category, (paidByCourse.get(category) ?? 0) + 1);
  }
  const grantByCourse = new Map(grants.map((grant) => [grant.category, grant]));

  return getTestCollections(rows).flatMap((course) => {
    const grant = grantByCourse.get(course.value);
    const paid = paidByCourse.get(course.value) ?? 0;
    if (paid === 0 || (!course.visible && !grant) || (grant && grant.expiresAt === null)) return [];

    return [{
      value: course.value,
      label: course.label,
      description: course.description,
      paidTests: paid,
      accessEndKey: grant?.expiresAt ? utcDateKey(grant.expiresAt) : null,
    }];
  });
}

/** The course a payment request names, if this student can still buy it; null otherwise. */
export async function findPurchasableCourse(userId: string, email: string | null | undefined, value: unknown) {
  if (!isTestCategory(value)) return null;
  const category = normalizeCategoryId(value);
  const courses = await getPurchasableCourses(userId, email);
  return courses.find((course) => course.value === category) ?? null;
}
