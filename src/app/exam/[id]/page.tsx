import { prisma } from '@/lib/prisma';
import TopNav from '@/components/exam/TopNav';
import SplitScreen from '@/components/exam/SplitScreen';
import BottomNav from '@/components/exam/BottomNav';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';

export default async function DynamicExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const test = await prisma.test.findUnique({
    where: { id },
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

  const questions = await prisma.question.findMany({
    where: { testId: id },
    orderBy: { order: 'asc' },
  });

  return (
    <main className="flex flex-col h-screen bg-slate-50 overflow-hidden">
      <TopNav testId={id} />
      <SplitScreen questions={questions} />
      <BottomNav totalQuestions={questions.length} />
    </main>
  );
}
