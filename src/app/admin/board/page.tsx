import type { Metadata } from 'next';
import BoardApp from '@/components/board/BoardApp';
import ReferenceSheet from '@/components/exam/ReferenceSheet';
import { searchBank } from '@/app/admin/board/boardData';
import { requireAdminPage } from '@/lib/admin';
import { EMPTY_FILTER, type BankPage } from '@/components/board/types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Board' };

/**
 * The teacher's board (sidebar: Board): one question put up as on the test,
 * from pasted .tex or from the question bank, with the exam's tools and the
 * answer hidden until asked for. Nothing on it is saved.
 *
 * The bank's first page comes with the page, so picking from it starts
 * without a wait; a bank that cannot be read leaves the pasting side working.
 */
export default async function AdminBoardPage() {
  // Kept here on purpose: access must not depend on the segment layout.
  await requireAdminPage();

  let initialBank: BankPage | null = null;
  try {
    initialBank = await searchBank(EMPTY_FILTER, 0);
  } catch (error: unknown) {
    console.error('Board bank error:', error);
  }

  return <BoardApp initialBank={initialBank} referenceSheet={<ReferenceSheet />} />;
}
