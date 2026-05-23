import { prisma } from '@/lib/prisma';
import TopNav from '@/components/exam/TopNav';
import SplitScreen from '@/components/exam/SplitScreen';
import BottomNav from '@/components/exam/BottomNav';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { EXAM_DURATION_SECONDS } from '@/lib/examConfig';

export default async function DynamicExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

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

  if (!test.isFree) {
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId: session.user.id,
        isActive: true,
        expiresAt: { gt: new Date() },
      },
    });

    if (!subscription) {
      redirect('/dashboard/subscription');
    }
  }

  const questions = test.questions;
  const questionIds = questions.map((question) => question.id);

  return (
    <main className="flex flex-col h-screen bg-slate-50 overflow-hidden">
      <TopNav
        testId={id}
        questionIds={questionIds}
        initialTimeSeconds={EXAM_DURATION_SECONDS}
      />
      <SplitScreen questions={questions} />
      <BottomNav questionIds={questionIds} />
    </main>
  );
}
