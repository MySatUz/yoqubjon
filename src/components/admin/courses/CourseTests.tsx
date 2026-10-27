'use client';

import React, { useCallback, useId, useOptimistic, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { ArrowUpRight, ChevronRight, Copy, FileUp, Library, Loader2, Trash2 } from 'lucide-react';
import AdminForm from '@/components/admin/AdminForm';
import { copyTest, deleteTest, updateTestVisibility } from '@/app/admin/actions';
import { TestBadges, formatQuestionCount, formatTestLength, hasTestBadges } from '@/components/admin/testFacts';
import { formatOlympiadMoment, readOlympiadWindow } from '@/lib/olympiad';
import { formatDate } from '@/lib/formatDate';
import type { TestCollectionOption } from '@/lib/testCatalog';
import { Button, IconButton, buttonClass, linkClass } from '@/components/ui/Button';
import { Dialog, useConfirm, type ConfirmOptions } from '@/components/ui/Dialog';
import { Alert, EmptyState } from '@/components/ui/Feedback';
import { Field, Input, Select, checkboxClass, hintClass } from '@/components/ui/Field';
import { List, rowChevronClass } from '@/components/ui/List';
import { segmentClass, segmentedClass } from '@/components/ui/Misc';
import { cn } from '@/components/ui/cn';

export type CourseTestRow = {
  id: string;
  title: string;
  collectionCategory: string | null;
  createdAt: Date;
  durationSeconds: number;
  moduleDurations: number[];
  maxAttempts: number;
  olympiadStartsAt: Date | null;
  olympiadEndsAt: Date | null;
  accessCode: string | null;
  isFree: boolean;
  visible: boolean;
  questionSourceId: string | null;
  questionSource: { title: string; collectionCategory: string | null } | null;
  /** The oldest copy, which takes the questions over if this original is deleted. */
  questionCopies: { title: string }[];
  _count: { questionCopies: number };
  /** Questions it shows: its own, or its original's for a copy. */
  questionCount: number;
  /** "18 of 24 have a result". */
  reach: string;
};

type CourseInfo = { value: string; label: string; maxAttempts: number };

/** Says what a delete takes with it, because a copy and an original differ, and names the test. */
function describeDelete(test: CourseTestRow): ConfirmOptions {
  if (test.questionSource) {
    return {
      title: `Delete the copy “${test.title}”?`,
      description: `Its results are deleted with it; the questions stay with “${test.questionSource.title}”. This cannot be undone.`,
      confirmLabel: 'Delete copy',
      tone: 'danger',
    };
  }

  const copies = test._count.questionCopies;
  const heir = test.questionCopies[0]?.title;
  const others = copies - 1;
  return {
    title: `Delete “${test.title}”?`,
    description: heir
      ? `Its results are deleted. Its questions and images move to the copy “${heir}”`
        + (others > 0 ? `, and the other ${others === 1 ? 'copy shows' : `${others} copies show`} them from there` : '')
        + '. Every copy keeps its results. This cannot be undone.'
      : 'Its questions, images and results are deleted. This cannot be undone.',
    confirmLabel: 'Delete test',
    tone: 'danger',
  };
}

type CopyResult = Awaited<ReturnType<typeof copyTest>>;

/**
 * Puts the test into a course under a new title. The copy has its own
 * title, course, settings and results, and shows this test's questions
 * instead of storing them again.
 */
function CopyTestDialog({
  test,
  course,
  collections,
  onClose,
}: {
  test: CourseTestRow;
  course: CourseInfo;
  collections: TestCollectionOption[];
  onClose: () => void;
}) {
  const fieldId = useId();
  const [isCopying, setIsCopying] = useState(false);
  const [result, setResult] = useState<CopyResult | null>(null);
  const olympiadWindow = readOlympiadWindow(test);
  // Another course is the usual reason to copy, so one is preselected.
  const defaultCategory = collections.find((option) => option.value !== course.value)?.value ?? course.value;
  const formId = `${fieldId}-form`;

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsCopying(true);
    setResult(null);
    try {
      // `copyTest` calls `refresh()`, so a copy into this course arrives in the list with this answer.
      setResult(await copyTest(test.id, new FormData(event.currentTarget)));
    } catch {
      setResult({ success: false, error: 'No connection. The test was not copied.' });
    }
    setIsCopying(false);
  };

  return (
    <Dialog
      open
      title={`Copy “${test.title}”`}
      busy={isCopying}
      onClose={onClose}
      footer={result?.success ? (
        <>
          <Link href={`/admin/tests/${result.testId}`} prefetch={false} className={buttonClass({ variant: 'secondary' })}>
            Open the copy
            <ArrowUpRight className="h-4 w-4" />
          </Link>
          <Button onClick={onClose}>Done</Button>
        </>
      ) : (
        <>
          <Button variant="secondary" onClick={onClose} disabled={isCopying}>Cancel</Button>
          <Button type="submit" form={formId} disabled={isCopying}>
            {isCopying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
            Copy test
          </Button>
        </>
      )}
    >
      <form id={formId} onSubmit={submit} className="space-y-4">
        <Field label="To course" htmlFor={`${fieldId}-course`}>
          <Select id={`${fieldId}-course`} name="testCategory" required defaultValue={defaultCategory} disabled={isCopying || result?.success}>
            {collections.map((option) => (
              <option key={option.value} value={option.value}>
                {option.value === course.value ? `${option.label} (this course)` : option.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="New title" htmlFor={`${fieldId}-title`}>
          <Input id={`${fieldId}-title`} name="title" required defaultValue={test.title} disabled={isCopying || result?.success} data-autofocus />
        </Field>

        {olympiadWindow && (
          <label className="flex items-start gap-2.5 text-sm text-gray-700">
            <input name="keepOlympiadWindow" type="checkbox" value="true" defaultChecked className={cn(checkboxClass, 'mt-0.5')} />
            <span>
              <span className="font-medium text-gray-900">Keep the olympiad window</span>
              {' '}&mdash; {formatOlympiadMoment(olympiadWindow.startsAt)} to {formatOlympiadMoment(olympiadWindow.endsAt)}, Tashkent time.
              <span className={cn(hintClass, 'block')}>Without it the copy is an ordinary test.</span>
            </span>
          </label>
        )}
        {test.accessCode && (
          <label className="flex items-start gap-2.5 text-sm text-gray-700">
            <input name="keepAccessCode" type="checkbox" value="true" defaultChecked className={cn(checkboxClass, 'mt-0.5')} />
            <span>
              <span className="font-medium text-gray-900">Keep the test code</span>
              {' '}<span className="tabular-nums">{test.accessCode}</span>.
              <span className={cn(hintClass, 'block')}>Without it the copy opens with no code.</span>
            </span>
          </label>
        )}

        <p className={hintClass}>
          The copy shows this test&apos;s questions and images without storing them again: editing a question
          changes it in both. It keeps its own results, and keeps working if the original is deleted.
        </p>

        {result?.success && (
          <Alert tone="success">
            Copied to {collections.find((option) => option.value === result.category)?.label ?? 'the course'} as &ldquo;{result.title}&rdquo;.
          </Alert>
        )}
        {result && !result.success && <Alert tone="danger">Not copied: {result.error}</Alert>}
      </form>
    </Dialog>
  );
}

/**
 * The course's tests in the order students see them. A row's title opens
 * the test; on the row: its format, what sets it apart, who has a result,
 * a Visible / Hidden switch, and copy and delete.
 */
export default function CourseTests({
  course,
  collections,
  tests,
}: {
  course: CourseInfo;
  collections: TestCollectionOption[];
  tests: CourseTestRow[];
}) {
  const [isImportOpen, setIsImportOpen] = useState(false);
  const importToggleRef = useRef<HTMLButtonElement>(null);
  const [copying, setCopying] = useState<CourseTestRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const { confirm, dialog } = useConfirm();
  // Only the toggled test gets a new object; the others keep their identity.
  const [optimisticTests, applyVisibility] = useOptimistic(
    tests,
    (current: CourseTestRow[], change: { id: string; visible: boolean }) =>
      current.map((test) => (test.id === change.id ? { ...test, visible: change.visible } : test))
  );

  const closeImport = () => {
    setIsImportOpen(false);
    importToggleRef.current?.focus();
  };

  const setVisibility = useCallback((test: CourseTestRow, visible: boolean) => {
    if (test.visible === visible) return;
    setSavingId(test.id);
    startTransition(async () => {
      applyVisibility({ id: test.id, visible });
      const response = await updateTestVisibility(test.id, visible).catch(() => ({ success: false, error: 'No connection.' }));
      if (!response.success) {
        // Leaving the transition drops the optimistic value: the switch goes back.
        void confirm({
          title: `Could not ${visible ? 'show' : 'hide'} “${test.title}”`,
          description: 'error' in response ? response.error : undefined,
          cancelLabel: null,
        });
      }
      setSavingId(null);
    });
  }, [applyVisibility, confirm]);

  const remove = useCallback(async (test: CourseTestRow) => {
    if (!(await confirm(describeDelete(test)))) return;

    setDeletingId(test.id);
    startTransition(async () => {
      // `deleteTest` calls `refresh()`: the shorter list arrives with this answer.
      const response = await deleteTest(test.id).catch(() => ({ success: false, error: 'No connection.' }));
      if (!response.success) {
        void confirm({
          title: `Could not delete “${test.title}”`,
          description: 'error' in response ? response.error : undefined,
          cancelLabel: null,
        });
      }
      setDeletingId(null);
    });
  }, [confirm]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* On the gray-100 canvas, where gray-500 misses AA. */}
        <p className="text-sm text-gray-600">
          {optimisticTests.length === 1 ? '1 test' : `${optimisticTests.length} tests`}, in the order students see them.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/admin/bank/build?course=${encodeURIComponent(course.value)}`} className={buttonClass({ variant: 'secondary' })}>
            <Library className="h-4 w-4" />
            Build from question bank
          </Link>
          {/* Outlined while open: a primary button has no pressed state of its own. */}
          <Button
            ref={importToggleRef}
            variant={isImportOpen ? 'secondary' : 'primary'}
            onClick={() => setIsImportOpen((open) => !open)}
            aria-expanded={isImportOpen}
          >
            <FileUp className="h-4 w-4" />
            Import test
          </Button>
        </div>
      </div>

      {isImportOpen && (
        <AdminForm key={course.value} collections={collections} defaultCategory={course.value} onClose={closeImport} />
      )}

      {optimisticTests.length === 0 ? (
        <EmptyState
          icon={<FileUp />}
          title="No tests in this course yet"
          description="Import a .tex file or build a test from the question bank."
        />
      ) : (
        <List>
          {optimisticTests.map((test) => {
            const olympiadWindow = readOlympiadWindow(test);
            return (
              <li key={test.id}>
                {/* The title's link covers the row (after:inset-0); the controls sit above it (relative z-10). */}
                <div className="group relative flex flex-col gap-3 px-4 py-3 transition-colors hover:bg-gray-50 sm:px-5 lg:flex-row lg:items-center lg:gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <Link
                        href={`/admin/tests/${test.id}`}
                        prefetch={false}
                        className="min-w-0 text-sm font-medium text-gray-900 wrap-anywhere after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-600"
                      >
                        {test.title}
                      </Link>
                      {hasTestBadges(test, course.maxAttempts) && (
                        <span className="relative z-10 flex flex-wrap items-center gap-1">
                          <TestBadges test={test} sectionMaxAttempts={course.maxAttempts} />
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {formatQuestionCount(test.questionCount)} · {formatTestLength(test)}
                      {test.questionSource && <> · Copy of &ldquo;{test.questionSource.title}&rdquo;</>}
                      {!test.questionSource && test._count.questionCopies > 0 && ` · Shown in ${test._count.questionCopies} ${test._count.questionCopies === 1 ? 'copy' : 'copies'}`}
                      {olympiadWindow && ` · Olympiad ${formatOlympiadMoment(olympiadWindow.startsAt)}, Tashkent time`}
                      {' · '}Added {formatDate(test.createdAt)}
                    </p>
                    <p className="relative z-10 mt-1 w-fit text-xs">
                      <Link href={`/admin/tests/${test.id}/stats`} prefetch={false} className={linkClass}>
                        {test.reach}
                      </Link>
                    </p>
                  </div>

                  <div className="relative z-10 flex shrink-0 flex-wrap items-center gap-2">
                    <div role="group" aria-label={`${test.title}: who sees it`} className={segmentedClass}>
                      {[true, false].map((visible) => (
                        <button
                          key={String(visible)}
                          type="button"
                          aria-pressed={test.visible === visible}
                          disabled={savingId === test.id}
                          onClick={() => setVisibility(test, visible)}
                          className={segmentClass(test.visible === visible)}
                        >
                          {savingId === test.id && test.visible === visible && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                          {visible ? 'Visible' : 'Hidden'}
                        </button>
                      ))}
                    </div>
                    <IconButton
                      size="sm"
                      variant="secondary"
                      onClick={() => setCopying(test)}
                      aria-label={`Copy ${test.title}`}
                      title="Copy to a course"
                    >
                      <Copy className="h-4 w-4" />
                    </IconButton>
                    <IconButton
                      size="sm"
                      variant="danger-secondary"
                      onClick={() => remove(test)}
                      disabled={deletingId === test.id}
                      aria-label={`Delete ${test.title}`}
                      title="Delete test"
                    >
                      {deletingId === test.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </IconButton>
                    <ChevronRight aria-hidden className={cn(rowChevronClass, 'ml-auto lg:ml-0')} />
                  </div>
                </div>
              </li>
            );
          })}
        </List>
      )}

      {copying && (
        <CopyTestDialog test={copying} course={course} collections={collections} onClose={() => setCopying(null)} />
      )}
      {dialog}
    </div>
  );
}
