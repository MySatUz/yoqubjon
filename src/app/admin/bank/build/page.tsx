import type { Metadata } from 'next';
import Link from 'next/link';
import { Library, Upload } from 'lucide-react';
import { requireAdminPage } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import {
  findCategoryByQuery,
  getCategoryLabel,
  getTestCollections,
  normalizeCategoryId,
  type TestCollectionOption,
} from '@/lib/testCatalog';
import { getCollectionVisibilityRows } from '@/lib/testCollections';
import BuildTestForm from '@/components/admin/bank/BuildTestForm';
import { courseTestsHref } from '@/components/admin/bank/links';
import { buttonClass } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Feedback';
import { BackLink, Page, PageHeader } from '@/components/ui/Page';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const metadata: Metadata = { title: 'Build a test' };

/** The course in `?course=`, as stored, or null when it names none. */
function readCourse(value: string | string[] | undefined, courses: TestCollectionOption[]) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;

  const exact = courses.find((course) => course.value === raw.trim() || course.value === normalizeCategoryId(raw));
  return exact?.value ?? findCategoryByQuery(courses, raw);
}

/**
 * Builds a test in a course from the question bank (BuildTestForm). Opened
 * from a course's Tests tab with `?course=<courseId>`; without one, the form
 * asks for the course.
 */
export default async function BuildFromBankPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string | string[] }>;
}) {
  // Kept here on purpose: access must not depend on the segment layout.
  await requireAdminPage();

  const [params, collectionRows, availability] = await Promise.all([
    searchParams,
    getCollectionVisibilityRows(),
    // Per domain and difficulty, so the random pick can say "only 4 match"
    // before it is asked.
    prisma.bankQuestion.groupBy({
      by: ['domain', 'difficulty'],
      _count: { _all: true },
    }),
  ]);

  const collections = getTestCollections(collectionRows);
  const course = readCourse(params.course, collections);
  const bankSize = availability.reduce((total, row) => total + row._count._all, 0);

  return (
    <Page>
      <PageHeader
        back={
          course
            ? <BackLink href={courseTestsHref(course)}>Back to {getCategoryLabel(course, collections)}</BackLink>
            : <BackLink href="/admin/bank">Back to question bank</BackLink>
        }
        title="Build a test from the bank"
        description={
          course
            ? `Into ${getCategoryLabel(course, collections)}. Fill each module by hand or at random; the test gets its own copy of every question.`
            : 'Fill each module by hand or at random; the test gets its own copy of every question.'
        }
      />

      {bankSize === 0 ? (
        <EmptyState
          icon={<Library />}
          title="The question bank is empty"
          description="Upload a .tex file into the bank first."
          action={
            <Link href="/admin/bank/upload" prefetch={false} className={buttonClass()}>
              <Upload className="h-4 w-4" />
              Upload .tex
            </Link>
          }
        />
      ) : (
        <BuildTestForm
          courses={collections.map((collection) => ({
            value: collection.value,
            label: collection.label,
            maxAttempts: collection.maxAttempts,
          }))}
          defaultCourse={course}
          availability={availability.map((row) => ({
            domain: row.domain,
            difficulty: row.difficulty,
            count: row._count._all,
          }))}
        />
      )}
    </Page>
  );
}
