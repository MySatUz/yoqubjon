'use server';

import { refresh } from 'next/cache';
import { requireAdmin } from '@/lib/admin';
import { prisma } from '@/lib/prisma';

const REPORT_ID_PATTERN = /^[0-9a-f-]{36}$/i;
/** More than one question ever gathers; a page sends all of a question's at once. */
const MAX_REPORTS_PER_CLOSE = 200;

/**
 * Closes students' reports about a question, once it is fixed or when nothing
 * was wrong. A report another admin closed a moment earlier is left as it is.
 */
export async function closeQuestionReports(reportIds: string[]) {
  try {
    const session = await requireAdmin();

    const ids = (Array.isArray(reportIds) ? reportIds : [])
      .filter((id): id is string => typeof id === 'string' && REPORT_ID_PATTERN.test(id))
      .slice(0, MAX_REPORTS_PER_CLOSE);

    if (ids.length === 0) {
      return { success: false as const, error: 'No report to close.' };
    }

    const { count } = await prisma.questionReport.updateMany({
      where: { id: { in: ids }, resolvedAt: null },
      data: { resolvedAt: new Date(), resolvedById: session?.user?.id ?? null },
    });

    refresh();
    return { success: true as const, count };
  } catch (error: unknown) {
    console.error('Close question reports error:', error);
    return { success: false as const, error: 'The report was not closed. Try again.' };
  }
}
