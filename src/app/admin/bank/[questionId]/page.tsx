/* eslint-disable @next/next/no-img-element -- the Image URL field takes any
   address, and next/image refuses hosts outside next.config's list, which
   would crash the page instead of showing the picture. As on the PDF page. */
import 'katex/dist/katex.min.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { CheckCircle2, ChevronRight, ClipboardList } from 'lucide-react';
import { requireAdminPage } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { formatDate } from '@/lib/formatDate';
import { renderMathHtml } from '@/lib/renderMathHtml';
import { isMultiSelectKey, parseAnswerLetters } from '@/lib/resultAnswers';
import { getCategoryLabel, getTestCategory, getTestCollections } from '@/lib/testCatalog';
import { getCollectionVisibilityRows } from '@/lib/testCollections';
import {
  getDifficultyLabel,
  getDomainLabel,
  isBankDifficulty,
  isBankDomain,
} from '@/lib/questionBank';
import { readOptions } from '@/lib/questionBankServer';
import { optionAsMath } from '@/components/exam/optionMath';
import { BankQuestionEditor, DeleteBankQuestionButton } from '@/components/admin/bank/BankQuestionEditor';
import { BankTagBadges } from '@/components/admin/bank/bankBadges';
import { CardBody, CardHeader, cardClass } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/Feedback';
import { List, listRowInteractiveClass, rowChevronClass, RowText } from '@/components/ui/List';
import { BackLink, Page, PageHeader, SectionHeading } from '@/components/ui/Page';
import { cn } from '@/components/ui/cn';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const QUESTION_ID_PATTERN = /^[0-9a-f-]{36}$/i;

const testSelect = { id: true, title: true, collectionCategory: true, description: true } as const;

/** One read per request, shared by the tab title and the page. */
const readBankQuestion = cache((questionId: string) => (
  QUESTION_ID_PATTERN.test(questionId)
    ? prisma.bankQuestion.findUnique({
        where: { id: questionId },
        select: {
          id: true,
          content: true,
          options: true,
          correctAnswer: true,
          imageUrl: true,
          domain: true,
          difficulty: true,
          source: true,
          createdAt: true,
          questions: {
            orderBy: { createdAt: 'asc' },
            select: {
              order: true,
              moduleIndex: true,
              test: {
                select: {
                  ...testSelect,
                  moduleDurations: true,
                  // A copy shows its original's rows, so it uses this question too.
                  questionCopies: { select: testSelect, orderBy: { createdAt: 'asc' } },
                },
              },
            },
          },
        },
      })
    : Promise.resolve(null)
));

export async function generateMetadata({
  params,
}: {
  params: Promise<{ questionId: string }>;
}): Promise<Metadata> {
  const { questionId } = await params;
  await requireAdminPage();
  const question = await readBankQuestion(questionId);

  return { title: question ? `Bank question · ${getDomainLabel(question.domain)}` : 'Bank question' };
}

/**
 * One bank question: how it reads, with the answer marked; where it came
 * from; which tests show it; and its editor. A save writes through to those
 * tests; a delete leaves them their copies.
 */
export default async function BankQuestionPage({
  params,
}: {
  params: Promise<{ questionId: string }>;
}) {
  const { questionId } = await params;
  // Kept here on purpose: access must not depend on the segment layout.
  await requireAdminPage();

  const [question, collectionRows] = await Promise.all([
    readBankQuestion(questionId),
    getCollectionVisibilityRows(),
  ]);

  if (!question) {
    notFound();
  }

  const collections = getTestCollections(collectionRows);
  const options = readOptions(question.options);
  const correctLetters = new Set(options.length > 0 ? parseAnswerLetters(question.correctAnswer) ?? [] : []);
  const isMultiSelect = isMultiSelectKey(question.correctAnswer);
  const courseOf = (test: { title: string; collectionCategory: string | null; description: string | null }) =>
    getCategoryLabel(getTestCategory(test), collections);

  // Each test once, with its copies after it: the rows a test holds, and
  // the copies that show them.
  const usedIn = question.questions.flatMap((row) => [
    {
      id: row.test.id,
      title: row.test.title,
      meta: [
        courseOf(row.test),
        `Question ${row.order}`,
        row.test.moduleDurations.length > 1 ? `module ${row.moduleIndex}` : null,
      ].filter(Boolean).join(' · '),
    },
    ...row.test.questionCopies.map((copy) => ({
      id: copy.id,
      title: copy.title,
      meta: `${courseOf(copy)} · copy of ${row.test.title}`,
    })),
  ]).filter((test, index, all) => all.findIndex((other) => other.id === test.id) === index);

  const facts = [
    isBankDomain(question.domain) ? getDomainLabel(question.domain) : null,
    isBankDifficulty(question.difficulty) ? getDifficultyLabel(question.difficulty) : null,
    question.source ? `from ${question.source}` : null,
    `added ${formatDate(question.createdAt)}`,
  ].filter(Boolean).join(' · ');

  return (
    <Page>
      <PageHeader
        back={<BackLink href="/admin/bank">Back to question bank</BackLink>}
        title="Bank question"
        description={facts}
        meta={(!isBankDomain(question.domain) || !isBankDifficulty(question.difficulty)) && (
          <BankTagBadges domain={question.domain} difficulty={question.difficulty} onCanvas />
        )}
        actions={<DeleteBankQuestionButton questionId={question.id} usedIn={usedIn.length} />}
      />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <section className={cardClass} aria-label="Question">
            <CardHeader
              title="Question"
              description={options.length === 0
                ? 'Grid-in: the student types the answer.'
                : isMultiSelect ? 'Multi-select: every correct option has to be chosen.' : undefined}
            />
            <CardBody className="space-y-4">
              {question.imageUrl && (
                <div className="overflow-hidden rounded-xl border border-gray-200 p-3">
                  <img
                    src={question.imageUrl}
                    alt="Question diagram"
                    className="mx-auto max-h-80 w-full object-contain"
                  />
                </div>
              )}

              <div
                className="text-base leading-relaxed text-gray-900"
                dangerouslySetInnerHTML={{ __html: renderMathHtml(question.content) }}
              />

              {options.length > 0 ? (
                <ul className="space-y-2">
                  {options.map((option, index) => {
                    const letter = String.fromCharCode(65 + index);
                    const correct = correctLetters.has(letter);

                    return (
                      <li
                        key={`${letter}-${option}`}
                        className={cn(
                          'flex items-start gap-3 rounded-xl border px-3 py-2.5',
                          correct ? 'border-green-700 bg-green-50' : 'border-gray-200',
                        )}
                      >
                        <span
                          className={cn(
                            'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-xs font-semibold',
                            correct ? 'border-green-700 bg-green-700 text-white' : 'border-gray-300 text-gray-700',
                          )}
                        >
                          {letter}
                        </span>
                        <div
                          className="min-w-0 flex-1 text-sm leading-relaxed text-gray-800"
                          dangerouslySetInnerHTML={{ __html: renderMathHtml(optionAsMath(option)) }}
                        />
                        {/* Said in a word too, not by the green alone. */}
                        {correct && (
                          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-green-800">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Correct
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="flex flex-wrap items-center gap-2 rounded-xl border border-green-700 bg-green-50 px-3 py-2.5 text-sm text-green-900">
                  <CheckCircle2 className="h-4 w-4 text-green-700" />
                  Correct answer
                  <span
                    className="font-medium"
                    dangerouslySetInnerHTML={{ __html: renderMathHtml(optionAsMath(question.correctAnswer)) }}
                  />
                </p>
              )}
            </CardBody>
          </section>

          <BankQuestionEditor
            question={{
              id: question.id,
              content: question.content,
              options,
              correctAnswer: question.correctAnswer,
              imageUrl: question.imageUrl,
              domain: isBankDomain(question.domain) ? question.domain : null,
              difficulty: isBankDifficulty(question.difficulty) ? question.difficulty : null,
            }}
            usedIn={usedIn.length}
          />
        </div>

        <section className="space-y-3 lg:col-span-2">
          <SectionHeading
            title="Used in"
            description={usedIn.length > 0
              ? `${usedIn.length} ${usedIn.length === 1 ? 'test shows' : 'tests show'} a copy of this question.`
              : undefined}
          />
          {usedIn.length === 0 ? (
            <EmptyState icon={<ClipboardList />} title="Not used in a test yet" />
          ) : (
            <List>
              {usedIn.map((test) => (
                <li key={test.id}>
                  <Link
                    href={`/admin/tests/${test.id}`}
                    prefetch={false}
                    className={cn(listRowInteractiveClass, 'group')}
                  >
                    <RowText title={test.title} meta={test.meta} />
                    <ChevronRight className={rowChevronClass} />
                  </Link>
                </li>
              ))}
            </List>
          )}
        </section>
      </div>
    </Page>
  );
}
