"use client";

import React, { useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useExamStore } from '@/store/useExamStore';

interface BottomNavProps {
  testId: string;
  questionIds: string[];
  initialTimeSeconds: number;
}

export default function BottomNav({ testId, questionIds, initialTimeSeconds }: BottomNavProps) {
  const router = useRouter();
  const {
    currentQuestionIndex,
    setCurrentQuestionIndex,
    markedForReview,
    toggleMarkForReview,
    answers,
    timeLeftSeconds,
    resetExam,
  } = useExamStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const totalQuestions = questionIds.length;
  const currentQuestionId = questionIds[currentQuestionIndex] ?? questionIds[0];
  const isLastQuestion = currentQuestionIndex === totalQuestions - 1;

  const handleNextOrFinish = async () => {
    if (!isLastQuestion) {
      setCurrentQuestionIndex(Math.min(totalQuestions - 1, currentQuestionIndex + 1));
      return;
    }

    if (
      isSubmitting ||
      !confirm("Are you sure you want to finish this test? Your answers will be saved.")
    ) {
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/exam/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testId,
          answers,
          timeSpent: initialTimeSeconds - timeLeftSeconds,
        }),
      });

      const data = await response.json();
      if (data.success) {
        resetExam(testId, initialTimeSeconds);
        router.push(`/dashboard/results/${data.resultId}`);
      } else {
        alert(data.error || "Failed to submit results. Please try again.");
      }
    } catch (error) {
      console.error("Submit error:", error);
      alert("An error occurred. Check your connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <footer className="h-16 bg-white border-t border-slate-200 flex items-center justify-between px-4 sm:px-6 shrink-0 z-10 sticky bottom-0">
      <div className="flex items-center gap-2 hidden lg:flex min-w-[200px]">
        <span className="text-sm font-semibold text-slate-900 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">MYSATuz Student</span>
      </div>
      
      {/* Question Navigation Map */}
      <div className="flex-1 flex items-center justify-center gap-1.5 px-4 overflow-x-auto no-scrollbar">
        {questionIds.map((questionId, i) => {
          const isCurrent = i === currentQuestionIndex;
          const isMarked = markedForReview[questionId];
          const isAnswered = Boolean(answers[questionId]?.trim());
          return (
            <button
              key={questionId}
              onClick={() => setCurrentQuestionIndex(i)}
              className={`flex-shrink-0 w-8 h-8 rounded-lg text-sm font-bold transition-all flex items-center justify-center border-2 ${
                isCurrent 
                  ? 'border-blue-600 bg-blue-600 text-white shadow-md scale-110' 
                  : isAnswered
                    ? 'border-emerald-500 text-emerald-700 bg-emerald-50'
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
            checked={!!currentQuestionId && !!markedForReview[currentQuestionId]}
            onChange={() => currentQuestionId && toggleMarkForReview(currentQuestionId)}
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
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button 
            onClick={handleNextOrFinish}
            disabled={isSubmitting || totalQuestions === 0}
            className="flex min-w-[7.5rem] items-center justify-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl shadow-md shadow-blue-200 transition-all active:scale-95"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Submitting
              </>
            ) : isLastQuestion ? (
              <>
                Finish
                <Check className="w-4 h-4" />
              </>
            ) : (
              <>
                Next
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </footer>
  );
}
