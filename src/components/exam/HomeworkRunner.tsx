"use client";

import React, { memo, useCallback, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { unstable_isUnrecognizedActionError } from 'next/navigation';
import {
  BookOpen,
  Calculator,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleDot,
  Loader2,
  RotateCcw,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
// KaTeX's stylesheet only: the maths arrives rendered (see `ExamRunner`).
import 'katex/dist/katex.min.css';
import BrandMark from '@/components/layout/BrandMark';
import { QuestionRowChannel } from '@/components/layout/TelegramChannel';
import CalculatorWindow from '@/components/exam/CalculatorWindow';
import ReferenceModal from '@/components/exam/ReferenceModal';
import { useColumnOffset, useSheetInset } from '@/components/exam/examWindows';
import { CURRENT_RING, UNANSWERED_TONE } from '@/components/exam/navigatorTones';
import {
  AnswerChoice,
  GridInField,
  MultiSelectHint,
  QuestionDiagram,
  QuestionNumberTile,
  questionColumnClass,
  questionHeadClass,
  questionScrollerClass,
  questionStemClass,
  questionSurfaceClass,
  readGridInEdit,
} from '@/components/exam/questionParts';
import { labelledToolClass, toolActiveClass, toolIconClass, toolIdleClass } from '@/components/exam/toolButtons';
import { checkHomeworkAnswer, startHomeworkOver } from '@/app/exam/[id]/homeworkActions';
import type { HomeworkVerdict } from '@/lib/homework';
import { formatCreditTotal } from '@/lib/resultAnswers';
import { Badge } from '@/components/ui/Badge';
import { Button, IconButton, buttonClass, iconButtonClass } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { Alert } from '@/components/ui/Feedback';
import { cn } from '@/components/ui/cn';

/**
 * Homework (Test.homework): the exam's question column with no clock and no
 * finish. A choice is checked the moment it is pressed - a multi-select set
 * or a grid-in value with Check answer - by `checkHomeworkAnswer` on the
 * server, which keeps the answer and sends back the verdict and the key.
 * Until then nothing about the key is in the page.
 *
 * A checked question is closed: the student's pick is green or red and the
 * right choice green, as in the review of a result. Every verdict is kept on
 * the server, so the screen opens again on the first question not answered,
 * with the checked ones as they were. Start over clears them all.
 *
 * `contentHtml` / `optionsHtml` / the verdicts' HTML are rendered on the
 * server by `renderMathHtml`, which escapes every plain-text segment.
 */
export type HomeworkQuestion = {
  id: string;
  contentHtml: string;
  /** Empty for a grid-in question. */
  optionsHtml: string[];
  multiSelect: boolean;
  imageUrl: string | null;
};

type QuestionStatus = 'correct' | 'partial' | 'incorrect' | 'open';

/** `reload`: only a reload can help, the page is from before a deploy. */
type CheckError = { message: string; reload: boolean };

function statusOf(verdict: HomeworkVerdict | undefined): QuestionStatus {
  if (!verdict) return 'open';
  if (verdict.isCorrect) return 'correct';
  return verdict.credit > 0 ? 'partial' : 'incorrect';
}

function firstOpenIndex(questions: HomeworkQuestion[], verdicts: Record<string, HomeworkVerdict>) {
  const index = questions.findIndex((question) => !verdicts[question.id]);
  return index === -1 ? 0 : index;
}

function readLetters(value: string) {
  return value.split(',').map((letter) => letter.trim()).filter(Boolean);
}

/*
 * The navigator's chips, as the result review draws them (ResultReview): a
 * mistake is solid, a right answer an outline, partial credit a dashed one,
 * and each also carries a glyph, so no status is colour alone. Not answered
 * is the exam navigator's own dashed grey.
 */
const STATUS_TONE: Record<QuestionStatus, string> = {
  incorrect: 'border-red-600 bg-red-600 text-white hover:bg-red-700',
  correct: 'border-green-700 bg-white text-green-800 hover:bg-green-50',
  partial: 'border-dashed border-green-700 bg-white text-green-800 hover:bg-green-50',
  open: cn(UNANSWERED_TONE, 'hover:bg-gray-50'),
};

const STATUS_GLYPH: Partial<Record<QuestionStatus, { icon: LucideIcon; tone: string }>> = {
  incorrect: { icon: X, tone: 'text-red-600 ring-red-600' },
  correct: { icon: Check, tone: 'text-green-700 ring-green-700' },
  partial: { icon: CircleDot, tone: 'text-green-700 ring-green-700' },
};

const STATUS_LABEL: Record<QuestionStatus, string> = {
  correct: 'Correct',
  partial: 'Partial credit',
  incorrect: 'Incorrect',
  open: 'Not answered',
};

function StatusGlyph({ status, small = false }: { status: QuestionStatus; small?: boolean }) {
  const glyph = STATUS_GLYPH[status];
  if (!glyph) return null;
  const Icon = glyph.icon;
  return (
    <span
      aria-hidden
      className={cn(
        'absolute flex items-center justify-center rounded-full bg-white ring-1',
        small ? '-right-1 -top-1 h-2.5 w-2.5' : '-right-1.5 -top-1.5 h-3.5 w-3.5',
        glyph.tone,
      )}
    >
      <Icon className={small ? 'h-2 w-2' : 'h-2.5 w-2.5'} strokeWidth={3} />
    </span>
  );
}

function VerdictBadge({ verdict }: { verdict: HomeworkVerdict }) {
  const status = statusOf(verdict);
  if (status === 'correct') return <Badge tone="success">Correct</Badge>;
  if (status === 'partial') {
    return (
      <Badge tone="success" className="tabular-nums">
        <CircleDot /> Partial credit {formatCreditTotal(verdict.credit)}
      </Badge>
    );
  }
  return <Badge tone="danger">Incorrect</Badge>;
}

const NavigatorChip = memo(function NavigatorChip({
  index,
  status,
  isCurrent,
  onSelect,
}: {
  index: number;
  status: QuestionStatus;
  isCurrent: boolean;
  onSelect: (index: number) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(index)}
      aria-current={isCurrent ? 'true' : undefined}
      aria-label={`Question ${index + 1}: ${STATUS_LABEL[status]}`}
      className={cn(
        'relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-sm font-medium tabular-nums transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink-600',
        STATUS_TONE[status],
        isCurrent && CURRENT_RING,
      )}
    >
      {index + 1}
      <StatusGlyph status={status} />
    </button>
  );
});

/**
 * The grid of every question with its verdict, opened from "Question N of M"
 * in the bottom bar, as the exam's navigator is.
 */
function HomeworkNavigator({
  id,
  statuses,
  currentIndex,
  progress,
  onSelect,
  onClose,
  triggerRef,
}: {
  id: string;
  statuses: QuestionStatus[];
  currentIndex: number;
  progress: string;
  onSelect: (index: number) => void;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const legend = (['incorrect', 'partial', 'correct', 'open'] as const)
    .map((status) => ({ status, count: statuses.filter((item) => item === status).length }))
    .filter((item) => item.count > 0);

  useEffect(() => {
    panelRef.current?.querySelector<HTMLElement>('[aria-current="true"]')?.focus();
  }, []);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Node ? event.target : null;
      if (!target) return;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      onClose();
      triggerRef.current?.focus();
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose, triggerRef]);

  return (
    <div
      ref={panelRef}
      id={id}
      role="dialog"
      aria-label="Question navigator"
      className="fixed inset-x-4 bottom-20 rounded-2xl border border-gray-200 bg-white p-4 shadow-lg md:absolute md:inset-x-auto md:bottom-full md:left-1/2 md:mb-6 md:w-max md:-translate-x-1/2 md:p-5"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tabular-nums text-gray-900">
            {statuses.length} {statuses.length === 1 ? 'question' : 'questions'}
          </h2>
          <p className="mt-0.5 text-xs tabular-nums text-gray-500">{progress}</p>
        </div>
        <IconButton
          size="sm"
          onClick={() => {
            onClose();
            triggerRef.current?.focus();
          }}
          aria-label="Close navigator"
          className="-mr-1.5"
        >
          <X className="h-4 w-4" />
        </IconButton>
      </div>

      <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-600">
        {legend.map(({ status, count }) => (
          <li key={status} className="flex items-center gap-2">
            <span className={cn('relative h-4 w-4 rounded-md border', STATUS_TONE[status])}>
              <StatusGlyph status={status} small />
            </span>
            <span className="tabular-nums">
              {STATUS_LABEL[status]} {count}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-4 grid grid-cols-[repeat(auto-fill,2.5rem)] justify-start gap-2 sm:grid-cols-[repeat(10,2.5rem)]">
        {statuses.map((status, index) => (
          <NavigatorChip
            key={index}
            index={index}
            status={status}
            isCurrent={index === currentIndex}
            onSelect={onSelect}
          />
        ))}
      </div>

      <p className="mt-4 border-t border-gray-100 pt-4 text-xs text-gray-500">
        Each answer is saved to your account when it is checked.
      </p>

      <span
        aria-hidden
        className="absolute -bottom-2 left-1/2 hidden h-4 w-4 -translate-x-1/2 rotate-45 border-b border-r border-gray-200 bg-white md:block"
      />
    </div>
  );
}

/** The grid-in field with its own Check answer; Enter checks too. */
function GridInCheck({
  value,
  isChecking,
  onChange,
  onCheck,
}: {
  value: string;
  isChecking: boolean;
  onChange: (value: string) => void;
  onCheck: () => void;
}) {
  const [problem, setProblem] = useState<string | null>(null);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (value.trim() && !isChecking) onCheck();
      }}
    >
      <GridInField
        value={value}
        problem={problem}
        onChange={(raw) => {
          const edit = readGridInEdit(raw, value);
          setProblem(edit.problem);
          if (!edit.problem) onChange(edit.value);
        }}
      >
        <CheckAnswerButton type="submit" isChecking={isChecking} disabled={!value.trim()} />
      </GridInField>
    </form>
  );
}

function CheckAnswerButton({
  isChecking,
  disabled,
  type = 'button',
  onClick,
}: {
  isChecking: boolean;
  disabled: boolean;
  type?: 'button' | 'submit';
  onClick?: () => void;
}) {
  return (
    <Button type={type} onClick={onClick} disabled={disabled || isChecking} className="mt-4">
      {isChecking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
      {isChecking ? 'Checking' : 'Check answer'}
    </Button>
  );
}

interface HomeworkRunnerProps {
  testId: string;
  title: string;
  questions: HomeworkQuestion[];
  /** The student's checked answers, by question id, as the server keeps them. */
  initialVerdicts: Record<string, HomeworkVerdict>;
  /** The page's signed word that this student may do this homework (`issueHomeworkPass`), sent with each answer. */
  pass: string | null;
  /** The reference sheet's content, rendered on the server (see `ReferenceSheet`). */
  referenceSheet: React.ReactNode;
}

export default function HomeworkRunner({
  testId,
  title,
  questions,
  initialVerdicts,
  pass,
  referenceSheet,
}: HomeworkRunnerProps) {
  const [verdicts, setVerdicts] = useState(initialVerdicts);
  const [index, setIndex] = useState(() => firstOpenIndex(questions, initialVerdicts));
  // What the student has chosen or typed and not checked yet, and what they
  // crossed out: on this screen only, gone with a reload.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [crossedOut, setCrossedOut] = useState<Record<string, string[]>>({});
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const checkingRef = useRef<string | null>(null);
  const [errors, setErrors] = useState<Record<string, CheckError>>({});
  const [isCalculatorOpen, setCalculatorOpen] = useState(false);
  const [wasCalculatorOpened, setWasCalculatorOpened] = useState(false);
  const [isReferenceOpen, setReferenceOpen] = useState(false);
  const [isNavigatorOpen, setNavigatorOpen] = useState(false);
  const [isConfirmingStartOver, setConfirmingStartOver] = useState(false);
  const [isStartingOver, setStartingOver] = useState(false);
  const [startOverError, setStartOverError] = useState<string | null>(null);
  const navigatorButtonRef = useRef<HTMLButtonElement>(null);
  const navigatorId = useId();
  const columnOffset = useColumnOffset();
  const sheetInset = useSheetInset();

  // Desmos is expensive to boot and keeps the student's graphs, so once
  // opened it stays mounted and is only hidden (see `CalculatorWindow`).
  if (isCalculatorOpen && !wasCalculatorOpened) {
    setWasCalculatorOpened(true);
  }

  const question = questions[Math.min(index, questions.length - 1)];
  const verdict = question ? verdicts[question.id] : undefined;
  const isChecking = question !== undefined && checkingId === question.id;
  const error = question ? errors[question.id] : undefined;
  const statuses = questions.map((item) => statusOf(verdicts[item.id]));
  const answeredCount = statuses.filter((status) => status !== 'open').length;
  const correctCount = statuses.filter((status) => status === 'correct').length;
  const isDone = answeredCount === questions.length;
  const progress = `${answeredCount} of ${questions.length} answered · ${correctCount} correct`;

  // A new question starts at its top, as on the exam.
  const scrollerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: 0 });
  }, [index]);

  const check = useCallback(
    async (questionId: string, answer: string) => {
      // One at a time: a double press must not send the same question twice.
      if (checkingRef.current) return;
      checkingRef.current = questionId;
      setCheckingId(questionId);
      setErrors((current) => {
        const next = { ...current };
        delete next[questionId];
        return next;
      });

      let response: Awaited<ReturnType<typeof checkHomeworkAnswer>> | null = null;
      try {
        response = await checkHomeworkAnswer(testId, questionId, answer, pass);
      } catch (caught) {
        // A page opened before a deploy asks for an action the new build no
        // longer has; anything else is most likely the network.
        const stale = unstable_isUnrecognizedActionError(caught);
        setErrors((current) => ({
          ...current,
          [questionId]: stale
            ? { message: 'The site was updated since you opened this page. Reload it; your checked answers are saved.', reload: true }
            : { message: 'Could not check your answer. Check your connection and try again.', reload: false },
        }));
      } finally {
        checkingRef.current = null;
        setCheckingId(null);
      }

      if (response?.verdict) {
        const checked = response.verdict;
        setVerdicts((current) => ({ ...current, [questionId]: checked }));
      } else if (response?.error) {
        const message = response.error;
        setErrors((current) => ({ ...current, [questionId]: { message, reload: false } }));
      }
    },
    [testId, pass]
  );

  const handleSelectChoice = useCallback(
    (letter: string) => {
      if (!question || verdicts[question.id] || checkingRef.current) return;
      if (question.multiSelect) {
        setDrafts((current) => {
          const letters = new Set(readLetters(current[question.id] ?? ''));
          if (letters.has(letter)) letters.delete(letter);
          else letters.add(letter);
          return { ...current, [question.id]: [...letters].sort().join(',') };
        });
        return;
      }
      // A single choice is the answer: it is checked as it is pressed.
      setDrafts((current) => ({ ...current, [question.id]: letter }));
      void check(question.id, letter);
    },
    [check, question, verdicts]
  );

  const handleToggleCrossOut = useCallback(
    (letter: string) => {
      if (!question) return;
      setCrossedOut((current) => {
        const letters = current[question.id] ?? [];
        return {
          ...current,
          [question.id]: letters.includes(letter)
            ? letters.filter((item) => item !== letter)
            : [...letters, letter],
        };
      });
    },
    [question]
  );

  const selectQuestion = useCallback((next: number) => {
    setIndex(next);
    setNavigatorOpen(false);
  }, []);
  const closeNavigator = useCallback(() => setNavigatorOpen(false), []);

  const startOver = async () => {
    setStartingOver(true);
    setStartOverError(null);
    let response: Awaited<ReturnType<typeof startHomeworkOver>>;
    try {
      response = await startHomeworkOver(testId);
    } catch {
      response = { error: 'Could not clear your answers. They are still saved. Try again.' };
    }
    setStartingOver(false);

    if (response.error) {
      setStartOverError(response.error);
      return;
    }

    setVerdicts({});
    setDrafts({});
    setCrossedOut({});
    setErrors({});
    setIndex(0);
    setConfirmingStartOver(false);
  };

  if (!question) return null;

  const draft = drafts[question.id] ?? '';
  const isChoice = question.optionsHtml.length > 0;
  const pickedLetters = new Set(readLetters(verdict ? verdict.answer : draft));
  const keyLetters = new Set(verdict?.correctLetters ?? []);
  const crossedLetters = new Set(crossedOut[question.id] ?? []);
  const isFirst = index === 0;
  const isLast = index === questions.length - 1;

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-gray-100">
      <header className="sticky top-0 z-50 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-gray-200 bg-white px-2 sm:px-4 lg:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {/* Leaving is safe: every checked answer is already saved. */}
          <Link
            href="/dashboard"
            aria-label="Back to Practice"
            title="Back to Practice"
            className={iconButtonClass({ variant: 'secondary' })}
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <span className="hidden lg:block">
            <BrandMark size="sm" />
          </span>
          <div className="min-w-0 leading-tight">
            <h1 className="truncate text-sm font-semibold text-gray-900">{title}</h1>
            <p className="mt-0.5 truncate text-xs tabular-nums text-gray-500">{progress}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {answeredCount > 0 && (
            <button
              type="button"
              onClick={() => {
                setStartOverError(null);
                setConfirmingStartOver(true);
              }}
              aria-label="Start over"
              title="Start over"
              className={cn(labelledToolClass, toolIdleClass, 'mr-1 sm:w-auto sm:px-3')}
            >
              <RotateCcw className={toolIconClass} />
              <span className="hidden sm:inline">Start over</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setReferenceOpen(!isReferenceOpen)}
            aria-pressed={isReferenceOpen}
            aria-label="Reference sheet"
            title="Reference sheet"
            className={cn(labelledToolClass, isReferenceOpen ? toolActiveClass : toolIdleClass)}
          >
            <BookOpen className={toolIconClass} />
            <span className="hidden xl:inline">Reference</span>
          </button>
          <button
            type="button"
            onClick={() => setCalculatorOpen(!isCalculatorOpen)}
            aria-pressed={isCalculatorOpen}
            aria-label="Graphing calculator"
            title="Graphing calculator"
            className={cn(labelledToolClass, isCalculatorOpen ? toolActiveClass : toolIdleClass)}
          >
            <Calculator className={toolIconClass} />
            <span className="hidden xl:inline">Calculator</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 flex-col overflow-hidden bg-white">
        <p className="sr-only" role="status">
          Question {index + 1} of {questions.length}
        </p>

        <div ref={scrollerRef} className={questionScrollerClass}>
          <div
            style={{
              translate: columnOffset ? `${columnOffset}px 0` : undefined,
              paddingBottom: sheetInset ? `calc(1.5rem + ${sheetInset}px)` : undefined,
            }}
            className={questionSurfaceClass}
          >
            <div className={questionColumnClass}>
              <div className={questionHeadClass}>
                <QuestionNumberTile number={index + 1} />
                {/* Said as it appears: the verdict is what the press was for.
                    Beside the number, where the exam has Flag, so the channel
                    keeps the row's right end on every test screen. */}
                <div aria-live="polite">
                  {verdict && <VerdictBadge verdict={verdict} />}
                </div>
                <QuestionRowChannel />
              </div>

              {question.imageUrl && <QuestionDiagram src={question.imageUrl} />}

              <div className={questionStemClass} dangerouslySetInnerHTML={{ __html: question.contentHtml }} />

              <div className="mt-6">
                {isChoice ? (
                  <div>
                    {question.multiSelect && !verdict && <MultiSelectHint />}
                    <div className="grid gap-2">
                      {question.optionsHtml.map((optionHtml, optionIndex) => {
                        const letter = String.fromCharCode(65 + optionIndex);
                        const isPicked = pickedLetters.has(letter);
                        return (
                          <AnswerChoice
                            key={optionIndex}
                            letter={letter}
                            optionHtml={optionHtml}
                            isSelected={isPicked}
                            isCrossedOut={!verdict && crossedLetters.has(letter)}
                            isMultiSelect={question.multiSelect}
                            isCorrect={keyLetters.has(letter)}
                            isWrongPick={Boolean(verdict) && isPicked && !keyLetters.has(letter)}
                            isLocked={Boolean(verdict)}
                            onSelect={handleSelectChoice}
                            onToggleCrossOut={handleToggleCrossOut}
                          />
                        );
                      })}
                    </div>
                    {/* A key that names no letter is said in words. */}
                    {verdict?.correctAnswerHtml && (
                      <p className="mt-4 text-sm text-gray-700">
                        Correct answer:{' '}
                        <span
                          className="font-semibold text-gray-900"
                          dangerouslySetInnerHTML={{ __html: verdict.correctAnswerHtml }}
                        />
                      </p>
                    )}
                    {!verdict && question.multiSelect && (
                      <CheckAnswerButton
                        isChecking={isChecking}
                        disabled={pickedLetters.size === 0}
                        onClick={() => void check(question.id, draft)}
                      />
                    )}
                    {!verdict && !question.multiSelect && isChecking && (
                      <p className="mt-4 flex items-center gap-2 text-sm text-gray-600">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Checking
                      </p>
                    )}
                  </div>
                ) : verdict ? (
                  <div className="max-w-md">
                    <h4 className="text-sm font-medium text-gray-700">Student-produced response</h4>
                    <dl className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <dt className="text-xs font-medium text-gray-500">Your answer</dt>
                        <dd
                          className={cn('mt-1 text-xl font-semibold', verdict.isCorrect ? 'text-green-800' : 'text-red-700')}
                          dangerouslySetInnerHTML={{ __html: verdict.answerHtml }}
                        />
                      </div>
                      {verdict.correctAnswerHtml && (
                        <div>
                          <dt className="text-xs font-medium text-gray-500">Correct answer</dt>
                          <dd
                            className="mt-1 text-xl font-semibold text-gray-900"
                            dangerouslySetInnerHTML={{ __html: verdict.correctAnswerHtml }}
                          />
                        </div>
                      )}
                    </dl>
                  </div>
                ) : (
                  <GridInCheck
                    key={question.id}
                    value={draft}
                    isChecking={isChecking}
                    onChange={(value) => setDrafts((current) => ({ ...current, [question.id]: value }))}
                    onCheck={() => void check(question.id, draft)}
                  />
                )}

                {error && (
                  <Alert
                    tone="danger"
                    className="mt-4"
                    action={error.reload ? (
                      <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>
                        Reload page
                      </Button>
                    ) : undefined}
                  >
                    {error.message}
                  </Alert>
                )}

                {isDone && verdict && (
                  <Alert className="mt-6">
                    You have answered all {questions.length} questions: {correctCount} correct. Start over to try
                    them again.
                  </Alert>
                )}
              </div>
            </div>
          </div>
        </div>

        {wasCalculatorOpened && (
          <CalculatorWindow isOpen={isCalculatorOpen} onClose={() => setCalculatorOpen(false)} />
        )}
      </div>

      <footer className="sticky bottom-0 z-50 flex h-16 shrink-0 items-center gap-2 border-t border-gray-200 bg-white px-3 shadow-[0_-12px_30px_rgba(15,23,42,0.08)] sm:px-4 lg:px-6">
        <div className="hidden flex-1 md:block" />

        <div className="relative min-w-0 max-md:flex-1">
          <button
            ref={navigatorButtonRef}
            type="button"
            onClick={() => setNavigatorOpen(!isNavigatorOpen)}
            aria-expanded={isNavigatorOpen}
            aria-haspopup="dialog"
            aria-controls={isNavigatorOpen ? navigatorId : undefined}
            className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-gray-900 px-4 pointer-coarse:h-11 text-sm font-medium tabular-nums text-white transition-colors hover:bg-gray-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-600 max-md:w-full"
          >
            Question {index + 1} of {questions.length}
            {isNavigatorOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>

          {isNavigatorOpen && (
            <HomeworkNavigator
              id={navigatorId}
              statuses={statuses}
              currentIndex={index}
              progress={progress}
              onSelect={selectQuestion}
              onClose={closeNavigator}
              triggerRef={navigatorButtonRef}
            />
          )}
        </div>

        <div className="flex flex-1 items-center justify-end gap-2 max-md:contents">
          {/* Hidden, not disabled, at either end: `invisible` keeps the box,
              so the navigator button between them does not jump. */}
          <button
            type="button"
            onClick={() => setIndex(Math.max(0, index - 1))}
            aria-label="Back"
            title="Back"
            className={buttonClass({
              variant: 'secondary',
              size: 'lg',
              className: cn('max-md:order-first max-md:w-10 max-md:px-0 max-md:pointer-coarse:w-11', isFirst && 'invisible'),
            })}
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden md:inline">Back</span>
          </button>
          <button
            type="button"
            onClick={() => setIndex(Math.min(questions.length - 1, index + 1))}
            className={buttonClass({ size: 'lg', className: cn('min-w-24', isLast && 'invisible') })}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </footer>

      <ReferenceModal isOpen={isReferenceOpen} onClose={() => setReferenceOpen(false)}>
        {referenceSheet}
      </ReferenceModal>

      <ConfirmDialog
        open={isConfirmingStartOver}
        busy={isStartingOver}
        title="Start this homework over?"
        description={
          <>
            <p>
              Your {answeredCount} checked {answeredCount === 1 ? 'answer is' : 'answers are'} cleared and every
              question opens again.
            </p>
            {startOverError && <p className="mt-2 text-red-600">{startOverError}</p>}
          </>
        }
        confirmLabel="Clear answers and start over"
        tone="danger"
        onConfirm={() => void startOver()}
        onCancel={() => setConfirmingStartOver(false)}
      />
    </main>
  );
}
