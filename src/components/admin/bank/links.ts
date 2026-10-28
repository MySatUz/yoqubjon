import { courseHref } from '@/components/admin/courses/courseLinks';

/**
 * A course's Tests tab, the course's own URL. The course id is its
 * `TestCollectionVisibility.category` as stored (the course pages resolve it back).
 */
export function courseTestsHref(category: string) {
  return courseHref(category);
}

/** Where to build a test from the bank into a course. */
export function bankBuildHref(category: string) {
  return `/admin/bank/build?course=${encodeURIComponent(category)}`;
}
