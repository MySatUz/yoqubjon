export type CourseTab = 'students' | 'results' | 'settings';

/**
 * A course page: Tests at the course's own URL, the other tabs under it.
 * The id goes in as stored (upper case); `resolveCourse` also reads the
 * lower-case and dashed forms.
 */
export function courseHref(courseId: string, tab?: CourseTab) {
  const base = `/admin/courses/${encodeURIComponent(courseId)}`;
  return tab ? `${base}/${tab}` : base;
}
