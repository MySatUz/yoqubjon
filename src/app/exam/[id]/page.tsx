import { prisma } from '@/lib/prisma';
import TopNav from '@/components/exam/TopNav';
import SplitScreen from '@/components/exam/SplitScreen';
import BottomNav from '@/components/exam/BottomNav';
import { notFound } from 'next/navigation';

export default async function DynamicExamPage({ params }: { params: { id: string } }) {
  const { id } = await params;

  const test = await prisma.test.findUnique({
    where: { id },
  });

  if (!test) {
    notFound();
  }

  const questions = await prisma.question.findMany({
    where: { testId: id },
    orderBy: { order: 'asc' },
  });

  return (
    <main className="flex flex-col h-screen bg-slate-50 overflow-hidden">
      <TopNav testId={id} totalQuestions={questions.length} />
      <SplitScreen questions={questions} />
      <BottomNav totalQuestions={questions.length} />
    </main>
  );
}
