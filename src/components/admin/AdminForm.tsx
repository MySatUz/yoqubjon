'use client';

import React, { useState } from 'react';
import { uploadTest } from '@/app/admin/actions';
import { FileText, Image as ImageIcon, Upload, CheckCircle2, AlertCircle, Clock3, Eye, Loader2, Plus, Repeat2, Timer, Trophy, X } from 'lucide-react';
import type { TestCollectionOption } from '@/lib/testCatalog';
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
} from '@/lib/examModules';

type PreparedUpload = {
  name: string;
  path: string;
  token: string;
  signedUrl: string;
  publicUrl: string;
};

type AdminFormProps = {
  collections: TestCollectionOption[];
  /** Section chosen above the form; a new test lands in it by default. */
  defaultCategory?: string;
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

/** Uploads run in parallel, but only a few at a time so nothing times out in a queue. */
const IMAGE_UPLOAD_CONCURRENCY = 4;
const IMAGE_UPLOAD_TIMEOUT_MS = 60_000;
const MAX_LISTED_FAILED_UPLOADS = 10;

let moduleDraftCounter = 0;

function createModuleDrafts(count: number): ModuleDraft[] {
  return Array.from({ length: count }, () => {
    moduleDraftCounter += 1;

    return {
      id: `module-${moduleDraftCounter}`,
      questions: String(DEFAULT_MODULE_QUESTION_COUNT),
      minutes: String(Math.round(DEFAULT_MODULE_DURATION_SECONDS / 60)),
    };
  });
}

/** Fields hold raw text while typing, so the value is only turned into a number here. */
function parseDraftNumber(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function describeFailedUploads(failed: string[], total: number) {
  const listed = failed.slice(0, MAX_LISTED_FAILED_UPLOADS).join(', ');
  const rest = failed.length - MAX_LISTED_FAILED_UPLOADS;

  return `Could not upload ${failed.length} of ${total} images: ${listed}${
    rest > 0 ? ` and ${rest} more` : ''
  }. Fix them and upload the test again.`;
}

export default function AdminForm({ collections, defaultCategory: preselected }: AdminFormProps) {
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState('Processing LaTeX...');
  const [result, setResult] = useState<{ success?: boolean; error?: string; testId?: string } | null>(null);
  const defaultCategory =
    collections.find((option) => option.value === preselected)?.value ??
    (collections.some((option) => option.value === 'STANDARD') ? 'STANDARD' : collections[0]?.value);
  const sectionAttempts = (category: string | undefined) =>
    collections.find((option) => option.value === category)?.maxAttempts ?? DEFAULT_TEST_MAX_ATTEMPTS;
  const [maxAttempts, setMaxAttempts] = useState(() => String(sectionAttempts(defaultCategory)));
  const [examFormat, setExamFormat] = useState<ExamFormat>('modular');
  const [modules, setModules] = useState<ModuleDraft[]>(() => createModuleDrafts(DEFAULT_MODULE_COUNT));

  const updateModule = (id: string, patch: Partial<ModuleDraft>) => {
    setModules((current) => current.map((module) => (
      module.id === id ? { ...module, ...patch } : module
    )));
  };

  async function uploadImageToSignedUrl(file: File, upload: PreparedUpload) {
    const body = new FormData();
    body.append('cacheControl', '3600');
    body.append('', file);

    const response = await fetch(upload.signedUrl, {
      method: 'PUT',
      body,
      signal: AbortSignal.timeout(IMAGE_UPLOAD_TIMEOUT_MS),
    });

    if (!response.ok) {
      const message = await response.text().catch(() => '');
      throw new Error(`Image upload failed for ${file.name}: ${message || response.statusText}`);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setLoading(true);
    setStatusText('Preparing upload...');
    setResult(null);

    try {
      const formData = new FormData(form);
      const title = formData.get('title');
      const isFree = formData.get('isFree');
      const isVisible = formData.getAll('isVisible').includes('true');
      const testCategory = formData.get('testCategory');
      const durationMinutes = formData.get('durationMinutes');
      const maxAttempts = formData.get('maxAttempts');
      const olympiadStartsAt = formData.get('olympiadStartsAt');
      const olympiadEndsAt = formData.get('olympiadEndsAt');
      const texFile = formData.get('texFile');
      const imageFiles = formData.getAll('images').filter(
        (file): file is File => file instanceof File && file.size > 0
      );
      let uploadedImages: { name: string; publicUrl: string }[] = [];
      let testId = '';

      if (imageFiles.length > 0) {
        setStatusText('Preparing image uploads...');
        const prepareResponse = await fetch('/api/admin/test-upload/signed-urls', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            files: imageFiles.map((file) => ({
              name: file.name,
              type: file.type,
              size: file.size,
            })),
          }),
        });
        const prepareData = await prepareResponse.json().catch(() => null) as {
          testId?: string;
          uploads?: PreparedUpload[];
          error?: string;
        } | null;

        if (!prepareResponse.ok || !prepareData?.uploads || !prepareData.testId) {
          throw new Error(prepareData?.error || 'Could not prepare image uploads');
        }

        testId = prepareData.testId;
        setStatusText(`Uploading images 0/${imageFiles.length}...`);

        const uploadsByName = new Map(prepareData.uploads.map((upload) => [upload.name, upload]));
        const queue = [...imageFiles];
        const failed: string[] = [];
        let completed = 0;

        // Workers pull from a shared queue: a failing file is recorded and the rest
        // keep going, instead of Promise.all aborting the whole upload.
        await Promise.all(Array.from(
          { length: Math.min(IMAGE_UPLOAD_CONCURRENCY, queue.length) },
          async () => {
            for (let file = queue.shift(); file; file = queue.shift()) {
              const upload = uploadsByName.get(file.name);
              if (!upload) {
                failed.push(file.name);
                continue;
              }

              try {
                await uploadImageToSignedUrl(file, upload);
              } catch {
                failed.push(file.name);
                continue;
              }

              completed += 1;
              setStatusText(`Uploading images ${completed}/${imageFiles.length}...`);
            }
          }
        ));

        if (failed.length > 0) {
          throw new Error(describeFailedUploads(failed, imageFiles.length));
        }

        uploadedImages = prepareData.uploads.map((upload) => ({
          name: upload.name,
          publicUrl: upload.publicUrl,
        }));
      }

      setStatusText('Creating test...');
      const serverFormData = new FormData();
      if (typeof title === 'string') serverFormData.set('title', title);
      if (isFree === 'true') serverFormData.set('isFree', 'true');
      serverFormData.set('isVisible', isVisible ? 'true' : 'false');
      if (typeof testCategory === 'string') serverFormData.set('testCategory', testCategory);
      serverFormData.set('examFormat', examFormat);
      if (examFormat === 'modular') {
        for (const draft of modules) {
          serverFormData.append('moduleMinutes', String(parseDraftNumber(
            draft.minutes,
            Math.round(DEFAULT_MODULE_DURATION_SECONDS / 60)
          )));
          serverFormData.append('moduleQuestions', String(parseDraftNumber(
            draft.questions,
            DEFAULT_MODULE_QUESTION_COUNT
          )));
        }
      } else if (typeof durationMinutes === 'string') {
        serverFormData.set('durationMinutes', durationMinutes);
      }
      if (typeof maxAttempts === 'string') serverFormData.set('maxAttempts', maxAttempts);
      // Sent even when blank: the server reads "both empty" as "not an olympiad".
      if (typeof olympiadStartsAt === 'string') serverFormData.set('olympiadStartsAt', olympiadStartsAt);
      if (typeof olympiadEndsAt === 'string') serverFormData.set('olympiadEndsAt', olympiadEndsAt);
      if (texFile instanceof File) serverFormData.set('texFile', texFile);
      if (testId) serverFormData.set('testId', testId);
      serverFormData.set('uploadedImages', JSON.stringify(uploadedImages));

      const response = await uploadTest(serverFormData);

      setResult(response);
      if (response.success) {
        form.reset();
        setMaxAttempts(String(sectionAttempts(defaultCategory)));
        setExamFormat('modular');
        setModules(createModuleDrafts(DEFAULT_MODULE_COUNT));
      }
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error
          ? error.message
          : 'Upload failed. Please try again.',
      });
    } finally {
      setLoading(false);
      setStatusText('Processing LaTeX...');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-8 shadow-lg border border-slate-200 space-y-8">
      {/* Test Info */}
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-400 uppercase tracking-widest mb-2">Test Title</label>
          <input 
            name="title" 
            type="text" 
            required 
            placeholder="e.g., March SAT Math Practice"
            className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-semibold text-slate-900"
          />
        </div>

        {/* The section is picked once, above the form; this only carries it to
            the action so the picker does not exist in two places. */}
        <input type="hidden" name="testCategory" value={defaultCategory ?? ''} />

        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
          <span className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-slate-400">
            <Timer className="h-4 w-4" />
            Exam format
          </span>

          <div className="grid gap-3 sm:grid-cols-2">
            {([
              {
                value: 'modular' as const,
                title: 'SAT modules',
                description: 'Each module runs on its own timer. Time left over in one module is not carried into the next.',
              },
              {
                value: 'single' as const,
                title: 'Single timer',
                description: 'One timer for the whole test, e.g. a 30-question set with a single time limit.',
              },
            ]).map((option) => (
              <label key={option.value} className="group relative cursor-pointer">
                <input
                  type="radio"
                  name="examFormat"
                  value={option.value}
                  checked={examFormat === option.value}
                  onChange={() => setExamFormat(option.value)}
                  className="peer sr-only"
                />
                <div className="h-full rounded-2xl border border-slate-200 bg-white p-4 transition-all peer-checked:border-blue-500 peer-checked:bg-blue-50 peer-checked:ring-4 peer-checked:ring-blue-100 group-hover:border-blue-200">
                  <span className="mb-2 block text-sm font-semibold text-slate-900">{option.title}</span>
                  <p className="text-xs font-medium leading-relaxed text-slate-500">{option.description}</p>
                </div>
              </label>
            ))}
          </div>

          {examFormat === 'modular' ? (
            <div className="mt-4 space-y-3">
              {modules.map((module, index) => (
                <div
                  key={module.id}
                  className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3"
                >
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-medium uppercase tracking-widest text-slate-600">
                    Module {index + 1}
                  </span>

                  <label className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={200}
                      step={1}
                      required
                      value={module.questions}
                      onChange={(event) => updateModule(module.id, { questions: event.target.value })}
                      className="w-20 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-blue-400"
                    />
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-400">questions</span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={360}
                      step={1}
                      required
                      value={module.minutes}
                      onChange={(event) => updateModule(module.id, { minutes: event.target.value })}
                      className="w-20 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-blue-400"
                    />
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-400">minutes</span>
                  </label>

                  {modules.length > MIN_MODULAR_MODULE_COUNT && (
                    <button
                      type="button"
                      onClick={() => setModules((current) => current.filter((item) => item.id !== module.id))}
                      className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                      aria-label={`Remove module ${index + 1}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs font-medium text-slate-400">
                  Questions per module are used when the .tex file has no <code>\module</code> markers.
                  With markers, the split from the file wins.
                </p>
                <button
                  type="button"
                  onClick={() => setModules((current) => [...current, ...createModuleDrafts(1)])}
                  disabled={modules.length >= MAX_MODULE_COUNT}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-medium text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Plus className="h-4 w-4" />
                  Add module
                </button>
              </div>
            </div>
          ) : (
            <label className="mt-4 block">
              <span className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-slate-400">
                <Clock3 className="h-4 w-4" />
                Test time
              </span>
              <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-5 py-4">
                <input
                  name="durationMinutes"
                  type="number"
                  min={1}
                  max={360}
                  step={1}
                  defaultValue={120}
                  required
                  className="w-24 bg-transparent text-lg font-semibold text-slate-900 outline-none"
                />
                <span className="text-sm font-semibold text-slate-500">minutes</span>
              </div>
            </label>
          )}
        </div>

        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
          <span className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-slate-400">
            <Trophy className="h-4 w-4" />
            Olympiad window
          </span>
          <p className="mb-4 text-xs font-medium leading-relaxed text-slate-500">
            Leave both empty for an ordinary test. With a window set, the test opens only inside
            it, entry closes one test length before the end, and a ranking by solved questions
            then time appears once it is over. Times are Tashkent time.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-[11px] font-medium uppercase tracking-wide text-slate-400">
                Opens
              </span>
              <input
                name="olympiadStartsAt"
                type="datetime-local"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none focus:border-blue-400"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-[11px] font-medium uppercase tracking-wide text-slate-400">
                Closes
              </span>
              <input
                name="olympiadEndsAt"
                type="datetime-local"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none focus:border-blue-400"
              />
            </label>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-slate-400">
              <Repeat2 className="h-4 w-4" />
              Attempts per user
            </span>
            <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4">
              <input
                name="maxAttempts"
                type="number"
                min={MIN_TEST_MAX_ATTEMPTS}
                max={MAX_TEST_MAX_ATTEMPTS}
                step={1}
                value={maxAttempts}
                onChange={(event) => setMaxAttempts(event.target.value)}
                required
                className="w-24 bg-transparent text-lg font-semibold text-slate-900 outline-none"
              />
              <span className="text-sm font-semibold text-slate-500">attempts</span>
            </div>
            <span className="mt-2 block text-xs font-medium text-slate-400">
              Section rule: {sectionAttempts(defaultCategory)}. Change it here to override this test only.
            </span>
          </label>
        </div>
        
        <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
          <input 
            id="isFree" 
            name="isFree" 
            type="checkbox" 
            value="true"
            className="w-5 h-5 rounded-lg border-slate-300 text-blue-600 focus:ring-blue-500" 
          />
          <label htmlFor="isFree" className="text-sm font-semibold text-slate-700">Set as Free Test</label>
        </div>

        <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
          <input
            id="isVisible"
            name="isVisible"
            type="checkbox"
            value="true"
            defaultChecked
            className="w-5 h-5 rounded-lg border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <Eye className="h-5 w-5 text-slate-400" />
          <label htmlFor="isVisible" className="text-sm font-semibold text-slate-700">
            Show in Practice Center
          </label>
        </div>
      </div>

      {/* File Uploads */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="block text-xs font-medium text-slate-400 uppercase tracking-widest mb-2">LaTeX File (.tex)</label>
          <div className="relative group">
            <input 
              name="texFile" 
              type="file" 
              accept=".tex" 
              required
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div className="p-6 border-2 border-dashed border-slate-200 rounded-2xl group-hover:border-blue-400 group-hover:bg-blue-50 transition-all text-center">
              <FileText className="w-8 h-8 text-slate-400 group-hover:text-blue-500 mx-auto mb-2" />
              <span className="text-xs font-medium text-slate-500">Select main.tex</span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-medium text-slate-400 uppercase tracking-widest mb-2">Images (.png, .jpg)</label>
          <div className="relative group">
            <input 
              name="images" 
              type="file" 
              multiple 
              accept="image/*"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div className="p-6 border-2 border-dashed border-slate-200 rounded-2xl group-hover:border-blue-400 group-hover:bg-blue-50 transition-all text-center">
              <ImageIcon className="w-8 h-8 text-slate-400 group-hover:text-blue-500 mx-auto mb-2" />
              <span className="text-xs font-medium text-slate-500">Select all PNGs</span>
            </div>
          </div>
        </div>
      </div>

      <button 
        type="submit" 
        disabled={loading}
        className="w-full py-5 rounded-2xl bg-slate-900 hover:bg-blue-600 text-white font-semibold text-lg transition-all transform active:scale-95 shadow-lg disabled:opacity-50 flex items-center justify-center gap-3"
      >
        {loading ? (
          <>
            <Loader2 className="w-6 h-6 animate-spin" />
            {statusText}
          </>
        ) : (
          <>
            <Upload className="w-6 h-6" />
            Upload and Create Test
          </>
        )}
      </button>

      {result?.success && (
        <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3 text-emerald-700 font-semibold">
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          Test uploaded successfully!
        </div>
      )}

      {result?.error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-700 font-semibold">
          <AlertCircle className="w-5 h-5 text-red-500" />
          Error: {result.error}
        </div>
      )}
    </form>
  );
}
