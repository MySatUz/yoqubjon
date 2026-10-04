import { prisma } from '@/lib/prisma';
import ExamRunner from '@/components/exam/ExamRunner';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { buildExamModules, getTotalDurationSeconds } from '@/lib/examModules';
import { canStartOlympiadAttempt, readOlympiadWindow } from '@/lib/olympiad';
import { getViewerAccess } from '@/lib/studentView';
import { userHasActiveSectionAccess } from '@/lib/sectionAccess';
import { getExamQuestionsHtml } from '@/lib/examQuestions';
import { userHasUnlockedTest } from '@/lib/testAccessCode';
import AccessCodeGate from '@/components/exam/AccessCodeGate';

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
  const [test, viewer, attemptsUsed, subscription, questions] = await Promise.all([
    prisma.test.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        isFree: true,
        visible: true,
        maxAttempts: true,
        collectionCategory: true,
        durationSeconds: true,
        moduleDurations: true,
        olympiadStartsAt: true,
        olympiadEndsAt: true,
        accessCode: true,
      },
    }),
    getViewerAccess(userId),
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

  // An admin in student view is not an admin here: every gate below applies to
  // them as it would to a student.
  const isAdmin = viewer.isAdmin;

  if (!test) {
    notFound();
  }

  if (!test.visible && !isAdmin) {
    notFound();
  }

  // A competition test only opens inside its window, and closes one full test
  // length before the end so nobody works an attempt that would not be counted.
  // The olympiad page explains which of those two it is; admins bypass it so a
  // test can still be checked before the window opens.
  const olympiadWindow = readOlympiadWindow(test);

  if (
    olympiadWindow &&
    !isAdmin &&
    !canStartOlympiadAttempt(olympiadWindow, getTotalDurationSeconds(test))
  ) {
    redirect(`/olympiad/${id}`);
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

    if (!subscription && !viewer.simulatesSubscription && !hasSectionAccess && !isAdmin) {
      redirect('/dashboard/subscription');
    }
  }

  // Last gate, on top of everything above: a code-protected test shows the code
  // screen instead of the exam until this student has entered the current code.
  // Nothing about the questions reaches the browser before that. Admins skip
  // it, like every other gate on this page.
  if (
    test.accessCode &&
    !isAdmin &&
    !await userHasUnlockedTest(userId, id, test.accessCode)
  ) {
    return <AccessCodeGate testId={id} title={test.title} />;
  }

  const modules = buildExamModules(test, questions);

  if (modules.length === 0) {
    notFound();
  }

  return <ExamRunner testId={id} modules={modules} />;
}
