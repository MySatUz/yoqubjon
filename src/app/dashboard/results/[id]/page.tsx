import { prisma } from '@/lib/prisma';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, XCircle, Clock, Award, ArrowLeft, ShieldCheck } from 'lucide-react';
import { auth } from '@/auth';
import { formatCreditTotal, normalizeStoredAnswer } from '@/lib/resultAnswers';
import { buildExamModules } from '@/lib/examModules';
import ResultReview, {
  type ReviewModule,
  type ReviewStatus,
} from '@/components/dashboard/ResultReview';

const sumCredit = (answers: Array<{ credit: number }>) =>
  answers.reduce((total, answer) => total + answer.credit, 0);

function toStatus(isCorrect: boolean, credit: number): ReviewStatus {
  if (isCorrect) return 'correct';
  // Only a multi-select question can land here: it earned part of the mark, so
  // it is neither fully right nor fully wrong.
  return credit > 0 ? 'partial' : 'incorrect';
}

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  // Question `content` and `imageUrl` are deliberately NOT selected. This page
  // renders no question text at all: the review below opens one question at a
  // time through `revealResultQuestion`, so the HTML a student receives never
  // contains a printable copy of the test.
  //
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
              order: true,
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

  // Grading happens here, on the server, and only the verdict crosses to the
  // client — never the answer key it was graded against.
  const moduleReviews = modules.map((module) => ({
    index: module.index,
    durationSeconds: module.durationSeconds,
    // Numbered inside the module, the way the exam screen numbers them.
    answers: module.questions.map((q, index) => {
      const answer = normalizeStoredAnswer(
        userAnswers[q.id] ?? userAnswers[(q.order - 1).toString()],
        q.correctAnswer
      );

      return {
        id: q.id,
        number: index + 1,
        moduleIndex: module.index,
        status: toStatus(answer.isCorrect, answer.credit),
        credit: answer.credit,
      };
    }),
  }));

  const reviewModules: ReviewModule[] = moduleReviews.map((module) => ({
    index: module.index,
    questions: module.answers,
  }));

  const detailedAnswers = moduleReviews.flatMap((module) => module.answers);
  const totalCount = detailedAnswers.length;
  // Credit, not a count of right answers: a multi-select question can be partly
  // right, and the two tiles below have to keep adding up to the total.
  const earnedCredit = sumCredit(detailedAnswers);
  const accuracy = totalCount > 0 ? Math.round((earnedCredit / totalCount) * 100) : 0;

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

            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 flex items-center gap-6">
              <div className="text-center">
                <span className="block text-slate-400 text-xs font-medium uppercase tracking-widest mb-1">Estimated Score</span>
                <span className="text-5xl font-black text-blue-400 tabular-nums">{result.score}</span>
              </div>
              <div className="w-px h-12 bg-slate-700"></div>
              <div className="text-center">
                <span className="block text-slate-400 text-xs font-medium uppercase tracking-widest mb-1">Accuracy</span>
                <span className="text-3xl font-semibold tabular-nums">{accuracy}%</span>
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
              <div className="p-3 bg-emerald-50 rounded-lg">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-slate-500 uppercase">Correct</h3>
                <p className="text-2xl font-semibold text-slate-900 tabular-nums">{formatCreditTotal(earnedCredit)} <span className="text-slate-300 font-medium">/ {totalCount}</span></p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-red-50 rounded-lg">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-slate-500 uppercase">Incorrect</h3>
                <p className="text-2xl font-semibold text-slate-900 tabular-nums">{formatCreditTotal(totalCount - earnedCredit)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <Clock className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-slate-500 uppercase">Time Spent</h3>
                <p className="text-2xl font-semibold text-slate-900">{formatTime(result.timeSpent)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Review */}
        <div className="mt-12 space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
              <Award className="w-6 h-6 text-blue-600" />
              Detailed Review
            </h2>
            <p className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-medium text-slate-500 border border-slate-200">
              <ShieldCheck className="h-4 w-4 text-slate-400" />
              Questions open one at a time
            </p>
          </div>

          {isModular && (
            <p className="text-xs font-medium text-slate-400">
              {modules.length} modules, {totalCount} questions in total.
            </p>
          )}

          <ResultReview resultId={id} modules={reviewModules} />

          {/* The only thing a printed copy of this page says about the
              questions. The review itself is never in the print output because
              it is never fully in the page to begin with. */}
          <p className="hidden print:block text-sm font-medium text-slate-500">
            The question-by-question review is only available on screen.
          </p>
        </div>
      </div>
    </div>
  );
}
