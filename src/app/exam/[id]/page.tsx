import { prisma } from '@/lib/prisma';
import TopNav from '@/components/exam/TopNav';
import SplitScreen from '@/components/exam/SplitScreen';
import BottomNav from '@/components/exam/BottomNav';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { EXAM_DURATION_SECONDS } from '@/lib/examConfig';
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
    include: {
      questions: {
        orderBy: { order: 'asc' },
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

  const questions = test.questions;
  const questionIds = questions.map((question) => question.id);
  const initialTimeSeconds = test.durationSeconds || EXAM_DURATION_SECONDS;

  return (
    <main className="flex flex-col h-screen bg-slate-50 overflow-hidden">
      <TopNav
        testId={id}
        questionIds={questionIds}
        initialTimeSeconds={initialTimeSeconds}
      />
      <SplitScreen questions={questions} />
      <BottomNav
        testId={id}
        questionIds={questionIds}
        initialTimeSeconds={initialTimeSeconds}
      />
    </main>
  );
}
