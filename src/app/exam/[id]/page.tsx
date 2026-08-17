import { prisma } from '@/lib/prisma';
import ExamRunner from '@/components/exam/ExamRunner';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { buildExamModules } from '@/lib/examModules';
import { isAdminUser } from '@/lib/admin';
import { userHasActiveSectionAccess } from '@/lib/sectionAccess';
import { getExamQuestionsHtml } from '@/lib/examQuestions';

export default async function DynamicExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const userId = session.user.id;
  const userEmail = session.user.email;

  // None of these five reads depends on another, so they all start at once
  // instead of forming a five-step waterfall before the first byte. Admins and
  // free tests now pay for two extra cheap index lookups; the check order below
  // (notFound -> attempt limit -> subscription) is unchanged, so the redirects
  // stay exactly the same.
  //
  // The questions come from a per-test cache and carry their maths already
  // rendered to HTML, so the exam bundle no longer ships KaTeX. The test row
  // itself stays uncached: `visible` and `maxAttempts` gate access and have to
  // be read fresh.
  const [test, isAdmin, attemptsUsed, subscription, questions] = await Promise.all([
    prisma.test.findUnique({
      where: { id },
      select: {
        id: true,
        isFree: true,
        visible: true,
        maxAttempts: true,
        collectionCategory: true,
        durationSeconds: true,
        moduleDurations: true,
      },
    }),
    isAdminUser(userId),
    prisma.result.count({
      where: {
        userId,
        testId: id,
      },
    }),
    prisma.subscription.findFirst({
      where: {
        userId,
        isActive: true,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    }),
    getExamQuestionsHtml(id),
  ]);

  if (!test) {
    notFound();
  }

  if (!test.visible && !isAdmin) {
    notFound();
  }

  if (!isAdmin && attemptsUsed >= test.maxAttempts) {
    redirect('/dashboard?attemptLimit=reached');
  }

  if (!test.isFree) {
    // Depends on `test.collectionCategory`, so it cannot join the batch above.
    const hasSectionAccess = await userHasActiveSectionAccess(
      userId,
      userEmail,
      test.collectionCategory
    );

    if (!subscription && !hasSectionAccess && !isAdmin) {
      redirect('/dashboard/subscription');
    }
  }

  const modules = buildExamModules(test, questions);

  if (modules.length === 0) {
    notFound();
  }

  return <ExamRunner testId={id} modules={modules} />;
}
