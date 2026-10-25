/* eslint-disable @next/next/no-img-element */
import 'katex/dist/katex.min.css';
import PrintPdfButton from '@/components/exam/PrintPdfButton';
import { optionAsMath } from '@/components/exam/optionMath';
import { requireAdminPage } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { renderMathText } from '@/lib/renderMathText';
import { buildExamModules } from '@/lib/examModules';
import { formatDuration } from '@/lib/olympiad';
import { getShownQuestions } from '@/lib/questionSource';
import { isMultiSelectKey } from '@/lib/resultAnswers';
import { BackLink } from '@/components/ui/Page';
import { cardClass } from '@/components/ui/Card';
import { cn } from '@/components/ui/cn';
import { notFound, redirect } from 'next/navigation';

const PDF_QUESTION_FIELDS = {
  id: true,
  content: true,
  options: true,
  correctAnswer: true,
  imageUrl: true,
  order: true,
  moduleIndex: true,
} as const;

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

/**
 * One question as a section of the sheet, divided from the next by a hairline
 * - not a card of its own inside the sheet's card.
 */
function QuestionPdfCard({ question, number }: { question: QuestionForPdf; number: number }) {
  const options = readOptions(question.options);

  return (
    <section className="break-inside-avoid p-5 print:px-0 print:py-4">
      <h3 className="mb-3 text-sm font-semibold tabular-nums text-mist-900">
        Question {number}
      </h3>

      {/* Diagram first, stem second - the same order the exam screen uses. */}
      {question.imageUrl && (
        <div className="mb-4 overflow-hidden rounded-xl border border-mist-200 p-3 print:rounded-lg">
          <img
            src={question.imageUrl}
            alt={`Question ${question.order} diagram`}
            className="mx-auto max-h-[360px] w-full object-contain print:max-h-[260px]"
          />
        </div>
      )}

      <div className="text-base leading-relaxed text-mist-900 print:text-[12pt]">
        {renderMathText(question.content)}
      </div>

      {options.length > 0 && isMultiSelectKey(question.correctAnswer) && (
        <p className="mt-4 text-sm font-medium text-mist-700">
          Select all that apply
        </p>
      )}

      {options.length > 0 ? (
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 print:grid-cols-1">
          {options.map((option, index) => (
            <div
              key={`${question.id}-${index}`}
              className="flex gap-3 rounded-xl border border-mist-200 px-3 py-2.5 print:rounded-lg print:py-2"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-mist-300 text-xs font-semibold text-mist-700">
                {String.fromCharCode(65 + index)}
              </span>
              <div className="min-w-0 text-sm leading-relaxed text-mist-800 print:text-[11pt]">
                {renderMathText(optionAsMath(option))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-mist-300 px-4 py-3 text-sm text-mist-500 print:rounded-lg">
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
        select: PDF_QUESTION_FIELDS,
      },
      // A copy prints its original's questions; it has none of its own.
      questionSource: {
        select: {
          questions: {
            orderBy: { order: 'asc' },
            select: PDF_QUESTION_FIELDS,
          },
        },
      },
    },
  });

  if (!test) {
    notFound();
  }

  const questions = getShownQuestions(test);
  const modules = buildExamModules(test, questions);
  const isModular = modules.length > 1;

  // Outside the app shell, so the page paints the shell's canvas itself.
  return (
    <main className="min-h-screen bg-mist-100 px-4 py-6 text-mist-900 sm:px-6 lg:py-8 print:bg-white print:px-0 print:py-0">
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

      <div className="mx-auto max-w-4xl space-y-6 print:max-w-none print:space-y-0">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <BackLink href="/dashboard">Back to tests</BackLink>
          <PrintPdfButton />
        </div>

        <article className={cn(cardClass, 'overflow-hidden print:overflow-visible print:rounded-none print:border-0')}>
          <header className="border-b border-mist-200 p-5 print:border-mist-300 print:px-0 print:pb-6 print:pt-0">
            <h1 className="text-xl font-semibold tracking-tight text-mist-900 sm:text-2xl">{test.title}</h1>
            <p className="mt-1 text-sm text-mist-500 tabular-nums">
              {/* "Module" only where the test has modules: a one-block test is one set of questions. */}
              Printable test · {isModular ? `${modules.length} modules · ` : ''}
              {questions.length} {questions.length === 1 ? 'question' : 'questions'} · Generated from MYSATuz
            </p>
          </header>

          {modules.map((module) => (
            <div key={module.index} className="border-b border-mist-200 last:border-b-0 print:border-mist-300">
              {isModular && (
                <div className="break-inside-avoid border-b border-mist-200 bg-mist-50 px-5 py-3 print:border-mist-300 print:bg-white print:px-0 print:pt-6">
                  <h2 className="text-sm font-semibold text-mist-900">
                    Module {module.index}
                  </h2>
                  <p className="mt-0.5 text-xs text-mist-500 tabular-nums">
                    {module.questions.length} {module.questions.length === 1 ? 'question' : 'questions'} · {formatDuration(module.durationSeconds)}
                  </p>
                </div>
              )}
              <div className="divide-y divide-mist-100 print:divide-mist-300">
                {module.questions.map((question, index) => (
                  <QuestionPdfCard key={question.id} question={question} number={index + 1} />
                ))}
              </div>
            </div>
          ))}
        </article>
      </div>
    </main>
  );
}
