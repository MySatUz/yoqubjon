"use client";

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bookmark } from 'lucide-react';
import { useExamStore } from '@/store/useExamStore';
// KaTeX's stylesheet is still needed - its JS is not in this bundle, and is
// only fetched for the grid-in answer preview (see `GridInField`).
import 'katex/dist/katex.min.css';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { clearPendingAnswerFlush, setPendingAnswerFlush } from '@/components/exam/pendingAnswer';
import CalculatorWindow from '@/components/exam/CalculatorWindow';
import { useColumnOffset, useSheetInset } from '@/components/exam/examWindows';
import { MARKED_ICON_CLASS } from '@/components/exam/navigatorTones';
import {
  AnswerChoice,
  GridInField,
  MultiSelectHint,
  QUESTION_IMAGE_HEIGHT,
  QUESTION_IMAGE_SIZES,
  QUESTION_IMAGE_WIDTH,
  QuestionDiagram,
  QuestionNumberTile,
  questionColumnClass,
  questionHeadClass,
  questionScrollerClass,
  questionStemClass,
  questionSurfaceClass,
  readGridInEdit,
} from '@/components/exam/questionParts';
import { buttonClass } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';

/**
 * Admin-only, so it is split out of the exam bundle: a student's exam never
 * fetches it. Client-only because all of it is canvas and pointer.
 */
const Whiteboard = dynamic(() => import('@/components/exam/whiteboard/Whiteboard'), { ssr: false });

/**
 * `contentHtml` / `optionsHtml` are rendered on the server by
 * `@/lib/renderMathHtml`, which escapes every plain-text segment and leaves
 * KaTeX's `trust` option off. Nothing else may be injected below.
 */
interface Question {
  id: string;
  contentHtml: string;
  optionsHtml: string[];
  multiSelect: boolean;
  imageUrl?: string | null;
}

/** How long typing may stay local before it is written to the store. */
const ANSWER_COMMIT_DELAY_MS = 200;

/**
 * The question's own flag, so it sits on the question rather than in the
 * navigation. Still a checkbox, only drawn as Bluebook's bookmark: filled
 * amber once flagged, the colour the navigator gives a flagged question.
 * Outlined, not ghost: beside the question number it read as a caption.
 * Its own subscription, so flagging re-renders this control and nothing else.
 * (The store still calls it `markedForReview`, Bluebook's name.)
 */
const FlagQuestion = memo(function FlagQuestion({ questionId }: { questionId: string }) {
  const isMarked = useExamStore((state) => Boolean(state.markedForReview[questionId]));
  const toggleMarkForReview = useExamStore((state) => state.toggleMarkForReview);

  return (
    <label
      className={buttonClass({
        variant: 'secondary',
        size: 'sm',
        className:
          'cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink-600',
      })}
    >
      <input
        type="checkbox"
        checked={isMarked}
        onChange={() => toggleMarkForReview(questionId)}
        className="sr-only"
      />
      <Bookmark className={cn('h-4 w-4', isMarked && MARKED_ICON_CLASS)} />
      {isMarked ? 'Flagged' : 'Flag'}
    </label>
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
  const [problem, setProblem] = useState<string | null>(null);

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

  const handleChange = (raw: string) => {
    const edit = readGridInEdit(raw, draftRef.current);
    setProblem(edit.problem);
    if (!edit.problem) updateDraft(edit.value);
  };

  return <GridInField value={draft} problem={problem} onChange={handleChange} onBlur={commitDraft} />;
}

export default function SplitScreen({
  questions,
  canDraw = false,
  review = null,
}: {
  questions: Question[];
  canDraw?: boolean;
  /**
   * "Check your work", shown in the question's place. Inside this component
   * rather than instead of it, so the calculator window - and the graphs in
   * it - stays where it is while the student reviews.
   */
  review?: React.ReactNode;
}) {
  const currentQuestionIndex = useExamStore((state) => state.currentQuestionIndex);
  const setAnswer = useExamStore((state) => state.setAnswer);
  const toggleAnswerChoice = useExamStore((state) => state.toggleAnswerChoice);
  const toggleCrossOut = useExamStore((state) => state.toggleCrossOut);
  const isCalculatorOpen = useExamStore((state) => state.isCalculatorOpen);
  const setCalculatorOpen = useExamStore((state) => state.setCalculatorOpen);
  // Where the open tool windows leave room for the question (see `examWindows`).
  const columnOffset = useColumnOffset();
  const sheetInset = useSheetInset();

  const hasQuestions = Boolean(questions && questions.length > 0);
  const safeQuestionIndex = hasQuestions ? Math.min(currentQuestionIndex, questions.length - 1) : 0;
  const question = hasQuestions ? questions[safeQuestionIndex] : undefined;

  // Determine type: no options means GRID_IN
  const questionOptions = question?.optionsHtml;
  const isMultipleChoice = Boolean(questionOptions && questionOptions.length > 0);
  const isMultiSelect = isMultipleChoice && Boolean(question?.multiSelect);

  // Grid-in answers live in `GridInAnswer`, so only the choice highlighting
  // needs the stored answer here.
  const currentAnswer = useExamStore((state) =>
    isMultipleChoice && question ? state.answers[question.id] ?? '' : ''
  );

  // One code path for both kinds of choice: a single-choice answer is just a
  // set of one, so the highlighting below never has to branch.
  const selectedLetters = useMemo(
    () => new Set(currentAnswer.split(',').map((letter) => letter.trim()).filter(Boolean)),
    [currentAnswer]
  );
  // The stored array itself, so a tick of the clock does not rebuild the set.
  const crossedOut = useExamStore((state) => (question ? state.crossedOut[question.id] : undefined));
  const crossedLetters = useMemo(() => new Set(crossedOut ?? []), [crossedOut]);

  const questionId = question?.id;
  const handleSelectChoice = useCallback(
    (letter: string) => {
      if (!questionId) return;
      if (isMultiSelect) toggleAnswerChoice(questionId, letter);
      else setAnswer(questionId, letter);
    },
    [isMultiSelect, questionId, setAnswer, toggleAnswerChoice]
  );
  const handleToggleCrossOut = useCallback(
    (letter: string) => {
      if (questionId) toggleCrossOut(questionId, letter);
    },
    [questionId, toggleCrossOut]
  );

  // A new question starts at its top, not wherever the last one was scrolled
  // to - the stem of a long question used to open half off screen.
  const scrollerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: 0 });
  }, [questionId]);

  // Back from "Check your work", the student lands on the question they
  // picked rather than on a button that has gone away.
  const isReviewing = review !== null;
  const questionHeadRef = useRef<HTMLDivElement>(null);
  const wasReviewingRef = useRef(isReviewing);
  useEffect(() => {
    if (wasReviewingRef.current && !isReviewing) {
      questionHeadRef.current?.focus({ preventScroll: true });
    }
    wasReviewingRef.current = isReviewing;
  }, [isReviewing]);

  // Desmos is expensive to boot and keeps the student's graphs in its own
  // state, so once it has been opened it stays mounted and is only hidden.
  const [wasCalculatorOpened, setWasCalculatorOpened] = useState(false);
  if (isCalculatorOpen && !wasCalculatorOpened) {
    setWasCalculatorOpened(true);
  }

  const nextImageUrl = hasQuestions
    ? questions[safeQuestionIndex + 1]?.imageUrl ?? null
    : null;

  if (!question) return null;

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-white">
      {/* Which question this is, said whenever it changes: Next, Back and the
          navigator all move to a new question without moving focus. */}
      <p className="sr-only" role="status">
        Question {safeQuestionIndex + 1} of {questions.length}
      </p>

      {review ?? (
        <div ref={scrollerRef} className={questionScrollerClass}>
          {/* A tool window open beside it moves the whole surface and never
              resizes it: the question keeps its width and its type, the drawing
              stays on the question it was made on, and the canvas is not
              reallocated. A translation is also the one move that animates
              without layout. */}
          <div
            style={{
              translate: columnOffset ? `${columnOffset}px 0` : undefined,
              // On a phone the calculator is a sheet over the lower part of the
              // screen; this much more room at the foot lets the answers scroll
              // up above it, and only when they would otherwise sit under it.
              paddingBottom: sheetInset ? `calc(1.5rem + ${sheetInset}px)` : undefined,
            }}
            className={questionSurfaceClass}
          >
            <div className={questionColumnClass}>
              <div ref={questionHeadRef} tabIndex={-1} className={questionHeadClass}>
                <QuestionNumberTile number={safeQuestionIndex + 1} />
                <FlagQuestion questionId={question.id} />
              </div>

              {/* The diagram leads and the stem follows it, with the choices
                  straight after: the stem is the part a student re-reads while
                  working, so it belongs next to the answers rather than above a
                  figure that pushes it off screen. */}
              {question.imageUrl && <QuestionDiagram src={question.imageUrl} />}

              <div className={questionStemClass} dangerouslySetInnerHTML={{ __html: question.contentHtml }} />

              {/* Options / Answer Input - one column, like the real test. */}
              <div className="mt-6">
                {isMultipleChoice ? (
                  <div>
                    {isMultiSelect && <MultiSelectHint />}
                    <div className="grid gap-2">
                      {question.optionsHtml.map((optionHtml: string, idx: number) => {
                        const letter = String.fromCharCode(65 + idx);
                        return (
                          <AnswerChoice
                            key={idx}
                            letter={letter}
                            optionHtml={optionHtml}
                            isSelected={selectedLetters.has(letter)}
                            isCrossedOut={crossedLetters.has(letter)}
                            isMultiSelect={isMultiSelect}
                            onSelect={handleSelectChoice}
                            onToggleCrossOut={handleToggleCrossOut}
                          />
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <GridInAnswer key={question.id} questionId={question.id} />
                )}
              </div>
            </div>
            {canDraw && <Whiteboard questionId={question.id} />}
          </div>
        </div>
      )}

      {/* Calculator - nothing is loaded until it is opened the first time,
          and after that the window is hidden rather than unmounted so
          reopening is instant and the student's graphs survive. */}
      {wasCalculatorOpened && (
        <CalculatorWindow isOpen={isCalculatorOpen} onClose={() => setCalculatorOpen(false)} />
      )}

      {nextImageUrl && <NextQuestionImage src={nextImageUrl} sizes={QUESTION_IMAGE_SIZES} />}
    </div>
  );
}
