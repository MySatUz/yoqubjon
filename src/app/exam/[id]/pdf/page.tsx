/* eslint-disable @next/next/no-img-element */
import 'katex/dist/katex.min.css';
import PrintPdfButton from '@/components/exam/PrintPdfButton';
import { requireAdminPage } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { renderMathText } from '@/lib/renderMathText';
import { buildExamModules } from '@/lib/examModules';
import { isMultiSelectKey } from '@/lib/resultAnswers';
import { ArrowLeft, FileText } from 'lucide-react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

type QuestionForPdf = {
  id: string;
  content: string;
  options: unknown;
  /** Read only to mark the question as multi-select; never printed. */
  correctAnswer: string;
  imageUrl: string | null;
  order: number;
  moduleIndex: number;
};

function readOptions(options: unknown) {
  return Array.isArray(options)
    ? options.filter((option): option is string => typeof option === 'string')
    : [];
}

function QuestionPdfCard({ question, number }: { question: QuestionForPdf; number: number }) {
  const options = readOptions(question.options);

  return (
    <section className="break-inside-avoid rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:rounded-none print:border-slate-300 print:p-4 print:shadow-none">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-sm font-semibold text-white print:h-8 print:w-8 print:rounded-lg">
          {number}
        </span>
        <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-blue-600">
          Question {number}
        </p>
      </div>

      <div className="prose prose-slate max-w-none">
        <div className="text-lg font-semibold leading-relaxed text-slate-900 print:text-[12pt]">
          {renderMathText(question.content)}
        </div>
      </div>

      {question.imageUrl && (
        <div className="my-5 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-3 print:rounded-lg">
          <img
            src={question.imageUrl}
            alt={`Question ${question.order} diagram`}
            className="mx-auto max-h-[360px] w-full object-contain print:max-h-[260px]"
          />
        </div>
      )}

      {options.length > 0 && isMultiSelectKey(question.correctAnswer) && (
        <p className="mt-6 text-[10px] font-medium uppercase tracking-[0.24em] text-blue-600">
          Select all that apply
        </p>
      )}

      {options.length > 0 ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 print:grid-cols-1">
          {options.map((option, index) => (
            <div
              key={`${question.id}-${index}`}
              className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 print:rounded-lg print:bg-white print:p-3"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 print:h-7 print:w-7 print:rounded-lg">
                {String.fromCharCode(65 + index)}
              </span>
              <div className="text-sm font-semibold leading-relaxed text-slate-800 print:text-[11pt]">
                {renderMathText(option)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 print:rounded-lg print:bg-white">
          Student-produced response
        </div>
      )}
    </section>
  );
}

export default async function ExamPdfPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireAdminPage();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const test = await prisma.test.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      isFree: true,
      durationSeconds: true,
      moduleDurations: true,
      questions: {
        orderBy: { order: 'asc' },
        select: {
          id: true,
          content: true,
          options: true,
          correctAnswer: true,
          imageUrl: true,
          order: true,
          moduleIndex: true,
        },
      },
    },
  });

  if (!test) {
    notFound();
  }

  const modules = buildExamModules(test, test.questions);
  const isModular = modules.length > 1;

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900 print:bg-white print:px-0 print:py-0">
      <style>{`
        @page {
          size: A4;
          margin: 14mm;
        }

        @media print {
          html, body {
            background: white !important;
          }

          .katex-display {
            margin: 0.7em 0;
          }
        }
      `}</style>

      <div className="mx-auto max-w-5xl print:max-w-none">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-blue-200 hover:text-blue-600"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to tests
          </Link>
          <PrintPdfButton />
        </div>

        <article className="overflow-hidden rounded-2xl bg-white shadow-sm print:overflow-visible print:rounded-none print:shadow-none">
          <header className="border-b border-slate-200 bg-slate-900 p-8 text-white print:border-slate-300 print:bg-white print:p-0 print:pb-6 print:text-slate-900">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.22em] text-blue-100 print:bg-white print:px-0 print:text-slate-500">
              <FileText className="h-4 w-4" />
              Printable practice module
            </div>
            <h1 className="text-4xl font-black tracking-tight print:text-2xl">{test.title}</h1>
            <p className="mt-3 text-sm font-semibold text-slate-300 print:text-slate-500">
              {test.questions.length} questions | Generated from MYSATuz
            </p>
          </header>

          <div className="space-y-5 p-6 print:space-y-4 print:p-0 print:pt-6">
            {modules.map((module) => (
              <div key={module.index} className="space-y-5 print:space-y-4">
                {isModular && (
                  <div className="break-inside-avoid rounded-2xl border border-slate-900 bg-slate-900 px-5 py-4 text-white print:rounded-none print:border-slate-300 print:bg-white print:text-slate-900">
                    <p className="text-sm font-medium uppercase tracking-[0.22em]">
                      Module {module.index}
                    </p>
                    <p className="mt-1 text-xs font-medium text-slate-300 print:text-slate-500">
                      {module.questions.length} questions | {Math.round(module.durationSeconds / 60)} minutes
                    </p>
                  </div>
                )}
                {module.questions.map((question, index) => (
                  <QuestionPdfCard key={question.id} question={question} number={index + 1} />
                ))}
              </div>
            ))}
          </div>
        </article>
      </div>
    </main>
  );
}
