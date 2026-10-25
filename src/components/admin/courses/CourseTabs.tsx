'use client';

import Link from 'next/link';
import { useSelectedLayoutSegment } from 'next/navigation';
import { courseHref, type CourseTab } from '@/components/admin/courses/courseLinks';
import { GiveAccessButton, type AccessCourse } from '@/components/admin/courses/GiveAccess';
import { segmentClass, segmentedClass } from '@/components/ui/Misc';

const tabs: Array<{ tab?: CourseTab; label: string }> = [
  { label: 'Students' },
  { tab: 'tests', label: 'Tests' },
  { tab: 'results', label: 'Results' },
  { tab: 'settings', label: 'Settings' },
];

/*
 * The tab is read from the segment under the course layout, not from the
 * pathname: a course opened by its lower-case or dashed id has a pathname
 * that matches none of the canonical links.
 */
function useActiveTab(): CourseTab | undefined {
  const segment = useSelectedLayoutSegment();
  return tabs.find((item) => item.tab === segment)?.tab;
}

/**
 * The course's four tabs, each a URL. Four options on one line: the
 * segmented control, which works on links as well as buttons. It scrolls
 * sideways rather than wrap on a narrow phone.
 */
export function CourseTabs({ courseId }: { courseId: string }) {
  const current = useActiveTab();

  return (
    <nav aria-label="Course" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className={segmentedClass}>
        {tabs.map((item) => {
          const isActive = item.tab === current;
          return (
            <Link
              key={item.label}
              href={courseHref(courseId, item.tab)}
              aria-current={isActive ? 'page' : undefined}
              className={segmentClass(isActive)}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/**
 * [Give access] in the course header, with the course chosen. Not on the
 * Students tab, whose own toolbar holds it as the page's one primary button.
 */
export function CourseHeaderActions({ courseId, courses }: { courseId: string; courses: AccessCourse[] }) {
  const current = useActiveTab();
  if (current === undefined) return null;

  return <GiveAccessButton courses={courses} preset={{ courseId }} variant="secondary" />;
}
