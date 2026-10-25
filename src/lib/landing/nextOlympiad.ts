import { prisma } from '@/lib/prisma';
import { formatOlympiadMoment, readOlympiadWindow } from '@/lib/olympiad';
import type { LandingOlympiad, LandingSchedule } from '@/lib/landing/olympiadSchedule';

/**
 * The olympiad the landing announces: the earliest visible one that has not
 * closed yet, so one that is open right now wins over one that opens later.
 *
 * Only tests a student could find in the catalogue count — the test visible,
 * and its section visible too. A group's private olympiad in a hidden section
 * is not advertised to the public page.
 *
 * Never throws. If the read fails the block says the schedule is unavailable
 * instead of claiming there is nothing scheduled; it never invents a date.
 */
export async function getLandingSchedule(): Promise<LandingSchedule> {
  const checkedAt = Date.now();
  return { olympiad: await readNextOlympiad(new Date(checkedAt)), checkedAt };
}

async function readNextOlympiad(now: Date): Promise<LandingOlympiad> {
  try {
    const candidates = await prisma.test.findMany({
      where: {
        visible: true,
        olympiadStartsAt: { not: null },
        olympiadEndsAt: { gt: now },
        OR: [{ collectionCategory: null }, { collection: { visible: true } }],
      },
      orderBy: { olympiadStartsAt: 'asc' },
      take: 5,
      select: { id: true, olympiadStartsAt: true, olympiadEndsAt: true },
    });

    for (const test of candidates) {
      // The same rule the olympiad page uses: a half-set or inverted window is
      // no olympiad at all.
      const olympiadWindow = readOlympiadWindow(test);
      if (!olympiadWindow) continue;

      return {
        state: 'scheduled',
        id: test.id,
        startsAt: olympiadWindow.startsAt.toISOString(),
        endsAt: olympiadWindow.endsAt.toISOString(),
        opensLabel: formatOlympiadMoment(olympiadWindow.startsAt),
        closesLabel: formatOlympiadMoment(olympiadWindow.endsAt),
      };
    }

    return { state: 'none' };
  } catch (error) {
    console.error('Landing: could not read the olympiad schedule', error);
    return { state: 'unavailable' };
  }
}
