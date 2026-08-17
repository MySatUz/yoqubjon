"use client";

import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useExamStore } from '@/store/useExamStore';
// KaTeX's stylesheet is still needed - only its JS is gone from this bundle.
import 'katex/dist/katex.min.css';
import Image from 'next/image';
import { clearPendingAnswerFlush, setPendingAnswerFlush } from '@/components/exam/pendingAnswer';

/**
 * `contentHtml` / `optionsHtml` are rendered on the server by
 * `@/lib/renderMathHtml`, which escapes every plain-text segment and leaves
 * KaTeX's `trust` option off. Nothing else may be injected below.
 */
interface Question {
  id: string;
  contentHtml: string;
  optionsHtml: string[];
  imageUrl?: string | null;
}

/** How long typing may stay local before it is written to the store. */
const ANSWER_COMMIT_DELAY_MS = 200;

/** Intrinsic size the question diagram is requested at. */
const QUESTION_IMAGE_WIDTH = 800;
const QUESTION_IMAGE_HEIGHT = 480;

const questionImageSizes = (isCalculatorOpen: boolean) =>
  isCalculatorOpen ? '(min-width: 768px) 28rem, 70vw' : '(min-width: 768px) 36rem, 80vw';

interface AnswerChoiceProps {
  letter: string;
  optionHtml: string;
  isSelected: boolean;
  isCompact: boolean;
  onSelect: (letter: string) => void;
}

/**
 * Memoized so picking an answer only re-renders the two choices whose
 * selection state actually changed.
 */
const AnswerChoice = memo(function AnswerChoice({
  letter,
  optionHtml,
  isSelected,
  isCompact,
  onSelect,
}: AnswerChoiceProps) {
  return (
    <button
      onClick={() => onSelect(letter)}
      className={`group flex items-center gap-4 p-5 rounded-2xl border-2 transition text-left ${
        isSelected
          ? 'border-emerald-600 bg-emerald-50 shadow-lg shadow-emerald-100 ring-4 ring-emerald-50 scale-[1.02]'
          : 'border-slate-200 bg-white hover:border-emerald-300 hover:bg-slate-50 shadow-sm'
      }`}
    >
      <span className={`flex-shrink-0 w-10 h-10 rounded-xl border-2 flex items-center justify-center font-black transition ${
        isSelected
          ? 'bg-emerald-600 border-emerald-600 text-white rotate-3'
          : 'border-slate-200 text-slate-400 group-hover:border-emerald-300 group-hover:text-emerald-600'
      }`}>
        {letter}
      </span>
      <span
        className={`font-bold transition-[color,font-size] ${
          isSelected ? 'text-emerald-900' : 'text-slate-800'
        } ${isCompact ? 'text-base' : 'text-xl'}`}
        dangerouslySetInnerHTML={{ __html: optionHtml }}
      />
    </button>
  );
});

/**
 * Warms the next question's diagram so it is already in the HTTP cache when
 * the student clicks Next.
 *
 * It renders the same `next/image` with the same `width`/`sizes`/quality
 * instead of building a `/_next/image?url=...&w=...&q=75` URL by hand: Next
 * picks the `w` candidate from `deviceSizes`/`imageSizes` and the `sizes`
 * media queries, so a hand-written URL would very likely warm a width the
 * browser never asks for. Letting Next emit the `srcSet` guarantees the
 * browser selects exactly the candidate the next question will request.
 * Priority is `low` so it never competes with the visible diagram.
 */
const NextQuestionImage = memo(function NextQuestionImage({
  src,
  sizes,
}: { src: string; sizes: string }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 h-px w-px overflow-hidden opacity-0"
    >
      <Image
        src={src}
        alt=""
        width={QUESTION_IMAGE_WIDTH}
        height={QUESTION_IMAGE_HEIGHT}
        sizes={sizes}
        loading="eager"
        fetchPriority="low"
      />
    </div>
  );
});

/**
 * Keeps the typed value in local state so a keystroke never travels through the
 * whole store (persist write + every exam component re-rendering). The draft is
 * committed after a short pause, on blur, and whenever the input goes away.
 */
function GridInAnswer({ questionId }: { questionId: string }) {
  const storedAnswer = useExamStore((state) => state.answers[questionId] ?? '');
  const setAnswer = useExamStore((state) => state.setAnswer);
  const [draft, setDraft] = useState(storedAnswer);
  const [syncedAnswer, setSyncedAnswer] = useState(storedAnswer);
  // Mirrors `draft` so a flush can read it without waiting for a render.
  const draftRef = useRef(draft);

  const updateDraft = useCallback((value: string) => {
    draftRef.current = value;
    setDraft(value);
  }, []);

  // An answer arriving from outside (persist hydration) wins over the draft.
  if (syncedAnswer !== storedAnswer) {
    setSyncedAnswer(storedAnswer);
    setDraft(storedAnswer);
  }

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const commitDraft = useCallback(() => {
    const value = draftRef.current;
    if (value === (useExamStore.getState().answers[questionId] ?? '')) return;
    setAnswer(questionId, value);
  }, [questionId, setAnswer]);

  // Deferred commit while typing.
  useEffect(() => {
    if (draft === storedAnswer) return;
    const timeout = setTimeout(commitDraft, ANSWER_COMMIT_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [commitDraft, draft, storedAnswer]);

  // Ending a module or submitting has to see the draft, and so does switching
  // question - the cleanup runs before the next question's input mounts.
  useEffect(() => {
    setPendingAnswerFlush(commitDraft);
    return () => {
      commitDraft();
      clearPendingAnswerFlush(commitDraft);
    };
  }, [commitDraft]);

  return (
    <input
      type="text"
      value={draft}
      onChange={(e) => updateDraft(e.target.value)}
      onBlur={commitDraft}
      placeholder="Enter value"
      inputMode="decimal"
      className="w-full rounded-2xl border-2 border-blue-300 bg-white px-4 py-3 text-center text-3xl font-black tracking-tight text-slate-900 shadow-[0_10px_22px_rgba(37,99,235,0.12)] transition-all placeholder:text-slate-200 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-100"
    />
  );
}

export default function SplitScreen({ questions }: { questions: Question[] }) {
  const currentQuestionIndex = useExamStore((state) => state.currentQuestionIndex);
  const setAnswer = useExamStore((state) => state.setAnswer);
  const isCalculatorOpen = useExamStore((state) => state.isCalculatorOpen);

  const hasQuestions = Boolean(questions && questions.length > 0);
  const safeQuestionIndex = hasQuestions ? Math.min(currentQuestionIndex, questions.length - 1) : 0;
  const question = hasQuestions ? questions[safeQuestionIndex] : undefined;

  // Determine type: no options means GRID_IN
  const questionOptions = question?.optionsHtml;
  const isMultipleChoice = Boolean(questionOptions && questionOptions.length > 0);

  // Grid-in answers live in `GridInAnswer`, so only the choice highlighting
  // needs the stored answer here.
  const currentAnswer = useExamStore((state) =>
    isMultipleChoice && question ? state.answers[question.id] ?? '' : ''
  );

  const questionId = question?.id;
  const handleSelectChoice = useCallback(
    (letter: string) => {
      if (questionId) setAnswer(questionId, letter);
    },
    [questionId, setAnswer]
  );

  // Desmos is expensive to boot and keeps the student's graphs in its own
  // state, so once it has been opened it stays mounted and is only hidden.
  const [wasCalculatorOpened, setWasCalculatorOpened] = useState(false);
  if (isCalculatorOpen && !wasCalculatorOpened) {
    setWasCalculatorOpened(true);
  }

  const imageSizes = questionImageSizes(isCalculatorOpen);
  const nextImageUrl = hasQuestions
    ? questions[safeQuestionIndex + 1]?.imageUrl ?? null
    : null;

  if (!question) return null;

  return (
    <div className={`flex-1 flex overflow-hidden bg-white ${isCalculatorOpen ? 'flex-col md:flex-row' : 'flex-col'}`}>
      {/* Question & Options Column */}
      <div className={`flex-1 overflow-y-auto px-4 py-6 md:px-10 md:py-10 transition-[width,background-color,border-color] duration-500 ${isCalculatorOpen ? 'w-full md:w-[46%] border-b md:border-b-0 md:border-r border-slate-100 bg-slate-50/30' : 'w-full'}`}>
        <div className={`${isCalculatorOpen ? 'max-w-2xl' : 'max-w-4xl'} mx-auto w-full flex flex-col min-h-full`}>
          {/* Question Content */}
          <div className="mb-10 flex-grow">
            <div className="prose prose-slate max-w-none">
              <div
                className={`${isCalculatorOpen ? 'text-base md:text-xl' : 'text-lg md:text-2xl'} font-medium text-slate-800 leading-relaxed mb-6 transition-[font-size] duration-500`}
                dangerouslySetInnerHTML={{ __html: question.contentHtml }}
              />
            </div>

            {question.imageUrl && (
              <div className={`my-6 rounded-2xl overflow-hidden border border-slate-200 bg-white p-3 shadow-md mx-auto ${isCalculatorOpen ? 'max-w-md' : 'max-w-xl'}`}>
                {/* The diagram is on screen the moment the question is, so the
                    default `loading="lazy"` only ever delays it. In Next 16
                    `priority` is deprecated in favour of these two props. */}
                <Image
                  src={question.imageUrl}
                  alt="Question diagram"
                  width={QUESTION_IMAGE_WIDTH}
                  height={QUESTION_IMAGE_HEIGHT}
                  loading="eager"
                  fetchPriority="high"
                  sizes={imageSizes}
                  className={`mx-auto h-auto w-full object-contain ${isCalculatorOpen ? 'max-h-[250px]' : 'max-h-[340px]'}`}
                />
              </div>
            )}
          </div>

          {/* Options / Answer Input */}
          <div className="mt-auto pt-8 border-t border-slate-200/60">
            {isMultipleChoice ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
                {question.optionsHtml.map((optionHtml: string, idx: number) => {
                  const letter = String.fromCharCode(65 + idx);
                  return (
                    <AnswerChoice
                      key={idx}
                      letter={letter}
                      optionHtml={optionHtml}
                      isSelected={currentAnswer === letter}
                      isCompact={isCalculatorOpen}
                      onSelect={handleSelectChoice}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="mx-auto max-w-sm rounded-[2rem] border border-blue-100 bg-gradient-to-b from-blue-50 to-white p-5 shadow-[0_18px_40px_rgba(59,130,246,0.12)]">
                <div className="flex flex-col items-center gap-3">
                  <h4 className="mb-1 rounded-full border border-blue-100 bg-white px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 shadow-sm">
                    Student-Produced Response
                  </h4>
                  <div className="relative mx-auto w-full max-w-[220px]">
                    <GridInAnswer key={question.id} questionId={question.id} />
                    <div className="pointer-events-none absolute inset-0 rounded-2xl border border-white/80"></div>
                  </div>
                  <p className="text-center text-[11px] font-bold uppercase tracking-[0.18em] text-blue-500">
                    Enter your answer above
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Calculator Panel - nothing is loaded until it is opened the first
          time, and after that it is hidden rather than unmounted so reopening
          is instant and the student's graphs survive. */}
      {wasCalculatorOpened && (
        <div
          className={
            isCalculatorOpen
              ? 'h-[45vh] w-full md:h-auto md:w-[55%] flex flex-col bg-white animate-slide-in-right border-l border-slate-200 shadow-2xl'
              : 'hidden'
          }
        >
          <iframe
            src="https://www.desmos.com/testing/collegeboard/graphing?lang=en"
            className="flex-1 w-full border-none"
            title="College Board Desmos Calculator"
          />
        </div>
      )}

      {nextImageUrl && <NextQuestionImage src={nextImageUrl} sizes={imageSizes} />}
    </div>
  );
}
