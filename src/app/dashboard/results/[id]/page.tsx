import { prisma } from '@/lib/prisma';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, XCircle, Clock, Award, ArrowLeft } from 'lucide-react';
import 'katex/dist/katex.min.css';
import { auth } from '@/auth';
import { normalizeStoredAnswer } from '@/lib/resultAnswers';
import Image from 'next/image';
import { renderMathText } from '@/lib/renderMathText';
import { buildExamModules } from '@/lib/examModules';

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }
  
  // `select`, not `include`: the review only needs five columns per question.
  // `moduleIndex` (question) and `durationSeconds`/`moduleDurations` (test) are
  // load-bearing — buildExamModules collapses every module into one without them.
  const result = await prisma.result.findFirst({
    where: {
      id,
      userId: session.user.id,
    },
    select: {
      score: true,
      timeSpent: true,
      createdAt: true,
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
              content: true,
              imageUrl: true,
              correctAnswer: true,
              moduleIndex: true,
            },
          },
        },
      },
    },
  });

  if (!result) notFound();

  const userAnswers = result.answers as Record<string, unknown>;
  const modules = buildExamModules(result.test, result.test.questions);
  const isModular = modules.length > 1;

  const moduleReviews = modules.map((module) => ({
    index: module.index,
    durationSeconds: module.durationSeconds,
    answers: module.questions.map(q => {
      const answer = normalizeStoredAnswer(userAnswers[q.id], q.correctAnswer);

      return {
        id: q.id,
        content: q.content,
        imageUrl: q.imageUrl,
        ...answer,
      };
    }),
  }));

  const detailedAnswers = moduleReviews.flatMap((module) => module.answers);
  const correctCount = detailedAnswers.filter(a => a.isCorrect).length;
  const totalCount = detailedAnswers.length;
  const accuracy = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
  
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      {/* Header section with score */}
      <div className="bg-slate-900 text-white pt-12 pb-24">
        <div className="max-w-5xl mx-auto px-4">
          <Link href="/dashboard" className="inline-flex items-center text-slate-400 hover:text-white mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Link>
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
            <div>
              <h1 className="text-4xl font-black tracking-tight mb-2">{result.test.title} Analysis</h1>
              <p className="text-slate-400 text-lg">Completed on {new Date(result.createdAt).toLocaleDateString()}</p>
            </div>
            
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 flex items-center gap-6">
              <div className="text-center">
                <span className="block text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Estimated Score</span>
                <span className="text-5xl font-black text-blue-400">{result.score}</span>
              </div>
              <div className="w-px h-12 bg-white/10"></div>
              <div className="text-center">
                <span className="block text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Accuracy</span>
                <span className="text-3xl font-bold">{accuracy}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="max-w-5xl mx-auto px-4 -mt-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-green-50 rounded-lg">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-500 uppercase">Correct</h3>
                <p className="text-2xl font-black text-slate-900">{correctCount} <span className="text-slate-300 font-medium">/ {totalCount}</span></p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-red-50 rounded-lg">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-500 uppercase">Incorrect</h3>
                <p className="text-2xl font-black text-slate-900">{totalCount - correctCount}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <Clock className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-500 uppercase">Time Spent</h3>
                <p className="text-2xl font-black text-slate-900">{formatTime(result.timeSpent)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Review */}
        <div className="mt-12 space-y-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
            <Award className="w-6 h-6 text-blue-600" />
            Detailed Review
          </h2>
          
          {moduleReviews.map((module) => (
          <div key={module.index} className="space-y-4">
            {isModular && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
                <span className="text-sm font-black uppercase tracking-widest text-slate-900">
                  Module {module.index}
                </span>
                <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                  {module.answers.filter((answer) => answer.isCorrect).length} / {module.answers.length} correct
                  {' | '}
                  {Math.round(module.durationSeconds / 60)} min
                </span>
              </div>
            )}
            {module.answers.map((data, index) => (
              <div key={data.id} className={`p-6 rounded-xl border bg-white shadow-sm transition-all hover:shadow-md ${
                data.isCorrect ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-red-500'
              }`}>
                <div className="flex items-start justify-between mb-6">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Question {index + 1}</span>
                  {data.isCorrect ? (
                    <span className="flex items-center text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Correct
                    </span>
                  ) : (
                    <span className="flex items-center text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded">
                      <XCircle className="w-3 h-3 mr-1" /> Incorrect
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-6">
                  <div className="space-y-4">
                    <div className="text-sm font-medium text-slate-700 leading-relaxed">
                      {renderMathText(data.content)}
                    </div>
                    {data.imageUrl && (
                      <div className="mt-4 p-2 bg-slate-50 rounded-xl border border-slate-100 inline-block">
                        {/* Rendered box is capped at max-h-48 (~192 px tall), so
                            without `sizes` the browser would fetch the 828/1920 w
                            variants for every question on the page. */}
                        <Image
                          src={data.imageUrl}
                          alt="Question"
                          width={800}
                          height={480}
                          sizes="(min-width: 640px) 320px, 60vw"
                          className="max-h-48 w-auto rounded-lg"
                        />
                      </div>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 border-t border-slate-50 pt-6">
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-slate-500 uppercase">Your Answer</p>
                      <p className={`text-lg font-bold ${data.isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                        {renderMathText(data.userAnswer) || 'Not answered'}
                      </p>
                    </div>
                    {!data.isCorrect && (
                      <div className="space-y-2">
                        <p className="text-xs font-bold text-slate-500 uppercase">Correct Answer</p>
                        <p className="text-lg font-bold text-slate-900">{renderMathText(data.correctAnswer)}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          ))}
        </div>
      </div>
    </div>
  );
}
