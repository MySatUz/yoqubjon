'use client';

import React, { useState } from 'react';
import { updateCollectionVisibility } from '@/app/admin/actions';
import { Atom, CheckCircle2, Eye, EyeOff, Layers3, Loader2, Sparkles } from 'lucide-react';
import {
  TEST_CATEGORY_OPTIONS,
  type TestCategory,
} from '@/lib/testCatalog';

type SectionVisibilityFormProps = {
  visibility: Record<TestCategory, boolean>;
};

export default function SectionVisibilityForm({ visibility }: SectionVisibilityFormProps) {
  const [currentVisibility, setCurrentVisibility] = useState(visibility);
  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; error?: string } | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setResult(null);

    const response = await updateCollectionVisibility(new FormData(event.currentTarget));
    setResult(response);
    setIsSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-2xl font-black tracking-tight text-slate-900">Practice sections</h3>
          <p className="mt-2 max-w-2xl text-sm font-bold leading-relaxed text-slate-500">
            Checked sections appear in Practice Center. Unchecked sections stay hidden from students.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-xs font-black uppercase tracking-widest text-blue-700">
          <Eye className="h-4 w-4" />
          Visibility
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {TEST_CATEGORY_OPTIONS.map((option) => {
          const Icon = option.value === 'PLANCK'
            ? Atom
            : option.value === 'ADVANCED'
              ? Sparkles
              : Layers3;

          return (
            <label key={option.value} className="group cursor-pointer">
              <input
                type="checkbox"
                name={`visible_${option.value}`}
                value="true"
                checked={currentVisibility[option.value]}
                onChange={(event) => {
                  setCurrentVisibility((current) => ({
                    ...current,
                    [option.value]: event.target.checked,
                  }));
                }}
                className="peer sr-only"
              />
              <div className="h-full rounded-2xl border border-slate-200 bg-slate-50 p-5 transition-all peer-checked:border-blue-500 peer-checked:bg-blue-50 peer-checked:ring-4 peer-checked:ring-blue-100 group-hover:border-blue-200">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className={`inline-flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm ${
                    currentVisibility[option.value] ? 'text-blue-600' : 'text-slate-300'
                  }`}>
                    {currentVisibility[option.value] ? (
                      <Eye className="h-4 w-4" />
                    ) : (
                      <EyeOff className="h-4 w-4" />
                    )}
                  </span>
                </div>
                <h4 className="text-lg font-black text-slate-900">{option.label}</h4>
                <p className="mt-2 text-xs font-bold leading-relaxed text-slate-500">{option.description}</p>
                <p className="mt-4 text-xs font-black uppercase tracking-widest text-blue-600">
                  Show section
                </p>
              </div>
            </label>
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

      {result?.success && (
        <div className="mt-5 rounded-2xl border border-green-100 bg-green-50 p-4 text-sm font-bold text-green-700">
          Sections updated.
        </div>
      )}

      {result?.error && (
        <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">
          Error: {result.error}
        </div>
      )}
    </form>
  );
}
