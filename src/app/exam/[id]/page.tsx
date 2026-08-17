import { prisma } from '@/lib/prisma';
import ExamRunner from '@/components/exam/ExamRunner';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { buildExamModules } from '@/lib/examModules';
import { isAdminUser } from '@/lib/admin';
import { userHasActiveSectionAccess } from '@/lib/sectionAccess';

export default async function DynamicExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const userId = session.user.id;
  const userEmail = session.user.email;
  let adminCheck: Promise<boolean> | null = null;
  const getIsAdmin = () => {
    adminCheck ??= isAdminUser(userId);
    return adminCheck;
  };

  const test = await prisma.test.findUnique({
    where: { id },
    select: {
      id: true,
      isFree: true,
      visible: true,
      maxAttempts: true,
      collectionCategory: true,
      durationSeconds: true,
      moduleDurations: true,
      questions: {
        orderBy: { order: 'asc' },
        // Correct answers stay on the server so they never reach the exam page.
        select: {
          id: true,
          content: true,
          options: true,
          imageUrl: true,
          moduleIndex: true,
        },
      },
    },
  });

  if (!test) {
    notFound();
  }

  const isAdmin = await getIsAdmin();

  if (!test.visible && !isAdmin) {
    notFound();
  }

  if (!isAdmin) {
    const attemptsUsed = await prisma.result.count({
      where: {
        userId,
        testId: test.id,
      },
    });

    if (attemptsUsed >= test.maxAttempts) {
      redirect('/dashboard?attemptLimit=reached');
    }
  }

  if (!test.isFree) {
    const [subscription, hasSectionAccess] = await Promise.all([
      prisma.subscription.findFirst({
        where: {
          userId,
          isActive: true,
          expiresAt: { gt: new Date() },
        },
        select: { id: true },
      }),
      userHasActiveSectionAccess(userId, userEmail, test.collectionCategory),
    ]);

    if (!subscription && !hasSectionAccess && !isAdmin) {
      redirect('/dashboard/subscription');
    }
  }

  const modules = buildExamModules(test, test.questions);

  if (modules.length === 0) {
    notFound();
  }

  return <ExamRunner testId={id} modules={modules} />;
}
