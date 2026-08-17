import { prisma } from '@/lib/prisma';
import { Suspense } from 'react';
import VideoClient from '@/components/exam/VideoClient';
import { auth } from '@/auth';
import { notFound, redirect } from 'next/navigation';
import { normalizeStoredAnswer } from '@/lib/resultAnswers';
import { buildExamModules } from '@/lib/examModules';

export default async function ReviewPage({ params }: { params: Promise<{ resultId: string }> }) {
  const { resultId } = await params;
  const session = await auth();
  
  if (!session?.user?.id) {
    redirect('/login');
  }

  const result = await prisma.result.findFirst({
    where: {
      id: resultId,
      userId: session.user.id,
    },
    // Explicit `select`: the old `include` pulled `content`, `options`,
    // `explanation` and `imageUrl` for every question (kilobytes of TeX each)
    // even though this page only renders answers and the video link.
    // `moduleIndex` on questions and `durationSeconds`/`moduleDurations` on the
    // test are required by `buildExamModules` — dropping them collapses modules.
    select: {
      id: true,
      score: true,
      answers: true,
      test: {
        select: {
          title: true,
          durationSeconds: true,
          moduleDurations: true,
          questions: {
            orderBy: { order: 'asc' },
            select: {
              id: true,
              order: true,
              correctAnswer: true,
              videoUrl: true,
              moduleIndex: true,
            },
          },
        },
      },
    },
  });

  if (!result) {
    notFound();
  }

  const storedAnswers = result.answers as Record<string, unknown>;
  const modules = buildExamModules(result.test, result.test.questions);
  const isModular = modules.length > 1;

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Score Header */}
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">Test Review</h1>
          <p className="text-slate-500 font-medium mb-8">{result.test.title}</p>
          
          <div className="flex justify-center items-end gap-2">
            <span className="text-6xl font-black text-blue-600 tracking-tighter">{result.score}</span>
            <span className="text-xl font-bold text-slate-400 mb-2">/ 800</span>
          </div>
        </div>

        {/* Question Review List */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-slate-900">Question Breakdown</h2>
          
          {modules.map((module) => (
          <div key={module.index} className="grid gap-4">
            {isModular && (
              <h3 className="mt-2 text-sm font-black uppercase tracking-widest text-slate-500">
                Module {module.index}
              </h3>
            )}
            {module.questions.map((q, i) => {
              const { userAnswer, correctAnswer, isCorrect } = normalizeStoredAnswer(
                storedAnswers[q.id] ?? storedAnswers[(q.order - 1).toString()],
                q.correctAnswer
              );

              return (
                <div key={q.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className={`p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${q.videoUrl ? 'border-b border-slate-100' : ''}`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0 ${
                        isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {i + 1}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">Your Answer: <span className="font-bold">{userAnswer || 'Omitted'}</span></p>
                        {!isCorrect && (
                          <p className="text-sm text-slate-500 mt-1">Correct Answer: {correctAnswer}</p>
                        )}
                      </div>
                    </div>
                    
                    {/* Video Explanation Trigger */}
                    {q.videoUrl && (
                      <Suspense fallback={<div className="h-10 w-32 bg-slate-100 animate-pulse rounded"></div>}>
                        <VideoClient url={q.videoUrl} />
                      </Suspense>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          ))}
        </div>

      </div>
    </div>
  );
}
