'use client';

import React, { useCallback, useMemo, useRef, useState, useTransition } from 'react';
import 'katex/dist/katex.min.css';
import Image from 'next/image';
import VideoClient from '@/components/exam/VideoClient';
import {
  revealResultQuestion,
  type RevealedQuestion,
} from '@/app/dashboard/results/actions';
import { formatCreditTotal } from '@/lib/resultAnswers';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Loader2,
  Lock,
  X,
  XCircle,
} from 'lucide-react';

export type ReviewStatus = 'correct' | 'partial' | 'incorrect';

export type ReviewQuestion = {
  id: string;
  /** 1-based position inside its own module, as the exam screen numbers it. */
  number: number;
  moduleIndex: number;
  status: ReviewStatus;
  credit: number;
};

export type ReviewModule = {
  index: number;
  questions: ReviewQuestion[];
};

interface ResultReviewProps {
  resultId: string;
  modules: ReviewModule[];
}

/** Intrinsic size a question diagram is requested at, as on the exam screen. */
const QUESTION_IMAGE_WIDTH = 800;
const QUESTION_IMAGE_HEIGHT = 480;

const STATUS_CHIP: Record<ReviewStatus, string> = {
  correct: 'border-emerald-600 bg-emerald-50 text-emerald-700',
  // A partly right multi-select stays inside the emerald family a step down,
  // rather than borrowing amber - which this design system keeps for pending
  // and expiring things alone.
  partial: 'border-emerald-300 bg-white text-emerald-700',
  incorrect: 'border-red-600 bg-red-50 text-red-700',
};

function StatusBadge({ status, credit }: { status: ReviewStatus; credit: number }) {
  if (status === 'correct') {
    return (
      <span className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-600">
        <CheckCircle2 className="h-3 w-3" /> Correct
      </span>
    );
  }

  if (status === 'partial') {
    return (
      <span className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 tabular-nums">
        <CircleDot className="h-3 w-3" /> Partial credit {formatCreditTotal(credit)}
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1 rounded-lg bg-red-50 px-2 py-1 text-xs font-medium text-red-600">
      <XCircle className="h-3 w-3" /> Incorrect
    </span>
  );
}

/**
 * The question-by-question review, opened one question at a time.
 *
 * Nothing about a question - its text, its diagram or its answer key - is in
 * the page the server sends. The grid below carries only a number and a
 * right/wrong mark per question; the rest is fetched from
 * `revealResultQuestion` when the student opens that one question, and is
 * dropped again the moment they open another. So the whole test is never in the
 * DOM at once and `Ctrl+P` has nothing to print, which is the point: a student
 * can review their own mistakes without being able to walk away with the
 * question bank.
 *
 * Nothing is cached on the client for the same reason - going back to a
 * question asks the server again instead of keeping a copy around.
 */
export default function ResultReview({ resultId, modules }: ResultReviewProps) {
  const [openQuestionId, setOpenQuestionId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RevealedQuestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const flatQuestions = useMemo(
    () => modules.flatMap((module) => module.questions),
    [modules]
  );
  const isModular = modules.length > 1;

  // Which question the student asked for last. A slower earlier request must
  // not paint its answer over a question they have already moved on from.
  const requestedIdRef = useRef<string | null>(null);

  const openQuestion = useCallback(
    (question: ReviewQuestion) => {
      requestedIdRef.current = question.id;
      setOpenQuestionId(question.id);
      setDetail(null);
      setError(null);

      startTransition(async () => {
        const response = await revealResultQuestion(resultId, question.id);
        if (requestedIdRef.current !== question.id) return;

        if (response.error) setError(response.error);
        else setDetail(response.question ?? null);
      });
    },
    [resultId]
  );

  const close = useCallback(() => {
    requestedIdRef.current = null;
    setOpenQuestionId(null);
    setDetail(null);
    setError(null);
  }, []);

  const openIndex = openQuestionId
    ? flatQuestions.findIndex((question) => question.id === openQuestionId)
    : -1;
  const current = openIndex >= 0 ? flatQuestions[openIndex] : null;
  const previous = openIndex > 0 ? flatQuestions[openIndex - 1] : null;
  const next =
    openIndex >= 0 && openIndex < flatQuestions.length - 1
      ? flatQuestions[openIndex + 1]
      : null;

  return (
    <div className="space-y-6">
      {modules.map((module) => (
        <div key={module.index} className="space-y-3">
          {isModular && (
            <h3 className="text-sm font-medium uppercase tracking-widest text-slate-500">
              Module {module.index}
            </h3>
          )}

          <div className="flex flex-wrap gap-2">
            {module.questions.map((question) => (
              <button
                key={question.id}
                type="button"
                onClick={() => openQuestion(question)}
                aria-pressed={question.id === openQuestionId}
                className={`h-11 w-11 rounded-xl border-2 text-sm font-semibold tabular-nums transition ${
                  STATUS_CHIP[question.status]
                } ${
                  question.id === openQuestionId
                    ? 'ring-2 ring-slate-900 ring-offset-2'
                    : 'hover:-translate-y-0.5'
                }`}
              >
                {question.number}
              </button>
            ))}
          </div>
        </div>
      ))}

      {current && (
        /* print:hidden is a second lock, not the first one: the question is
           only ever in the DOM while it is open, so a print of this page is
           empty here either way. */
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:hidden">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium uppercase tracking-widest text-slate-400">
                {isModular && `Module ${current.moduleIndex} | `}
                Question {current.number}
              </span>
              <StatusBadge status={current.status} credit={current.credit} />
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Close question"
              className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {isPending && !detail && !error && (
            <div className="flex items-center justify-center gap-2 py-16 text-sm font-semibold text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Opening question {current.number}
            </div>
          )}

          {error && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
              {error}
            </p>
          )}

          {detail && (
            /* select-none on the question itself: the student is reviewing
               their own mistakes, not collecting the paper. Their own answer
               and the key below stay selectable. */
            <div className="flex flex-col gap-6">
              <div className="select-none space-y-4">
                {detail.imageUrl && (
                  <div className="inline-block rounded-xl border border-slate-100 bg-slate-50 p-2">
                    <Image
                      src={detail.imageUrl}
                      alt="Question diagram"
                      width={QUESTION_IMAGE_WIDTH}
                      height={QUESTION_IMAGE_HEIGHT}
                      sizes="(min-width: 640px) 420px, 80vw"
                      className="max-h-64 w-auto rounded-lg"
                    />
                  </div>
                )}

                {/* `contentHtml` comes from `renderMathHtml`, which escapes
                    every plain-text segment and leaves KaTeX's `trust` off. */}
                <div
                  className="text-sm font-medium leading-relaxed text-slate-700"
                  dangerouslySetInnerHTML={{ __html: detail.contentHtml }}
                />
              </div>

              <div className="grid grid-cols-1 gap-8 border-t border-slate-100 pt-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase text-slate-500">Your answer</p>
                  {detail.userAnswerHtml ? (
                    <div
                      className={`text-lg font-semibold ${
                        detail.credit > 0 ? 'text-emerald-700' : 'text-red-700'
                      }`}
                      dangerouslySetInnerHTML={{ __html: detail.userAnswerHtml }}
                    />
                  ) : (
                    <p className="text-lg font-semibold text-slate-400">Not answered</p>
                  )}
                </div>
                {detail.correctAnswerHtml && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase text-slate-500">Correct answer</p>
                    <div
                      className="text-lg font-semibold text-slate-900"
                      dangerouslySetInnerHTML={{ __html: detail.correctAnswerHtml }}
                    />
                  </div>
                )}
              </div>

              {detail.videoUrl && (
                <div className="flex flex-col items-start border-t border-slate-100 pt-6">
                  <VideoClient url={detail.videoUrl} />
                </div>
              )}
            </div>
          )}

          <div className="mt-6 flex items-center justify-between gap-3 border-t border-slate-100 pt-6">
            <button
              type="button"
              onClick={() => previous && openQuestion(previous)}
              disabled={!previous}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-600 disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:text-slate-700"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>
            <button
              type="button"
              onClick={() => next && openQuestion(next)}
              disabled={!next}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-600 disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:text-slate-700"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {!current && (
        <p className="flex items-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-4 text-sm font-medium text-slate-500">
          <Lock className="h-4 w-4 shrink-0 text-slate-400" />
          Pick a question above to see it. Questions open one at a time and are not
          stored in this page.
        </p>
      )}
    </div>
  );
}
