'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { deleteTest, updateQuestion, updateTestDetails, updateTestVisibility } from '@/app/admin/actions';
import { ChevronDown, Clock3, Edit3, Eye, EyeOff, FileDown, ImageIcon, Layers, Loader2, Plus, Repeat2, Save, Settings2, Trash2, Video, X } from 'lucide-react';
import { getCategoryLabel, getTestCategory, type TestCollectionOption } from '@/lib/testCatalog';
import { MAX_TEST_MAX_ATTEMPTS, MIN_TEST_MAX_ATTEMPTS } from '@/lib/testAttempts';
import { formatModuleBadge, readModuleDurations, secondsToMinutes } from '@/lib/examModules';

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

function readOptions(options: unknown) {
  return Array.isArray(options)
    ? options.filter((option): option is string => typeof option === 'string')
    : [];
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
  const router = useRouter();
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

    const response = await updateTestDetails(test.id, new FormData(event.currentTarget));
    setResult(response);
    setIsSaving(false);

    if (response.success) {
      router.refresh();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-5 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-blue-600">
        <Settings2 className="h-4 w-4" />
        Test settings
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_0.9fr_0.7fr_0.7fr_auto]">
        <label className="block">
          <span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">
            Test title
          </span>
          <input
            name="title"
            required
            defaultValue={test.title}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          />
        </label>

        <label className="block">
          <span className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
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
              className="w-20 bg-transparent text-sm font-black text-slate-900 outline-none"
            />
            <span className="text-xs font-black text-slate-400">max</span>
          </div>
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">
            Section
          </span>
          <select
            name="testCategory"
            required
            defaultValue={selectedCategory}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          >
            {collections.map((collection) => (
              <option key={collection.value} value={collection.value}>
                {collection.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
            <Clock3 className="h-4 w-4" />
            {moduleDurations.length > 1 ? 'Module time' : 'Time'}
          </span>
          {moduleDurations.length > 1 ? (
            <div className="space-y-2">
              {moduleDurations.map((duration, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3"
                >
                  <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">
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
                    className="w-16 bg-transparent text-sm font-black text-slate-900 outline-none"
                  />
                  <span className="text-xs font-black text-slate-400">min</span>
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
                className="w-20 bg-transparent text-sm font-black text-slate-900 outline-none"
              />
              <span className="text-xs font-black text-slate-400">min</span>
            </div>
          )}
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
            <span className="text-xs font-black uppercase tracking-wide text-slate-600">Free</span>
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
            <span className="text-xs font-black uppercase tracking-wide text-slate-600">
              Shown
            </span>
          </label>
          <button
            type="submit"
            disabled={isSaving || collections.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save test
          </button>
        </div>
      </div>

      {result?.success && (
        <div className="mt-4 rounded-2xl border border-green-100 bg-green-50 p-3 text-sm font-bold text-green-700">
          Test settings saved.
        </div>
      )}

      {result?.error && (
        <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-3 text-sm font-bold text-red-700">
          Error: {result.error}
        </div>
      )}
    </form>
  );
}

function QuestionEditor({ question }: { question: AdminQuestion }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [options, setOptions] = useState(() => readOptions(question.options));

  const handleOptionChange = (index: number, value: string) => {
    setOptions((current) => current.map((option, optionIndex) => (
      optionIndex === index ? value : option
    )));
  };

  const handleRemoveOption = (index: number) => {
    setOptions((current) => current.filter((_, optionIndex) => optionIndex !== index));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setIsSaving(true);
    const res = await updateQuestion(question.id, new FormData(event.currentTarget));
    if (!res.success) {
      alert('Failed to update question: ' + res.error);
    } else {
      router.refresh();
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
            <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-slate-500">
              Question {question.order}
            </span>
            {readOptions(question.options).length === 0 && (
              <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-blue-700">
                Grid-in
              </span>
            )}
          </div>
          <p className="line-clamp-2 text-sm font-bold leading-relaxed text-slate-800">
            {question.content}
          </p>
        </div>
        <span className="mt-1 inline-flex shrink-0 items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-600 shadow-sm">
          <Edit3 className="h-4 w-4" />
          Edit
          <ChevronDown className={`h-4 w-4 transition ${isOpen ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {isOpen && (
        <form onSubmit={handleSubmit} className="space-y-5 border-t border-slate-200 bg-white p-4 sm:p-5">
          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">
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

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wide text-slate-500">Answer options</h4>
                <p className="text-xs font-semibold text-slate-400">
                  Leave empty for grid-in questions. Use at least two options for multiple choice.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOptions((current) => [...current, ''])}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white transition hover:bg-blue-600"
              >
                <Plus className="h-4 w-4" />
                Add option
              </button>
            </div>

            {options.length > 0 ? (
              <div className="grid gap-3">
                {options.map((option, index) => (
                  <div key={index} className="flex gap-3">
                    <span className="mt-2 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-black text-slate-500">
                      {String.fromCharCode(65 + index)}
                    </span>
                    <textarea
                      name="options"
                      value={option}
                      onChange={(event) => handleOptionChange(index, event.target.value)}
                      rows={2}
                      className="min-h-20 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold leading-relaxed text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(index)}
                      className="mt-2 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                      aria-label={`Remove option ${String.fromCharCode(65 + index)}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center text-xs font-bold text-slate-400">
                No options. This question will be treated as a grid-in answer.
              </div>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">
                Correct answer
              </span>
              <input
                name="correctAnswer"
                required
                defaultValue={question.correctAnswer}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">
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
              <span className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
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
              <span className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
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
              className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
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

export default function TestList({ tests, collections, initialOpenTestId = null }: TestListProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savingVisibilityId, setSavingVisibilityId] = useState<string | null>(null);
  const [openTestId, setOpenTestId] = useState<string | null>(initialOpenTestId);
  const visibleTestCount = tests.filter((test) => test.visible).length;

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this test? All questions and results will be lost.')) return;

    setDeletingId(id);
    const res = await deleteTest(id);
    if (!res.success) {
      alert('Failed to delete test: ' + res.error);
    } else {
      router.refresh();
      setOpenTestId((current) => current === id ? null : current);
    }
    setDeletingId(null);
  };

  const handleVisibilityToggle = async (test: AdminTest) => {
    setSavingVisibilityId(test.id);
    const res = await updateTestVisibility(test.id, !test.visible);
    if (!res.success) {
      alert('Failed to update visibility: ' + res.error);
    } else {
      router.refresh();
    }
    setSavingVisibilityId(null);
  };

  return (
    <div className="mt-12 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-black tracking-tight text-slate-900">Existing Tests</h2>
        <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-xs font-black uppercase tracking-widest text-blue-700">
          <Eye className="h-4 w-4" />
          {visibleTestCount} shown / {tests.length} total
        </span>
      </div>

      {tests.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center font-bold text-slate-400">
          No tests uploaded yet.
        </div>
      ) : (
        <div className="grid gap-4">
          {tests.map((test) => {
            const isOpen = openTestId === test.id;
            const category = getTestCategory(test);
            const categoryLabel = getCategoryLabel(category, collections);
            const questions = test.questions;
            const hasLoadedQuestions = Array.isArray(questions);

            return (
              <div key={test.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:border-blue-200">
                <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={() => setOpenTestId((current) => current === test.id ? null : test.id)}
                    className="flex min-w-0 flex-1 items-start gap-3 text-left"
                  >
                    <span className="mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                      <ChevronDown className={`h-5 w-5 transition ${isOpen ? 'rotate-180' : ''}`} />
                    </span>
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-black text-slate-900">{test.title}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                          category ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {categoryLabel}
                        </span>
                        {test.isFree && (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-black uppercase text-green-700">Free</span>
                        )}
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                          test.visible
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-slate-200 text-slate-600'
                        }`}>
                          {test.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                          {test.visible ? 'Shown' : 'Hidden'}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase text-slate-600">
                          <Clock3 className="h-3 w-3" />
                          {formatDuration(test.durationSeconds)}
                        </span>
                        {formatModuleBadge(test) && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-black uppercase text-blue-700">
                            <Layers className="h-3 w-3" />
                            {formatModuleBadge(test)}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase text-slate-600">
                          <Repeat2 className="h-3 w-3" />
                          {test.maxAttempts} attempts
                        </span>
                      </span>
                      <span className="mt-1 block text-xs font-bold text-slate-400">
                        {test._count.questions} questions | Uploaded {new Date(test.createdAt).toLocaleDateString()}
                      </span>
                    </span>
                  </button>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleVisibilityToggle(test)}
                      disabled={savingVisibilityId === test.id}
                      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition-all disabled:opacity-50 ${
                        test.visible
                          ? 'text-slate-500 hover:bg-amber-50 hover:text-amber-600'
                          : 'text-blue-600 hover:bg-blue-50'
                      }`}
                    >
                      {savingVisibilityId === test.id ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : test.visible ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                      {test.visible ? 'Hide' : 'Show'}
                    </button>

                    <Link
                      href={`/exam/${test.id}/pdf`}
                      className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black text-slate-500 transition-all hover:bg-blue-50 hover:text-blue-600"
                    >
                      <FileDown className="h-5 w-5" />
                      PDF
                    </Link>

                    <button
                      type="button"
                      onClick={() => handleDelete(test.id)}
                      disabled={deletingId === test.id}
                      className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black text-slate-400 transition-all hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    >
                      {deletingId === test.id ? (
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
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm font-bold text-slate-400">
                          This test has no questions.
                        </div>
                      )
                    ) : (
                      <Link
                        href={`/admin/tests/${test.id}`}
                        prefetch={false}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-blue-100 bg-white px-5 py-4 text-sm font-black text-blue-600 transition hover:border-blue-200 hover:bg-blue-50"
                      >
                        <Edit3 className="h-4 w-4" />
                        Open question editor
                      </Link>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
