/**
 * A course's Tests tab. The course id is its `TestCollectionVisibility.category`
 * as stored, URL-encoded (the course pages resolve it back).
 */
export function courseTestsHref(category: string) {
  return `/admin/courses/${encodeURIComponent(category)}/tests`;
}

/** Where to build a test from the bank into a course. */
export function bankBuildHref(category: string) {
  return `/admin/bank/build?course=${encodeURIComponent(category)}`;
}
