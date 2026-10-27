import { prisma } from '@/lib/prisma';

/**
 * How many tests a new account can find in Practice and open without paying:
 * marked Free, visible, in a course Practice shows (a test with no course is
 * never listed there), with no test code (that opens on the code screen) and
 * not an olympiad. A linked copy shares its original's questions, so the two
 * count once. The landing prints the number beside its button, so the free
 * offer is counted rather than described.
 *
 * Never throws: on a failed read, or with nothing free, the landing leaves the
 * number out and keeps "No payment details." alone.
 */
export async function countFreeTests(): Promise<number | null> {
  try {
    const tests = await prisma.test.findMany({
      where: { isFree: true, visible: true, accessCode: null, olympiadStartsAt: null, collection: { visible: true } },
      select: { id: true, questionSourceId: true },
    });
    const count = new Set(tests.map((test) => test.questionSourceId ?? test.id)).size;
    return count > 0 ? count : null;
  } catch (error) {
    console.error('Landing: could not count the free tests', error);
    return null;
  }
}
