"use client";

import React from 'react';
import { ArrowRight, Clock3, ListChecks, TimerReset } from 'lucide-react';

interface ModuleTransitionProps {
  moduleIndex: number;
  moduleCount: number;
  durationSeconds: number;
  questionCount: number;
  onStart: () => void;
}

export default function ModuleTransition({
  moduleIndex,
  moduleCount,
  durationSeconds,
  questionCount,
  onStart,
}: ModuleTransitionProps) {
  const minutes = Math.round(durationSeconds / 60);

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 px-4 py-10 sm:px-6">
      <div className="mx-auto w-full max-w-2xl rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/60 sm:p-10">
        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-[11px] font-black uppercase tracking-[0.2em] text-emerald-700">
          Module {moduleIndex - 1} complete
        </span>

        <h1 className="mt-6 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
          Module {moduleIndex} of {moduleCount}
        </h1>
        <p className="mt-3 text-sm font-bold leading-relaxed text-slate-500">
          This module runs on its own clock. Time left over from the previous
          module is not carried over.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4">
            <ListChecks className="h-5 w-5 text-blue-600" />
            <span className="text-sm font-black text-slate-900">{questionCount} questions</span>
          </div>
          <div className="flex items-center justify-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4">
            <Clock3 className="h-5 w-5 text-blue-600" />
            <span className="text-sm font-black text-slate-900">{minutes} minutes</span>
          </div>
        </div>

        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50 px-5 py-4 text-left">
          <TimerReset className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <p className="text-xs font-bold leading-relaxed text-amber-800">
            The timer starts as soon as you continue, and you cannot go back to
            the previous module.
          </p>
        </div>

        <button
          type="button"
          onClick={onStart}
          className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-4 text-base font-black text-white shadow-lg shadow-blue-200 transition-all hover:bg-blue-700 active:scale-95"
        >
          Start Module {moduleIndex}
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
