'use client';

import React, { useId, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import Link from 'next/link';
import { uploadTest } from '@/app/admin/actions';
import AccessCodeField from '@/components/admin/AccessCodeField';
import OlympiadWindowFields from '@/components/admin/OlympiadWindowFields';
import { FilePickBox } from '@/components/admin/bank/FilePickBox';
import { TexImportPreview, describeImportBlocker } from '@/components/admin/bank/TexImportPreview';
import { uploadQuestionImages, type UploadedImage } from '@/components/admin/bank/uploadImages';
import { findMissingImages, useTexCheck } from '@/components/admin/bank/useTexCheck';
import { ArrowUpRight, FileText, Image as ImageIcon, Loader2, Plus, Upload, X } from 'lucide-react';
import type { TestCollectionOption } from '@/lib/testCatalog';
import { Button, IconButton, buttonClass } from '@/components/ui/Button';
import { CardBody, CardFooter, CardHeader, cardClass } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Feedback';
import { Field, Input, checkboxClass, hintClass, labelClass } from '@/components/ui/Field';
import { cn } from '@/components/ui/cn';
import {
  DEFAULT_TEST_MAX_ATTEMPTS,
  MAX_TEST_MAX_ATTEMPTS,
  MIN_TEST_MAX_ATTEMPTS,
} from '@/lib/testAttempts';
import {
  DEFAULT_MODULE_COUNT,
  DEFAULT_MODULE_DURATION_SECONDS,
  DEFAULT_MODULE_QUESTION_COUNT,
  MAX_MODULE_COUNT,
  resolveExamModules,
} from '@/lib/examModules';

type AdminFormProps = {
  collections: TestCollectionOption[];
  /** Course the form was opened from; a new test lands in it by default. */
  defaultCategory?: string;
  /** Closes the form; the tests page opens it from its header. */
  onClose?: () => void;
};

type ExamFormat = 'modular' | 'single';

/**
 * Numbers are kept as strings so clearing a field does not produce `NaN` and
 * make React rewrite the value under the caret. They are parsed on submit.
 */
type ModuleDraft = {
  id: string;
  questions: string;
  minutes: string;
};

const MIN_MODULAR_MODULE_COUNT = 2;
const DEFAULT_MODULE_MINUTES = Math.round(DEFAULT_MODULE_DURATION_SECONDS / 60);

let moduleDraftCounter = 0;

function createModuleDrafts(count: number): ModuleDraft[] {
  return Array.from({ length: count }, () => {
    moduleDraftCounter += 1;

    return {
      id: `module-${moduleDraftCounter}`,
      questions: String(DEFAULT_MODULE_QUESTION_COUNT),
      minutes: String(DEFAULT_MODULE_MINUTES),
    };
  });
}

/** Fields hold raw text while typing, so the value is only turned into a number here. */
function parseDraftNumber(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Imports a test into a course from one `.tex` file and its images. Choosing
 * the file checks it at once: the preview lists every question with the
 * domain and difficulty it goes into the question bank with, and the test
 * cannot be created while one is missing. The questions land in the bank and
 * in the test together (`uploadTest`).
 */
export default function AdminForm({ collections, defaultCategory: preselected, onClose }: AdminFormProps) {
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState('Creating test…');
  const [result, setResult] = useState<
    { success?: boolean; error?: string; testId?: string; title?: string; questionCount?: number } | null
  >(null);
  // The chosen files, so the boxes stop saying "Select…" once a file is
  // chosen (a hidden file input shows nothing on its own), the preview can
  // be checked again, and missing images are named before anything uploads.
  const [texFile, setTexFile] = useState<File | null>(null);
  const [imageNames, setImageNames] = useState<string[]>([]);
  const defaultCategory =
    collections.find((option) => option.value === preselected)?.value ??
    (collections.some((option) => option.value === 'STANDARD') ? 'STANDARD' : collections[0]?.value);
  const courseLabel = collections.find((option) => option.value === defaultCategory)?.label;
  const courseAttempts = (category: string | undefined) =>
    collections.find((option) => option.value === category)?.maxAttempts ?? DEFAULT_TEST_MAX_ATTEMPTS;
  const [maxAttempts, setMaxAttempts] = useState(() => String(courseAttempts(defaultCategory)));
  const [examFormat, setExamFormat] = useState<ExamFormat>('modular');
  const [modules, setModules] = useState<ModuleDraft[]>(() => createModuleDrafts(DEFAULT_MODULE_COUNT));
  // The code and olympiad fields keep their values in state, which
  // `form.reset()` cannot reach; a new key remounts them empty after a
  // successful upload.
  const [resetKey, setResetKey] = useState(0);
  const texCheck = useTexCheck();
  const fieldId = useId();
  const moduleListRef = useRef<HTMLDivElement>(null);
  const addModuleRef = useRef<HTMLButtonElement>(null);

  // Which module each question will run in with the format as it stands, so
  // the preview shows the split before the test exists - and says at once
  // when the file's `\module` markers do not fit the chosen format.
  const moduleLayout = useMemo(() => {
    const questions = texCheck.questions;
    if (!questions) return { modules: null, error: null };

    try {
      const resolved = resolveExamModules({
        questionCount: questions.length,
        markerModules: questions.some((question) => question.markerModule !== null)
          ? questions.map((question) => question.markerModule ?? 1)
          : null,
        format: {
          durationSeconds: 0,
          moduleDurations: examFormat === 'modular'
            ? modules.map((module) => parseDraftNumber(module.minutes, DEFAULT_MODULE_MINUTES) * 60)
            : [],
          moduleQuestionCounts: modules.map((module) => parseDraftNumber(module.questions, DEFAULT_MODULE_QUESTION_COUNT)),
        },
      });
      return { modules: resolved.moduleIndexes, error: null };
    } catch (error) {
      // examModules.ts names the option by its older label.
      const message = error instanceof Error ? error.message.replace('SAT modules', 'Modules') : null;
      return { modules: null, error: message || 'The file does not fit this format.' };
    }
  }, [texCheck.questions, examFormat, modules]);

  const missingImages = findMissingImages(texCheck.questions, imageNames);
  const blocker = describeImportBlocker({
    state: texCheck.state,
    untagged: texCheck.untagged,
    missingImages,
    moduleError: moduleLayout.error,
  });

  // The pressed X goes away with its row, so focus moves to the X that took
  // its place (or the one above it), and to "Add module" once the last
  // removable one is gone, instead of falling to the top of the page.
  const removeModule = (id: string, index: number) => {
    flushSync(() => setModules((current) => current.filter((item) => item.id !== id)));
    const removeButtons = moduleListRef.current?.querySelectorAll<HTMLButtonElement>('[data-remove-module]');
    const next = removeButtons?.length ? removeButtons[Math.min(index, removeButtons.length - 1)] : null;
    (next ?? addModuleRef.current)?.focus();
  };

  const updateModule = (id: string, patch: Partial<ModuleDraft>) => {
    setModules((current) => current.map((module) => (
      module.id === id ? { ...module, ...patch } : module
    )));
  };

  const chooseTexFile = (files: File[]) => {
    const file = files[0] ?? null;
    setTexFile(file);
    setResult(null);
    void texCheck.check(file);
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (blocker || loading) return;

    const form = e.currentTarget;
    setLoading(true);
    setStatusText('Preparing upload…');
    setResult(null);

    try {
      const formData = new FormData(form);
      const title = formData.get('title');
      const isFree = formData.get('isFree');
      const isVisible = formData.getAll('isVisible').includes('true');
      const testCategory = formData.get('testCategory');
      const durationMinutes = formData.get('durationMinutes');
      const attempts = formData.get('maxAttempts');
      const olympiadStartsAt = formData.get('olympiadStartsAt');
      const olympiadEndsAt = formData.get('olympiadEndsAt');
      const accessCode = formData.get('accessCode');
      const imageFiles = formData.getAll('images').filter(
        (file): file is File => file instanceof File && file.size > 0
      );
      let uploadedImages: UploadedImage[] = [];
      let testId = '';

      if (imageFiles.length > 0) {
        setStatusText('Preparing image uploads…');
        const upload = await uploadQuestionImages(imageFiles, 'test', (done, total) => {
          setStatusText(`Uploading images ${done}/${total}…`);
        });
        // A test upload's folder is the id the test is created under.
        testId = upload.folder;
        uploadedImages = upload.images;
      }

      setStatusText('Creating test…');
      const serverFormData = new FormData();
      if (typeof title === 'string') serverFormData.set('title', title);
      if (isFree === 'true') serverFormData.set('isFree', 'true');
      serverFormData.set('isVisible', isVisible ? 'true' : 'false');
      if (typeof testCategory === 'string') serverFormData.set('testCategory', testCategory);
      serverFormData.set('examFormat', examFormat);
      if (examFormat === 'modular') {
        for (const draft of modules) {
          serverFormData.append('moduleMinutes', String(parseDraftNumber(draft.minutes, DEFAULT_MODULE_MINUTES)));
          serverFormData.append('moduleQuestions', String(parseDraftNumber(
            draft.questions,
            DEFAULT_MODULE_QUESTION_COUNT
          )));
        }
      } else if (typeof durationMinutes === 'string') {
        serverFormData.set('durationMinutes', durationMinutes);
      }
      if (typeof attempts === 'string') serverFormData.set('maxAttempts', attempts);
      // Sent even when blank: the server reads "both empty" as "not an olympiad".
      if (typeof olympiadStartsAt === 'string') serverFormData.set('olympiadStartsAt', olympiadStartsAt);
      if (typeof olympiadEndsAt === 'string') serverFormData.set('olympiadEndsAt', olympiadEndsAt);
      if (typeof accessCode === 'string') serverFormData.set('accessCode', accessCode);
      if (texFile) serverFormData.set('texFile', texFile);
      if (testId) serverFormData.set('testId', testId);
      serverFormData.set('uploadedImages', JSON.stringify(uploadedImages));
      // One entry per question, in file order: the server parses the file
      // again and pairs them up by position.
      serverFormData.set('questionTags', JSON.stringify(texCheck.tags));

      const response = await uploadTest(serverFormData);

      setResult({ ...response, title: typeof title === 'string' ? title.trim() : undefined });
      if (response.success) {
        form.reset();
        setMaxAttempts(String(courseAttempts(defaultCategory)));
        setExamFormat('modular');
        setModules(createModuleDrafts(DEFAULT_MODULE_COUNT));
        setResetKey((key) => key + 1);
        setTexFile(null);
        setImageNames([]);
        texCheck.reset();
      }
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error
          ? error.message
          : 'The upload failed. Nothing was saved. Try again.',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={cardClass}>
      <CardHeader
        title="Upload a test"
        description={
          courseLabel
            ? `Into ${courseLabel}. One .tex file and its images; the questions also go into the question bank.`
            : 'One .tex file and its images; the questions also go into the question bank.'
        }
        actions={
          onClose && (
            // Not while uploading: closing would hide the progress and the outcome.
            <IconButton size="sm" onClick={onClose} disabled={loading} aria-label="Close upload form">
              <X className="h-4 w-4" />
            </IconButton>
          )
        }
      />

      {/* What every upload needs comes first (a title and the files, then the
          check of its questions), then the format, then the settings most
          tests leave as they are. */}
      <CardBody className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
        <Field label="Test title" htmlFor={`${fieldId}-title`} className="sm:col-span-2">
          <Input
            id={`${fieldId}-title`}
            name="title"
            type="text"
            required
            maxLength={200}
            autoFocus
            placeholder="e.g., March SAT Math Practice"
          />
        </Field>

        {/* The course is the one the form was opened from; this only carries
            it to the action so the picker does not exist in two places. */}
        <input type="hidden" name="testCategory" value={defaultCategory ?? ''} />

        <FilePickBox
          id={`${fieldId}-tex`}
          name="texFile"
          label="LaTeX file (.tex)"
          accept=".tex"
          required
          disabled={loading}
          icon={<FileText />}
          summary={texFile?.name ?? null}
          placeholder="Select main.tex"
          onFiles={chooseTexFile}
        />

        <FilePickBox
          id={`${fieldId}-images`}
          name="images"
          label="Images (.png, .jpg)"
          accept="image/*"
          multiple
          disabled={loading}
          icon={<ImageIcon />}
          summary={imageNames.length > 0
            ? `${imageNames.length} ${imageNames.length === 1 ? 'image' : 'images'} selected`
            : null}
          placeholder="Select all images"
          onFiles={(files) => setImageNames(files.map((file) => file.name))}
        />

        {texCheck.state.status !== 'idle' && (
          <div className="sm:col-span-2">
            <TexImportPreview
              state={texCheck.state}
              tags={texCheck.tags}
              onTagsChange={texCheck.setTags}
              modules={moduleLayout.modules}
              moduleError={moduleLayout.error}
              missingImages={missingImages}
              onRecheck={() => void texCheck.check(texFile)}
              disabled={loading}
            />
          </div>
        )}

        <fieldset className="sm:col-span-2">
          <legend className={cn(labelClass, 'mb-1.5')}>Format</legend>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {([
              {
                value: 'modular' as const,
                title: 'Modules',
                description: 'Each module runs on its own timer. Time left over in one module is not carried into the next.',
              },
              {
                value: 'single' as const,
                title: 'One block',
                description: 'One timer for the whole test, e.g. a 30-question set with a single time limit.',
              },
            ]).map((option) => (
              <label key={option.value} className="cursor-pointer">
                <input
                  type="radio"
                  name="examFormat"
                  value={option.value}
                  checked={examFormat === option.value}
                  onChange={() => setExamFormat(option.value)}
                  className="peer sr-only"
                />
                {/* Selected is the accent, never a second colour. The idle
                    edge is a control's, as on a chip: a mist-200 box read as
                    a note rather than as an option to pick. Chosen from the
                    state, not `peer-checked:`, so hover cannot paint over the
                    selected one. */}
                <span
                  className={cn(
                    'block h-full rounded-xl border px-3.5 py-3 transition-colors',
                    'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-board-600',
                    examFormat === option.value
                      ? 'border-board-600 bg-board-50'
                      : 'border-mist-400 hover:border-mist-500 hover:bg-mist-50',
                  )}
                >
                  <span className="block text-sm font-medium text-mist-900">{option.title}</span>
                  {option.description && <span className="mt-0.5 block text-xs text-mist-500">{option.description}</span>}
                </span>
              </label>
            ))}
          </div>

          {examFormat === 'modular' ? (
            <div ref={moduleListRef} className="mt-3 space-y-2">
              {modules.map((module, index) => (
                <div key={module.id} className="flex flex-wrap items-center gap-2">
                  <span className="w-20 text-sm text-mist-600">Module {index + 1}</span>

                  <Input
                    type="number"
                    min={1}
                    max={200}
                    step={1}
                    required
                    aria-label={`Module ${index + 1} questions`}
                    value={module.questions}
                    onChange={(event) => updateModule(module.id, { questions: event.target.value })}
                    suffix="questions"
                    className="max-w-36"
                  />

                  <Input
                    type="number"
                    min={1}
                    max={360}
                    step={1}
                    required
                    aria-label={`Module ${index + 1} minutes`}
                    value={module.minutes}
                    onChange={(event) => updateModule(module.id, { minutes: event.target.value })}
                    suffix="minutes"
                    className="max-w-36"
                  />

                  {/* Keyed, red only on hover and focus, like the remove
                      buttons of the question editor's options. */}
                  {modules.length > MIN_MODULAR_MODULE_COUNT && (
                    <IconButton
                      variant="danger-secondary"
                      data-remove-module
                      onClick={() => removeModule(module.id, index)}
                      aria-label={`Remove module ${index + 1}`}
                      title="Remove module"
                    >
                      <X className="h-4 w-4" />
                    </IconButton>
                  )}
                </div>
              ))}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <p className={cn(hintClass, 'max-w-xl')}>
                  Questions per module are used when the .tex file has no <code>\module</code> markers.
                  With markers, the split from the file wins.
                </p>
                <Button
                  ref={addModuleRef}
                  variant="secondary"
                  size="sm"
                  onClick={() => setModules((current) => [...current, ...createModuleDrafts(1)])}
                  disabled={modules.length >= MAX_MODULE_COUNT}
                >
                  <Plus className="h-4 w-4" />
                  Add module
                </Button>
              </div>
            </div>
          ) : (
            <Field label="Test time" htmlFor={`${fieldId}-duration`} className="mt-3 max-w-xs">
              <Input
                id={`${fieldId}-duration`}
                name="durationMinutes"
                type="number"
                min={1}
                max={360}
                step={1}
                defaultValue={120}
                required
                suffix="minutes"
              />
            </Field>
          )}
        </fieldset>

        <Field
          label="Attempts per student"
          htmlFor={`${fieldId}-attempts`}
          hint={`The course allows ${courseAttempts(defaultCategory)}. Change it to set a limit for this test only.`}
        >
          <Input
            id={`${fieldId}-attempts`}
            name="maxAttempts"
            type="number"
            min={MIN_TEST_MAX_ATTEMPTS}
            max={MAX_TEST_MAX_ATTEMPTS}
            step={1}
            value={maxAttempts}
            onChange={(event) => setMaxAttempts(event.target.value)}
            required
            suffix="attempts"
          />
        </Field>

        {/* Siblings need keys of their own: with one shared key React lost
            track of the old code field, which stayed in the form and sent
            the last test's code with the next upload. */}
        <AccessCodeField
          key={`code-${resetKey}`}
          hint="Students enter it once before the test opens. You can add, change or remove it later."
        />

        <OlympiadWindowFields
          key={`olympiad-${resetKey}`}
          className="sm:col-span-2"
          hint="Both empty for an ordinary test. With a window, the test opens only inside it, entry closes one test length before the end, and a ranking by solved questions, then time, appears once it is over. Times are Tashkent time."
        />

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 sm:col-span-2">
          <label className="inline-flex items-center gap-2 text-sm text-mist-700">
            <input name="isVisible" type="checkbox" value="true" defaultChecked className={checkboxClass} />
            Show in Practice
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-mist-700">
            <input name="isFree" type="checkbox" value="true" className={checkboxClass} />
            Free without a subscription
          </label>
        </div>

        {result?.success && (
          <Alert
            tone="success"
            className="sm:col-span-2"
            action={
              result.testId && (
                // A button, as on the admin home's alerts: a bare link at
                // the end of the line read as part of the sentence.
                <Link
                  href={`/admin/tests/${result.testId}`}
                  prefetch={false}
                  className={buttonClass({ variant: 'secondary', size: 'sm' })}
                >
                  Open it
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              )
            }
          >
            {result.title ? <>&ldquo;{result.title}&rdquo; is uploaded</> : 'The test is uploaded'}
            {result.questionCount ? `, and its ${result.questionCount} questions are in the question bank.` : '.'}
            {' '}The form is ready for the next one.
          </Alert>
        )}

        {result?.error && (
          <Alert tone="danger" className="sm:col-span-2">
            {result.error}
          </Alert>
        )}
      </CardBody>

      <CardFooter>
        {/* Why the button cannot act yet, beside it. */}
        {blocker && !loading && (
          <p className="mr-auto text-sm text-mist-500">{blocker}</p>
        )}
        {/* Secondary beside the primary: a ghost Cancel in a footer read as a caption. */}
        {onClose && (
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={loading || blocker !== null}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {/* "Uploading images 3/12…" counts up: fixed-width digits keep the button still. */}
              <span className="tabular-nums">{statusText}</span>
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              Create test
            </>
          )}
        </Button>
      </CardFooter>
    </form>
  );
}
