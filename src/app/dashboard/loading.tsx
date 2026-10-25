import { Page } from '@/components/ui/Page';
import PracticeHomeSkeleton from '@/components/dashboard/PracticeHomeSkeleton';

/**
 * Mirrors page.tsx: the catalog's PageHeader, a course card and the list of
 * collections. The in-page Suspense fallback draws the same component.
 */
export default function Loading() {
  return (
    <Page>
      <p className="sr-only">Loading practice</p>
      <PracticeHomeSkeleton />
    </Page>
  );
}
