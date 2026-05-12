"use client";

import React from 'react';
import { useExamStore } from '@/store/useExamStore';

export default function BottomNav({ totalQuestions }: { totalQuestions: number }) {
  const { currentQuestionIndex, setCurrentQuestionIndex, markedForReview, toggleMarkForReview } = useExamStore();

  return (
    <footer className="h-16 bg-white border-t border-slate-200 flex items-center justify-between px-4 sm:px-6 shrink-0 z-10 sticky bottom-0">
      <div className="flex items-center gap-2 hidden lg:flex min-w-[200px]">
        <span className="text-sm font-semibold text-slate-900 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">MYSATuz Student</span>
      </div>
      
      {/* Question Navigation Map */}
      <div className="flex-1 flex items-center justify-center gap-1.5 px-4 overflow-x-auto no-scrollbar">
        {Array.from({ length: totalQuestions }).map((_, i) => {
          const isCurrent = i === currentQuestionIndex;
          const isMarked = markedForReview[i.toString()];
          return (
            <button
              key={i}
              onClick={() => setCurrentQuestionIndex(i)}
              className={`flex-shrink-0 w-8 h-8 rounded-lg text-sm font-bold transition-all flex items-center justify-center border-2 ${
                isCurrent 
                  ? 'border-blue-600 bg-blue-600 text-white shadow-md scale-110' 
                  : isMarked
                    ? 'border-red-500 text-red-600 bg-red-50'
                    : 'border-slate-100 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3 min-w-[300px] justify-end">
        <label className="flex items-center gap-2 cursor-pointer group px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">
          <input 
            type="checkbox" 
            checked={!!markedForReview[currentQuestionIndex.toString()]}
            onChange={() => toggleMarkForReview(currentQuestionIndex.toString())}
            className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-600 cursor-pointer" 
          />
          <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900 transition-colors hidden sm:inline-block">Mark for Review</span>
        </label>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
            disabled={currentQuestionIndex === 0}
            className="flex items-center justify-center w-10 h-10 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700 rounded-xl transition-all shadow-sm"
            title="Previous"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button 
            onClick={() => setCurrentQuestionIndex(Math.min(totalQuestions - 1, currentQuestionIndex + 1))}
            disabled={currentQuestionIndex === totalQuestions - 1}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl shadow-md shadow-blue-200 transition-all active:scale-95"
          >
            Next
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>
    </footer>
  );
}
