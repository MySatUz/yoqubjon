'use client';

import React, { memo, useCallback, useMemo, useOptimistic, useState, useTransition } from 'react';
import Link from 'next/link';
import { deleteTest, updateQuestion, updateTestDetails, updateTestVisibility } from '@/app/admin/actions';
import { toOlympiadInputValue } from '@/lib/olympiad';
import { BarChart3, ChevronDown, Clock3, Edit3, Eye, EyeOff, FileDown, ImageIcon, Layers, Loader2, Plus, Repeat2, Save, Settings2, Trash2, Trophy, Video, X } from 'lucide-react';
import { getCategoryLabel, getTestCategory, type TestCollectionOption } from '@/lib/testCatalog';
import { MAX_TEST_MAX_ATTEMPTS, MIN_TEST_MAX_ATTEMPTS } from '@/lib/testAttempts';
import { formatModuleBadge, readModuleDurations, secondsToMinutes } from '@/lib/examModules';
import { isMultiSelectKey } from '@/lib/resultAnswers';

type AdminQuestion = {
  id: string;
  content: string;
  options: unknown;
  correctAnswer: string;
  explanation: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  order: number;
};

type AdminTest = {
  id: string;
  title: string;
  description: string | null;
  collectionCategory: string | null;
  durationSeconds: number;
  moduleDurations: number[];
  maxAttempts: number;
  olympiadStartsAt: Date | null;
  olympiadEndsAt: Date | null;
  isFree: boolean;
  visible: boolean;
  createdAt: Date;
  questions?: AdminQuestion[];
  _count: { questions: number };
};

interface TestListProps {
  tests: AdminTest[];
  collections: TestCollectionOption[];
  initialOpenTestId?: string | null;
}

// Built once: `toLocaleDateString()` rebuilds the formatter on every call.
const UPLOADED_DATE_FORMAT = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
});

function readOptions(options: unknown) {
  return Array.isArray(options)
    ? options.filter((option): option is string => typeof option === 'string')
    : [];
}

/**
 * Answer options arrive as a plain string array, so rows need their own ids to
 * survive a removal in the middle of the list.
 */
type OptionDraft = { id: string; text: string };

let optionDraftCounter = 0;

function createOptionDraft(text: string): OptionDraft {
  optionDraftCounter += 1;
  return { id: `option-${optionDraftCounter}`, text };
}

function durationToMinutes(seconds: number) {
  return Math.max(1, Math.round(seconds / 60));
}

function formatDuration(seconds: number) {
  const minutes = durationToMinutes(seconds);
  if (minutes >= 60 && minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  }

  return `${minutes} min`;
}

function TestSettingsEditor({
  test,
  collections,
}: {
  test: AdminTest;
  collections: TestCollectionOption[];
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; error?: string } | null>(null);
  const category = getTestCategory(test);
  const selectedCategory = category && collections.some((collection) => collection.value === category)
    ? category
    : collections[0]?.value ?? '';
  // Module questions are fixed at upload time, so only their timers are editable.
  const moduleDurations = readModuleDurations(test);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setResult(null);

    // `updateTestDetails` calls `refresh()` itself, so the updated row arrives
    // with this response instead of costing a second round-trip.
    const response = await updateTestDetails(test.id, new FormData(event.currentTarget));
    setResult(response);
    setIsSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-5 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-blue-600">
        <Settings2 className="h-4 w-4" />
        Test settings
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_0.9fr_0.7fr_0.7fr_auto]">
        <label className="block">
          <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Test title
          </span>
          <input
            name="title"
            required
            defaultValue={test.title}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          />
        </label>

        <label className="block">
          <span className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            <Repeat2 className="h-4 w-4" />
            Attempts
          </span>
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <input
              name="maxAttempts"
              type="number"
              min={MIN_TEST_MAX_ATTEMPTS}
              max={MAX_TEST_MAX_ATTEMPTS}
              step={1}
              required
              defaultValue={test.maxAttempts}
              className="w-20 bg-transparent text-sm font-semibold text-slate-900 outline-none"
            />
            <span className="text-xs font-medium text-slate-400">max</span>
          </div>
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Section
          </span>
          <select
            name="testCategory"
            required
            defaultValue={selectedCategory}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          >
            {collections.map((collection) => (
              <option key={collection.value} value={collection.value}>
                {collection.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            <Clock3 className="h-4 w-4" />
            {moduleDurations.length > 1 ? 'Module time' : 'Time'}
          </span>
          {moduleDurations.length > 1 ? (
            <div className="space-y-2">
              {moduleDurations.map((duration, index) => (
                <div
                  key={`module-${index}-${duration}`}
                  className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3"
                >
                  <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                    M{index + 1}
                  </span>
                  <input
                    name="moduleMinutes"
                    type="number"
                    min={1}
                    max={360}
                    step={1}
                    required
                    defaultValue={secondsToMinutes(duration)}
                    className="w-16 bg-transparent text-sm font-semibold text-slate-900 outline-none"
                  />
                  <span className="text-xs font-medium text-slate-400">min</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <input
                name="durationMinutes"
                type="number"
                min={1}
                max={360}
                step={1}
                required
                defaultValue={durationToMinutes(test.durationSeconds)}
                className="w-20 bg-transparent text-sm font-semibold text-slate-900 outline-none"
              />
              <span className="text-xs font-medium text-slate-400">min</span>
            </div>
          )}
        </label>

        <label className="block sm:col-span-2">
          <span className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-slate-400">
            <Trophy className="h-4 w-4" />
            Olympiad window
            <span className="normal-case tracking-normal text-slate-400">
              — empty for an ordinary test, Tashkent time
            </span>
          </span>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              name="olympiadStartsAt"
              type="datetime-local"
              aria-label="Olympiad opens"
              defaultValue={toOlympiadInputValue(test.olympiadStartsAt)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none focus:border-blue-400"
            />
            <input
              name="olympiadEndsAt"
              type="datetime-local"
              aria-label="Olympiad closes"
              defaultValue={toOlympiadInputValue(test.olympiadEndsAt)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none focus:border-blue-400"
            />
          </div>
        </label>

        <div className="flex flex-col justify-end gap-3">
          <label className="flex min-h-11 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <input
              name="isFree"
              type="checkbox"
              value="true"
              defaultChecked={test.isFree}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-xs font-medium uppercase tracking-wide text-slate-600">Free</span>
          </label>
          <label className="flex min-h-11 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <input type="hidden" name="isVisible" value="false" />
            <input
              name="isVisible"
              type="checkbox"
              value="true"
              defaultChecked={test.visible}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-xs font-medium uppercase tracking-wide text-slate-600">
              Shown
            </span>
          </label>
          <button
            type="submit"
            disabled={isSaving || collections.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save test
          </button>
        </div>
      </div>

      {result?.success && (
        <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
          Test settings saved.
        </div>
      )}

      {result?.error && (
        <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-3 text-sm font-semibold text-red-700">
          Error: {result.error}
        </div>
      )}
    </form>
  );
}

/**
 * Owns the editable answer options. It is remounted through a `key` built from
 * the saved options, so a refresh that actually changed them re-syncs the
 * fields while leaving the surrounding form open.
 */
function QuestionOptionsEditor({ initialOptions }: { initialOptions: string[] }) {
  const [options, setOptions] = useState(() => initialOptions.map(createOptionDraft));

  const handleOptionChange = (id: string, value: string) => {
    setOptions((current) => current.map((option) => (
      option.id === id ? { ...option, text: value } : option
    )));
  };

  const handleRemoveOption = (id: string) => {
    setOptions((current) => current.filter((option) => option.id !== id));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-xs font-medium uppercase tracking-wide text-slate-500">Answer options</h4>
          <p className="text-xs font-medium text-slate-400">
            Leave empty for grid-in questions. Use at least two options for multiple choice.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOptions((current) => [...current, createOptionDraft('')])}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-medium text-white transition hover:bg-blue-600"
        >
          <Plus className="h-4 w-4" />
          Add option
        </button>
      </div>

      {options.length > 0 ? (
        <div className="grid gap-3">
          {options.map((option, index) => (
            <div key={option.id} className="flex gap-3">
              <span className="mt-2 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-semibold text-slate-500">
                {String.fromCharCode(65 + index)}
              </span>
              <textarea
                name="options"
                value={option.text}
                onChange={(event) => handleOptionChange(option.id, event.target.value)}
                rows={2}
                className="min-h-20 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold leading-relaxed text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              />
              <button
                type="button"
                onClick={() => handleRemoveOption(option.id)}
                className="mt-2 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                aria-label={`Remove option ${String.fromCharCode(65 + index)}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center text-xs font-medium text-slate-400">
          No options. This question will be treated as a grid-in answer.
        </div>
      )}
    </div>
  );
}

function QuestionEditor({ question }: { question: AdminQuestion }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const savedOptions = useMemo(() => readOptions(question.options), [question.options]);
  // Version of the saved data, not a random value: the fields reset only when
  // the options themselves changed.
  const savedOptionsVersion = useMemo(
    () => `${savedOptions.length}:${savedOptions.join('\u0000')}`,
    [savedOptions]
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setIsSaving(true);
    // On success the action's own `refresh()` re-renders this row, which is what
    // re-keys `QuestionOptionsEditor` when the saved options changed.
    const res = await updateQuestion(question.id, new FormData(event.currentTarget));
    if (!res.success) {
      alert('Failed to update question: ' + res.error);
    }
    setIsSaving(false);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex w-full items-start justify-between gap-4 px-4 py-4 text-left transition hover:bg-white"
      >
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-slate-500">
              Question {question.order}
            </span>
            {savedOptions.length === 0 && (
              <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-blue-700">
                Grid-in
              </span>
            )}
            {isMultiSelectKey(question.correctAnswer) && (
              <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-blue-700">
                Multi-select
              </span>
            )}
          </div>
          <p className="line-clamp-2 text-sm font-semibold leading-relaxed text-slate-800">
            {question.content}
          </p>
        </div>
        <span className="mt-1 inline-flex shrink-0 items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm">
          <Edit3 className="h-4 w-4" />
          Edit
          <ChevronDown className={`h-4 w-4 transition ${isOpen ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {isOpen && (
        <form onSubmit={handleSubmit} className="space-y-5 border-t border-slate-200 bg-white p-4 sm:p-5">
          <label className="block">
            <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
              Question text
            </span>
            <textarea
              name="content"
              required
              defaultValue={question.content}
              rows={6}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold leading-relaxed text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            />
          </label>

          <QuestionOptionsEditor key={savedOptionsVersion} initialOptions={savedOptions} />

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                Correct answer
              </span>
              <input
                name="correctAnswer"
                required
                defaultValue={question.correctAnswer}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              />
              <span className="mt-2 block text-[11px] font-medium text-slate-400">
                One option letter, a value for a grid-in, or several letters such as
                {' '}<code className="font-semibold text-slate-500">B, C</code> to make the question multi-select.
              </span>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                Explanation
              </span>
              <input
                name="explanation"
                defaultValue={question.explanation ?? ''}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                <ImageIcon className="h-4 w-4" />
                Image URL
              </span>
              <input
                name="imageUrl"
                defaultValue={question.imageUrl ?? ''}
                placeholder="https://..."
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              />
            </label>

            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                <Video className="h-4 w-4" />
                Video URL
              </span>
              <input
                name="videoUrl"
                defaultValue={question.videoUrl ?? ''}
                placeholder="https://..."
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              />
            </label>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save question
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

type TestRowProps = {
  test: AdminTest;
  collections: TestCollectionOption[];
  categoryLabels: Map<string, string>;
  isOpen: boolean;
  isDeleting: boolean;
  isSavingVisibility: boolean;
  onToggleOpen: (testId: string) => void;
  onToggleVisibility: (testId: string, visible: boolean) => void;
  onDelete: (testId: string) => void;
};

const TestRow = memo(function TestRow({
  test,
  collections,
  categoryLabels,
  isOpen,
  isDeleting,
  isSavingVisibility,
  onToggleOpen,
  onToggleVisibility,
  onDelete,
}: TestRowProps) {
  const category = getTestCategory(test);
  const categoryLabel = category
    ? categoryLabels.get(category) ?? getCategoryLabel(category, collections)
    : getCategoryLabel(category, collections);
  const moduleBadge = formatModuleBadge(test);
  const questions = test.questions;
  const hasLoadedQuestions = Array.isArray(questions);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:border-blue-200">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => onToggleOpen(test.id)}
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
        >
          <span className="mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
            <ChevronDown className={`h-5 w-5 transition ${isOpen ? 'rotate-180' : ''}`} />
          </span>
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-900">{test.title}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
                category ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-600'
              }`}>
                {categoryLabel}
              </span>
              {test.isFree && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium uppercase text-emerald-700">Free</span>
              )}
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
                test.visible
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-slate-200 text-slate-600'
              }`}>
                {test.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                {test.visible ? 'Shown' : 'Hidden'}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase text-slate-600">
                <Clock3 className="h-3 w-3" />
                {formatDuration(test.durationSeconds)}
              </span>
              {moduleBadge && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium uppercase text-blue-700">
                  <Layers className="h-3 w-3" />
                  {moduleBadge}
                </span>
              )}
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase text-slate-600">
                <Repeat2 className="h-3 w-3" />
                {test.maxAttempts} attempts
              </span>
            </span>
            <span className="mt-1 block text-xs font-medium text-slate-400">
              {test._count.questions} questions | Uploaded {UPLOADED_DATE_FORMAT.format(new Date(test.createdAt))}
            </span>
          </span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onToggleVisibility(test.id, !test.visible)}
            disabled={isSavingVisibility}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all disabled:opacity-50 ${
              test.visible
                ? 'text-slate-500 hover:bg-amber-50 hover:text-amber-600'
                : 'text-blue-600 hover:bg-blue-50'
            }`}
          >
            {isSavingVisibility ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : test.visible ? (
              <EyeOff className="h-5 w-5" />
            ) : (
              <Eye className="h-5 w-5" />
            )}
            {test.visible ? 'Hide' : 'Show'}
          </button>

          <Link
            href={`/admin/tests/${test.id}/stats`}
            prefetch={false}
            className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-slate-500 transition-all hover:bg-blue-50 hover:text-blue-600"
          >
            <BarChart3 className="h-5 w-5" />
            Stats
          </Link>

          <Link
            href={`/exam/${test.id}/pdf`}
            className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-slate-500 transition-all hover:bg-blue-50 hover:text-blue-600"
          >
            <FileDown className="h-5 w-5" />
            PDF
          </Link>

          <button
            type="button"
            onClick={() => onDelete(test.id)}
            disabled={isDeleting}
            className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-slate-400 transition-all hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
          >
            {isDeleting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Trash2 className="h-5 w-5" />
            )}
            Delete
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="space-y-3 border-t border-slate-100 bg-slate-50 p-4 sm:p-5">
          <TestSettingsEditor test={test} collections={collections} />

          {hasLoadedQuestions ? (
            questions.length > 0 ? (
              questions.map((question) => (
                <QuestionEditor key={question.id} question={question} />
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm font-semibold text-slate-400">
                This test has no questions.
              </div>
            )
          ) : (
            <Link
              href={`/admin/tests/${test.id}`}
              prefetch={false}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-blue-100 bg-white px-5 py-4 text-sm font-semibold text-blue-600 transition hover:border-blue-200 hover:bg-blue-50"
            >
              <Edit3 className="h-4 w-4" />
              Open question editor
            </Link>
          )}
        </div>
      )}
    </div>
  );
});

export default function TestList({ tests, collections, initialOpenTestId = null }: TestListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savingVisibilityId, setSavingVisibilityId] = useState<string | null>(null);
  const [openTestId, setOpenTestId] = useState<string | null>(initialOpenTestId);
  const [, startTransition] = useTransition();
  // Only the toggled test gets a new object, so every other row keeps its identity
  // and stays out of the re-render.
  const [optimisticTests, applyOptimisticVisibility] = useOptimistic(
    tests,
    (current: AdminTest[], change: { id: string; visible: boolean }) => current.map((test) => (
      test.id === change.id ? { ...test, visible: change.visible } : test
    ))
  );
  const categoryLabels = useMemo(
    () => new Map(collections.map((collection) => [collection.value as string, collection.label])),
    [collections]
  );
  const visibleTestCount = optimisticTests.filter((test) => test.visible).length;

  const handleToggleOpen = useCallback((id: string) => {
    setOpenTestId((current) => current === id ? null : id);
  }, []);

  const handleDelete = useCallback((id: string) => {
    if (!confirm('Are you sure you want to delete this test? All questions and results will be lost.')) return;

    setDeletingId(id);
    startTransition(async () => {
      // `deleteTest` calls `refresh()` on the server, so the new list is part of
      // this action's response and the transition stays pending until it lands.
      const res = await deleteTest(id);
      if (!res.success) {
        alert('Failed to delete test: ' + res.error);
      } else {
        setOpenTestId((current) => current === id ? null : current);
      }
      setDeletingId(null);
    });
  }, []);

  const handleVisibilityToggle = useCallback((id: string, visible: boolean) => {
    setSavingVisibilityId(id);
    startTransition(async () => {
      applyOptimisticVisibility({ id, visible });
      const res = await updateTestVisibility(id, visible);
      if (!res.success) {
        // The action reports failure instead of throwing, so the optimistic value
        // has to be dropped here: leaving the transition restores the server state.
        alert('Failed to update visibility: ' + res.error);
      }
      // On success the action's `refresh()` sends the updated row back in the
      // same response, so the optimistic value is replaced by the server value
      // when the transition ends - no intermediate flash of the old state.
      setSavingVisibilityId(null);
    });
  }, [applyOptimisticVisibility]);

  return (
    <div className="mt-12 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Existing Tests</h2>
        <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-xs font-medium uppercase tracking-widest text-blue-700">
          <Eye className="h-4 w-4" />
          {visibleTestCount} shown / {optimisticTests.length} total
        </span>
      </div>

      {optimisticTests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center font-semibold text-slate-400">
          No tests uploaded yet.
        </div>
      ) : (
        <div className="grid gap-4">
          {optimisticTests.map((test) => (
            <TestRow
              key={test.id}
              test={test}
              collections={collections}
              categoryLabels={categoryLabels}
              isOpen={openTestId === test.id}
              isDeleting={deletingId === test.id}
              isSavingVisibility={savingVisibilityId === test.id}
              onToggleOpen={handleToggleOpen}
              onToggleVisibility={handleVisibilityToggle}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
