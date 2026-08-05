'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  createTestCollection,
  deleteTestCollection,
  updateSectionSettings,
} from '@/app/admin/actions';
import { ArrowUpRight, Atom, CheckCircle2, Eye, EyeOff, Layers3, Loader2, PlusCircle, Repeat2, Sparkles, Trash2 } from 'lucide-react';
import type { TestCollectionOption } from '@/lib/testCatalog';
import {
  DEFAULT_TEST_MAX_ATTEMPTS,
  MAX_TEST_MAX_ATTEMPTS,
  MIN_TEST_MAX_ATTEMPTS,
} from '@/lib/testAttempts';

type SectionVisibilityFormProps = {
  collections: TestCollectionOption[];
};

type ActionResult = { success?: boolean; error?: string; message?: string } | null;

function getSectionIcon(category: string) {
  if (category === 'PLANCK') return Atom;
  if (category === 'ADVANCED') return Sparkles;
  return Layers3;
}

export default function SectionVisibilityForm({ collections }: SectionVisibilityFormProps) {
  const router = useRouter();
  const [visibilityOverrides, setVisibilityOverrides] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState<string | null>(null);
  const [result, setResult] = useState<ActionResult>(null);

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsCreating(true);
    setResult(null);

    const form = event.currentTarget;
    const response = await createTestCollection(new FormData(form));
    setResult(response.success ? { ...response, message: 'Section created.' } : response);
    setIsCreating(false);

    if (response.success) {
      form.reset();
      setVisibilityOverrides({});
      router.refresh();
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setResult(null);

    const response = await updateSectionSettings(new FormData(event.currentTarget));
    setResult(response.success ? { ...response, message: 'Sections updated.' } : response);
    setIsSaving(false);

    if (response.success) {
      setVisibilityOverrides({});
      router.refresh();
    }
  };

  const handleDelete = async (collection: TestCollectionOption) => {
    if (!confirm(`Delete section "${collection.label}"? Tests in this section will become unassigned.`)) return;

    setDeletingCategory(collection.value);
    setResult(null);
    const response = await deleteTestCollection(collection.value);
    setResult(response.success ? { ...response, message: 'Section deleted.' } : response);
    setDeletingCategory(null);

    if (response.success) {
      setVisibilityOverrides({});
      router.refresh();
    }
  };

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-2xl font-black tracking-tight text-slate-900">Practice sections</h3>
          <p className="mt-2 max-w-2xl text-sm font-bold leading-relaxed text-slate-500">
            Create, delete, and choose which sections appear in Practice Center. The attempt limit
            is the rule for the whole section: changing it applies to every test inside and to new
            uploads.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-xs font-black uppercase tracking-widest text-blue-700">
          <Eye className="h-4 w-4" />
          Visibility
        </span>
      </div>

      <form onSubmit={handleCreate} className="mb-8 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:grid-cols-[0.8fr_1fr_auto_auto]">
        <input
          name="sectionLabel"
          required
          maxLength={80}
          placeholder="New section name"
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
        />
        <input
          name="sectionDescription"
          maxLength={180}
          placeholder="Short description"
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
        />
        <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <Repeat2 className="h-4 w-4 text-slate-400" />
          <input
            name="sectionMaxAttempts"
            type="number"
            min={MIN_TEST_MAX_ATTEMPTS}
            max={MAX_TEST_MAX_ATTEMPTS}
            step={1}
            required
            defaultValue={DEFAULT_TEST_MAX_ATTEMPTS}
            aria-label="Attempts per user in the new section"
            className="w-16 bg-transparent text-sm font-black text-slate-900 outline-none"
          />
          <span className="text-xs font-black uppercase tracking-widest text-slate-400">tries</span>
        </label>
        <button
          type="submit"
          disabled={isCreating}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-100 transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
        >
          {isCreating ? <Loader2 className="h-5 w-5 animate-spin" /> : <PlusCircle className="h-5 w-5" />}
          Create
        </button>
      </form>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-3">
          {collections.map((option) => {
            const Icon = getSectionIcon(option.value);
            const isVisible = visibilityOverrides[option.value] ?? option.visible;
            const isDeleting = deletingCategory === option.value;

            return (
              <div
                key={option.value}
                className={`rounded-2xl border p-5 transition-all ${
                  isVisible
                    ? 'border-blue-500 bg-blue-50 ring-4 ring-blue-100'
                    : 'border-slate-200 bg-slate-50 hover:border-blue-200'
                }`}
              >
                <input type="hidden" name="category" value={option.value} />
                <div className="mb-5 flex items-start justify-between gap-4">
                  <Link
                    href={`/admin/sections/${option.value.toLowerCase()}`}
                    prefetch={false}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm transition hover:text-blue-700"
                    aria-label={`Open ${option.label} results`}
                  >
                    <Icon className="h-5 w-5" />
                  </Link>
                  <label className={`inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-white shadow-sm transition hover:ring-4 hover:ring-blue-100 ${
                    isVisible ? 'text-blue-600' : 'text-slate-300'
                  }`}>
                  <input
                    type="checkbox"
                    name={`visible_${option.value}`}
                    value="true"
                    checked={isVisible}
                    onChange={(event) => {
                      setVisibilityOverrides((current) => ({
                        ...current,
                        [option.value]: event.target.checked,
                      }));
                    }}
                    className="sr-only"
                    aria-label={`${isVisible ? 'Hide' : 'Show'} ${option.label}`}
                  />
                    {isVisible ? (
                      <Eye className="h-4 w-4" />
                    ) : (
                      <EyeOff className="h-4 w-4" />
                    )}
                  </label>
                </div>

                <Link
                  href={`/admin/sections/${option.value.toLowerCase()}`}
                  prefetch={false}
                  className="group block rounded-xl outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
                >
                  <h4 className="text-lg font-black text-slate-900">{option.label}</h4>
                  <p className="mt-2 min-h-12 text-xs font-bold leading-relaxed text-slate-500">{option.description}</p>
                  <p className="mt-4 text-xs font-black uppercase tracking-widest text-blue-600">
                    {isVisible ? 'Shown in Practice Center' : 'Hidden from students'}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 transition group-hover:text-blue-600">
                    Open results
                    <ArrowUpRight className="h-4 w-4" />
                  </span>
                </Link>

                <label className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <span className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500">
                    <Repeat2 className="h-4 w-4" />
                    Attempts
                  </span>
                  <span className="flex items-center gap-2">
                    <input
                      name={`attempts_${option.value}`}
                      type="number"
                      min={MIN_TEST_MAX_ATTEMPTS}
                      max={MAX_TEST_MAX_ATTEMPTS}
                      step={1}
                      required
                      defaultValue={option.maxAttempts}
                      aria-label={`Attempts per user in ${option.label}`}
                      className="w-16 bg-transparent text-right text-sm font-black text-slate-900 outline-none"
                    />
                    <span className="text-xs font-black uppercase tracking-widest text-slate-400">per user</span>
                  </span>
                </label>

                <button
                  type="button"
                  onClick={() => handleDelete(option)}
                  disabled={isDeleting || collections.length <= 1}
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-red-100 bg-white px-4 py-3 text-xs font-black text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Delete section
                </button>
              </div>
            );
          })}
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="mt-8 inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-slate-900 px-6 py-4 text-sm font-black text-white shadow-xl shadow-slate-200 transition hover:bg-blue-600 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
        >
          {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
          Save sections
        </button>
      </form>

      {result?.success && (
        <div className="mt-5 rounded-2xl border border-green-100 bg-green-50 p-4 text-sm font-bold text-green-700">
          {result.message || 'Sections updated.'}
        </div>
      )}

      {result?.error && (
        <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">
          Error: {result.error}
        </div>
      )}
    </section>
  );
}
