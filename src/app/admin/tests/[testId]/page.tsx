import 'katex/dist/katex.min.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { BarChart3, ClipboardList, FileDown } from 'lucide-react';
import { QuestionList, TestSettingsCard, type EditorTest } from '@/components/admin/TestEditor';
import { courseTestsHref } from '@/components/admin/bank/links';
import { TestBadges, formatQuestionCount, formatTestLength, hasTestBadges } from '@/components/admin/testFacts';
import { renderQuestionPreview } from '@/app/admin/tests/questionPreview';
import { requireAdminPage } from '@/lib/admin';
import { buildExamModules } from '@/lib/examModules';
import { prisma } from '@/lib/prisma';
import { getShownQuestions } from '@/lib/questionSource';
import { getCategoryLabel, getTestCategory, getTestCollections } from '@/lib/testCatalog';
import { getCollectionVisibilityRows } from '@/lib/testCollections';
import { buttonClass } from '@/components/ui/Button';
import { Alert, EmptyState } from '@/components/ui/Feedback';
import { BackLink, Page, PageHeader, SectionHeading } from '@/components/ui/Page';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const EDITOR_QUESTION_FIELDS = {
  id: true,
  content: true,
  options: true,
  correctAnswer: true,
  explanation: true,
  imageUrl: true,
  videoUrl: true,
  order: true,
  // Groups the list by module, the way the exam runs it.
  moduleIndex: true,
  // A row copied from the question bank says so, with its tags.
  bankQuestion: { select: { id: true, domain: true, difficulty: true } },
} as const;

/** One read per request, shared by the tab title and the page. */
const readEditorTest = cache((testId: string) => prisma.test.findUnique({
  where: { id: testId },
  include: {
    questions: {
      orderBy: { order: 'asc' },
      select: EDITOR_QUESTION_FIELDS,
    },
    // A copy edits its original's questions: it has none of its own.
    questionSource: {
      select: {
        title: true,
        collectionCategory: true,
        questions: {
          orderBy: { order: 'asc' },
          select: EDITOR_QUESTION_FIELDS,
        },
        _count: { select: { questions: true } },
      },
    },
    _count: {
      select: { questions: true, questionCopies: true },
    },
  },
}));

export async function generateMetadata({
  params,
}: {
  params: Promise<{ testId: string }>;
}): Promise<Metadata> {
  const { testId } = await params;
  // Same gate as the page: a hidden test's title is not for a student's tab.
  await requireAdminPage();
  const test = await readEditorTest(testId);

  return { title: test?.title ?? 'Test' };
}

export default async function AdminTestEditorPage({
  params,
}: {
  params: Promise<{ testId: string }>;
}) {
  const { testId } = await params;
  // Kept here on purpose: access must not depend on the segment layout.
  await requireAdminPage();

  const [test, collectionRows] = await Promise.all([
    readEditorTest(testId),
    getCollectionVisibilityRows(),
  ]);

  if (!test) {
    notFound();
  }

  const collections = getTestCollections(collectionRows);
  const category = getTestCategory(test);
  const courseLabel = category ? getCategoryLabel(category, collections) : 'Unassigned';
  const courseMaxAttempts = collections.find((collection) => collection.value === category)?.maxAttempts;
  const questions = getShownQuestions(test).map(({ bankQuestion, ...question }) => ({
    ...question,
    previewHtml: renderQuestionPreview(question.content),
    bank: bankQuestion,
  }));
  const modules = buildExamModules(test, questions);
  const copies = test._count.questionCopies;

  // Only what the settings form reads crosses to the client, not the questions twice.
  const settings: EditorTest = {
    id: test.id,
    title: test.title,
    description: test.description,
    collectionCategory: test.collectionCategory,
    durationSeconds: test.durationSeconds,
    moduleDurations: test.moduleDurations,
    maxAttempts: test.maxAttempts,
    olympiadStartsAt: test.olympiadStartsAt,
    olympiadEndsAt: test.olympiadEndsAt,
    accessCode: test.accessCode,
    isFree: test.isFree,
    visible: test.visible,
  };

  return (
    <Page>
      <PageHeader
        // Back to the Tests tab of the course this test is in.
        back={
          category
            ? <BackLink href={courseTestsHref(category)}>Back to {courseLabel}</BackLink>
            : <BackLink href="/admin/courses">Back to courses</BackLink>
        }
        // A title pasted without spaces must still wrap on a phone.
        title={<span className="wrap-anywhere">{test.title}</span>}
        description={`${courseLabel} · ${formatQuestionCount(questions.length)} · ${formatTestLength(test)}`}
        meta={hasTestBadges(test, courseMaxAttempts)
          ? <TestBadges test={test} sectionMaxAttempts={courseMaxAttempts} onCanvas />
          : undefined}
        actions={
          <>
            <Link
              href={`/admin/tests/${test.id}/stats`}
              prefetch={false}
              className={buttonClass({ variant: 'secondary' })}
            >
              <BarChart3 className="h-4 w-4" />
              Stats
            </Link>
            <Link href={`/exam/${test.id}/pdf`} prefetch={false} className={buttonClass({ variant: 'secondary' })}>
              <FileDown className="h-4 w-4" />
              PDF
            </Link>
          </>
        }
      />

      <TestSettingsCard test={settings} collections={collections} />

      <section className="space-y-3">
        <SectionHeading
          title="Questions"
          description={questions.some((question) => question.bank)
            ? 'Open a question to edit it. Each one is saved on its own; a question from the bank is saved there too.'
            : 'Open a question to edit it. Each one is saved on its own.'}
        />

        {test.questionSource ? (
          <Alert
            action={
              test.questionSourceId && (
                // A button, as on the admin home's alerts.
                <Link
                  href={`/admin/tests/${test.questionSourceId}`}
                  prefetch={false}
                  className={buttonClass({ variant: 'secondary', size: 'sm' })}
                >
                  Open the original
                </Link>
              )
            }
          >
            This copy shows the questions of &ldquo;{test.questionSource.title}&rdquo;
            {' '}({getCategoryLabel(test.questionSource.collectionCategory, collections)}).
            Editing a question changes it there and in every other copy.
          </Alert>
        ) : copies > 0 ? (
          <Alert>
            {/* A copy can sit in this same course, so not "in other courses". */}
            {copies === 1 ? 'One copy shows' : `${copies} copies show`} these questions.
            Editing a question here changes it there too.
          </Alert>
        ) : null}

        {questions.length === 0 ? (
          <EmptyState icon={<ClipboardList />} title="This test has no questions" />
        ) : modules.length > 1 ? (
          // Numbered by the test's order, which is what the importer and the
          // stats page use; each module is its own card.
          modules.map((module) => (
            <div key={module.index} className="space-y-2">
              <h3 className="text-sm font-medium text-gray-700">
                Module {module.index}
                <span className="font-normal text-gray-600"> · {formatQuestionCount(module.questions.length)}</span>
              </h3>
              <QuestionList questions={module.questions} />
            </div>
          ))
        ) : (
          <QuestionList questions={questions} />
        )}
      </section>
    </Page>
  );
}
