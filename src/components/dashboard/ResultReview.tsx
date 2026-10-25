'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import 'katex/dist/katex.min.css';
import Image from 'next/image';
import { unstable_isUnrecognizedActionError } from 'next/navigation';
import {
  revealResultQuestion,
  type RevealedQuestion,
} from '@/app/dashboard/results/actions';
import { formatCreditTotal } from '@/lib/resultAnswers';
import { TELEGRAM_URL } from '@/lib/landing/warmup';
import { Badge } from '@/components/ui/Badge';
import { Button, IconButton, buttonClass } from '@/components/ui/Button';
import { Card, CardHeader, insetClass } from '@/components/ui/Card';
import { Alert, EmptyState } from '@/components/ui/Feedback';
import { segmentClass, segmentedClass } from '@/components/ui/Misc';
import { cn } from '@/components/ui/cn';
import {
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Flag,
  Loader2,
  Lock,
  Minus,
  MinusCircle,
  MousePointerClick,
  RotateCw,
  X,
  XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type ReviewStatus = 'correct' | 'partial' | 'incorrect' | 'skipped';

/**
 * `canRetry` false: retrying cannot help, only reloading the page can.
 * `closed`: not a failure - the test is an olympiad that has not ended, and
 * the message says when its questions open. Nothing to press until then.
 */
type ReviewError = { message: string; canRetry: boolean; closed?: boolean };

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

/** `mistakes`: only the questions not fully right - wrong, part right or left empty. */
export type ReviewFilter = 'all' | 'mistakes';

interface ResultReviewProps {
  resultId: string;
  /** Named in the "Report a problem" message, so the report says where. */
  testTitle: string;
  modules: ReviewModule[];
  /** `mistakes` opens the review filtered, on the first mistake. */
  initialFilter?: ReviewFilter;
}

/**
 * The review card's id, for `#review` links and the hero's button. Kept in
 * here with the card: a constant exported from a client module reaches a
 * server component as a client reference, not as the string.
 */
const REVIEW_ANCHOR_ID = 'review';

/*
 * The hero's "Review mistakes" and this review are separate islands - the
 * hero is server-rendered - so the button announces itself with a window event
 * instead of a round trip through the URL and the server.
 */
const REVIEW_MISTAKES_EVENT = 'result-review:mistakes';

const isMistake = (question: ReviewQuestion) => question.status !== 'correct';

/** Intrinsic size a question diagram is requested at, as on the exam screen. */
const QUESTION_IMAGE_WIDTH = 800;
const QUESTION_IMAGE_HEIGHT = 480;

/*
 * Chip colours, shared by the chips and the legend. Mistakes are the solid
 * ones - they are what the student came here to work through. The old pale
 * tints were 1.04:1 apart (lime-50 against red-50) and one colour to a
 * red-green colour-blind eye, so each status also carries a glyph.
 */
const STATUS_TONE: Record<ReviewStatus, string> = {
  incorrect: 'border-red-600 bg-red-600 text-white',
  correct: 'border-lime-700 bg-white text-lime-800',
  // A partly right multi-select stays inside the lime family, told apart by
  // a dashed outline, rather than borrowing amber - which this design system
  // keeps for pending and expiring things alone.
  partial: 'border-dashed border-lime-700 bg-white text-lime-800',
  skipped: 'border-mist-400 bg-mist-100 text-mist-600',
};

const STATUS_HOVER: Record<ReviewStatus, string> = {
  incorrect: 'hover:bg-red-700',
  correct: 'hover:bg-lime-50',
  partial: 'hover:bg-lime-50',
  skipped: 'hover:bg-mist-200',
};

const STATUS_GLYPH: Record<ReviewStatus, { icon: LucideIcon; tone: string }> = {
  incorrect: { icon: X, tone: 'text-red-600 ring-red-600' },
  correct: { icon: Check, tone: 'text-lime-700 ring-lime-700' },
  partial: { icon: CircleDot, tone: 'text-lime-700 ring-lime-700' },
  skipped: { icon: Minus, tone: 'text-mist-500 ring-mist-400' },
};

const STATUS_LABEL: Record<ReviewStatus, string> = {
  incorrect: 'Incorrect',
  correct: 'Correct',
  partial: 'Partial credit',
  skipped: 'Not answered',
};

/** The legend and the chips list mistakes first. */
const STATUS_ORDER: ReviewStatus[] = ['incorrect', 'skipped', 'partial', 'correct'];

/** The second cue besides colour: a small glyph in the chip's top-right corner. */
function StatusGlyph({ status, small = false }: { status: ReviewStatus; small?: boolean }) {
  const { icon: Icon, tone } = STATUS_GLYPH[status];
  return (
    <span
      aria-hidden
      className={cn(
        'absolute flex items-center justify-center rounded-full bg-white ring-1',
        small ? '-right-1 -top-1 h-2.5 w-2.5' : '-right-1.5 -top-1.5 h-3.5 w-3.5',
        tone,
      )}
    >
      <Icon className={small ? 'h-2 w-2' : 'h-2.5 w-2.5'} strokeWidth={3} />
    </span>
  );
}

function StatusBadge({ status, credit }: { status: ReviewStatus; credit: number }) {
  if (status === 'correct') {
    return (
      <Badge tone="success">
        <CheckCircle2 /> Correct
      </Badge>
    );
  }

  if (status === 'partial') {
    return (
      <Badge tone="success" className="tabular-nums">
        <CircleDot /> Partial credit {formatCreditTotal(credit)}
      </Badge>
    );
  }

  if (status === 'skipped') {
    return (
      <Badge>
        <MinusCircle /> Not answered
      </Badge>
    );
  }

  return (
    <Badge tone="danger">
      <XCircle /> Incorrect
    </Badge>
  );
}

/**
 * "Review mistakes" on the score card. Without JavaScript it is an ordinary
 * link that reloads the page filtered; with it, the review switches in place.
 * Focus follows the scroll, so a screen reader hears where it landed and the
 * next Tab is inside the review rather than back on the score card.
 */
export function ReviewMistakesButton({ resultId, count }: { resultId: string; count: number }) {
  return (
    <a
      href={`/dashboard/results/${resultId}?review=mistakes#${REVIEW_ANCHOR_ID}`}
      onClick={(event) => {
        // A modified click (new tab, new window) keeps the plain link.
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        window.dispatchEvent(new Event(REVIEW_MISTAKES_EVENT));
        const review = document.getElementById(REVIEW_ANCHOR_ID);
        review?.scrollIntoView({ block: 'start' });
        review?.focus({ preventScroll: true });
      }}
      className={buttonClass()}
    >
      Review {count} {count === 1 ? 'mistake' : 'mistakes'}
    </a>
  );
}

/** A message to support in Telegram, already saying which question it is about. */
function reportProblemHref(testTitle: string, question: ReviewQuestion, isModular: boolean) {
  const where = isModular
    ? `module ${question.moduleIndex}, question ${question.number}`
    : `question ${question.number}`;
  return `${TELEGRAM_URL}?text=${encodeURIComponent(`A problem in "${testTitle}", ${where}: `)}`;
}

/**
 * The question-by-question review, opened one question at a time: the review
 * card of the result page, with the All / Mistakes switch in its header, the
 * chips, and the open question - below them, or beside them once the card is
 * wide enough.
 *
 * Nothing about a question - its text, its diagram or its answer key - is in
 * the page the server sends. The chips below carry only a number and a
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
export default function ResultReview({
  resultId,
  testTitle,
  modules,
  initialFilter = 'all',
}: ResultReviewProps) {
  // Opened from a "Review mistakes" link: the first mistake is open from the
  // first render, and the effect below fetches it.
  const [initialQuestion] = useState(() =>
    initialFilter === 'mistakes'
      ? modules.flatMap((module) => module.questions).find(isMistake) ?? null
      : null
  );
  const [filter, setFilter] = useState<ReviewFilter>(initialQuestion ? 'mistakes' : 'all');
  const [openQuestionId, setOpenQuestionId] = useState<string | null>(initialQuestion?.id ?? null);
  const [detail, setDetail] = useState<RevealedQuestion | null>(null);
  const [error, setError] = useState<ReviewError | null>(null);
  const [, startTransition] = useTransition();

  const flatQuestions = useMemo(
    () => modules.flatMap((module) => module.questions),
    [modules]
  );
  const mistakes = useMemo(() => flatQuestions.filter(isMistake), [flatQuestions]);
  const isModular = modules.length > 1;
  const showOnlyMistakes = filter === 'mistakes';
  // Previous and Next walk this list, so "Mistakes" steps from one to the next.
  const shownQuestions = showOnlyMistakes ? mistakes : flatQuestions;
  // Only the statuses shown, each with its count.
  const legend = STATUS_ORDER.map((status) => ({
    status,
    count: shownQuestions.filter((question) => question.status === status).length,
  })).filter((item) => item.count > 0);

  // The request the student made last. A slower earlier one must not paint
  // over it - not even one for the same question, which a double click or
  // Try again can leave in flight next to it.
  const latestRequestRef = useRef(0);

  const loadQuestion = useCallback(
    (question: ReviewQuestion) => {
      const request = ++latestRequestRef.current;

      startTransition(async () => {
        // A rejection must not escape this callback: React rethrows it from
        // the transition into the nearest error boundary - the dashboard's
        // error page - so one failed request would replace the whole result
        // page, score and all, with "This page didn't load".
        let response: Awaited<ReturnType<typeof revealResultQuestion>>;
        try {
          response = await revealResultQuestion(resultId, question.id);
        } catch (caught) {
          if (latestRequestRef.current !== request) return;

          // A page opened before a deploy asks for an action id the new
          // build no longer has. Only a reload brings the matching one. Other
          // failures are usually the network, but a lost session lands here
          // too, so the message leaves room for a reload.
          setError(
            unstable_isUnrecognizedActionError(caught)
              ? { message: 'The site was updated since you opened this page.', canRetry: false }
              : { message: 'Could not open this question. Try again, or reload the page if it keeps failing.', canRetry: true }
          );
          return;
        }

        if (latestRequestRef.current !== request) return;

        // Closed: a page opened before the test became an olympiad, or before
        // the admin moved its window. The server sent nothing but the time.
        if (response.error) setError({ message: response.error, canRetry: !response.closed, closed: response.closed });
        else setDetail(response.question ?? null);
      });
    },
    [resultId]
  );

  const openQuestion = useCallback(
    (question: ReviewQuestion) => {
      setOpenQuestionId(question.id);
      setDetail(null);
      setError(null);
      loadQuestion(question);
    },
    [loadQuestion]
  );

  useEffect(() => {
    if (initialQuestion) loadQuestion(initialQuestion);
  }, [initialQuestion, loadQuestion]);

  const close = useCallback(() => {
    latestRequestRef.current += 1;
    setOpenQuestionId(null);
    setDetail(null);
    setError(null);
  }, []);

  const changeFilter = useCallback(
    (next: ReviewFilter) => {
      setFilter(next);
      // Into "Mistakes" with a right answer open, or nothing: the first
      // mistake, which is where the student was headed.
      if (next === 'mistakes' && !mistakes.some((question) => question.id === openQuestionId) && mistakes[0]) {
        openQuestion(mistakes[0]);
      }
    },
    [mistakes, openQuestionId, openQuestion]
  );

  useEffect(() => {
    const showMistakes = () => changeFilter('mistakes');
    window.addEventListener(REVIEW_MISTAKES_EVENT, showMistakes);
    return () => window.removeEventListener(REVIEW_MISTAKES_EVENT, showMistakes);
  }, [changeFilter]);

  const openIndex = openQuestionId
    ? shownQuestions.findIndex((question) => question.id === openQuestionId)
    : -1;
  const current = openIndex >= 0 ? shownQuestions[openIndex] : null;
  const previous = openIndex > 0 ? shownQuestions[openIndex - 1] : null;
  const next =
    openIndex >= 0 && openIndex < shownQuestions.length - 1
      ? shownQuestions[openIndex + 1]
      : null;

  const totalCount = flatQuestions.length;
  const nextLabel = showOnlyMistakes ? 'Next mistake' : 'Next';

  return (
    // The open question moves beside the numbers once the card is wide
    // enough for both: on a laptop the student no longer scrolls between them.
    // scroll-mt clears the phone's sticky header when a link lands here.
    // tabIndex -1: the hero's "Review mistakes" moves focus here. Only a
    // script can focus it, so it never becomes a Tab stop of its own.
    <Card
      as="section"
      id={REVIEW_ANCHOR_ID}
      tabIndex={-1}
      aria-label="Question review"
      className="@container scroll-mt-20 focus:outline-hidden md:scroll-mt-6"
    >
      <CardHeader
        title="Question review"
        description={
          isModular
            ? `${modules.length} modules, ${totalCount} questions.`
            : `${totalCount} ${totalCount === 1 ? 'question' : 'questions'}.`
        }
        actions={
          // Only when it narrows something: not when every answer, or none,
          // is a mistake.
          mistakes.length > 0 && mistakes.length < totalCount ? (
            <div role="group" aria-label="Questions to show" className={segmentedClass}>
              {(['all', 'mistakes'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filter === value}
                  onClick={() => changeFilter(value)}
                  className={segmentClass(filter === value)}
                >
                  {value === 'all' ? 'All' : 'Mistakes'}
                  <span className="tabular-nums text-mist-500">{value === 'all' ? totalCount : mistakes.length}</span>
                </button>
              ))}
            </div>
          ) : null
        }
      />

      <div className="@4xl:grid @4xl:grid-cols-[17rem_minmax(0,1fr)]">
        <div className="space-y-4 p-5 @4xl:border-r @4xl:border-mist-100">
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-mist-600">
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

          {modules.map((module) => {
            const questions = showOnlyMistakes ? module.questions.filter(isMistake) : module.questions;
            if (questions.length === 0) return null;

            return (
              <div key={module.index} className="space-y-2">
                {isModular && (
                  <h3 className="text-xs font-medium text-mist-500">Module {module.index}</h3>
                )}

                <div className="flex flex-wrap gap-2">
                  {questions.map((question) => (
                    <button
                      key={question.id}
                      type="button"
                      onClick={() => openQuestion(question)}
                      aria-pressed={question.id === openQuestionId}
                      aria-label={`${isModular ? `Module ${module.index}, question` : 'Question'} ${question.number}: ${STATUS_LABEL[question.status]}`}
                      className={cn(
                        // A finger, not a narrow window, needs the bigger target:
                        // pointer-coarse, as the buttons step up (Button.tsx).
                        'relative h-9 w-9 rounded-lg border text-sm font-medium tabular-nums transition-colors pointer-coarse:h-10 pointer-coarse:w-10',
                        'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-board-600',
                        STATUS_TONE[question.status],
                        STATUS_HOVER[question.status],
                        // The open question wears the same dark ring as "you are
                        // here" in the exam's navigator.
                        question.id === openQuestionId && 'ring-2 ring-mist-900 ring-offset-2'
                      )}
                    >
                      {question.number}
                      <StatusGlyph status={question.status} />
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {current ? (
          /* print:hidden is a second lock, not the first one: the question is
             only ever in the DOM while it is open, so a print of this page is
             empty here either way. */
          <section className="min-w-0 border-t border-mist-100 @4xl:border-t-0 print:hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-mist-100 px-5 py-3">
              {/* Live: Previous and Next change the question under a
                  screen reader's cursor, and it should hear which one it is. */}
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1" aria-live="polite" aria-atomic="true">
                <h3 className="text-sm font-semibold text-mist-900">
                  {isModular && `Module ${current.moduleIndex} · `}
                  Question {current.number}
                </h3>
                <StatusBadge status={current.status} credit={current.credit} />
                {showOnlyMistakes && (
                  <span className="text-xs tabular-nums text-mist-500">
                    Mistake {openIndex + 1} of {mistakes.length}
                  </span>
                )}
              </div>
              {/* aria-disabled, not disabled, at either end: a disabled
                  button drops keyboard focus to the page, and a student
                  pressing Next through their mistakes lost their place. */}
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => previous && openQuestion(previous)}
                  aria-disabled={!previous || undefined}
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="max-sm:sr-only">Previous</span>
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => next && openQuestion(next)}
                  aria-disabled={!next || undefined}
                >
                  <span className="max-sm:sr-only">Next</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                {/* Outlined like Previous and Next beside it: a bare X read as
                    a mark, not a button. */}
                <IconButton variant="secondary" size="sm" onClick={close} aria-label="Close question">
                  <X className="h-4 w-4" />
                </IconButton>
              </div>
            </div>

            <div className="p-5">
              {/* Open, and neither here nor failed: on its way. */}
              {!detail && !error && (
                <div className="flex items-center justify-center gap-2 py-12 text-sm text-mist-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Opening question {current.number}
                </div>
              )}

              {error?.closed && <Alert>{error.message}</Alert>}

              {error && !error.closed && (
                <Alert
                  tone="danger"
                  action={
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => (error.canRetry ? openQuestion(current) : window.location.reload())}
                    >
                      <RotateCw className="h-4 w-4" />
                      {error.canRetry ? 'Try again' : 'Reload page'}
                    </Button>
                  }
                >
                  {error.message}
                </Alert>
              )}

              {detail && (
                /* select-none on the question itself: the student is reviewing
                   their own mistakes, not collecting the paper. Their own answer
                   and the key below stay selectable. */
                <div className="space-y-5">
                  <div className="select-none space-y-4">
                    {detail.imageUrl && (
                      <div className={cn(insetClass, 'inline-block p-2')}>
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
                      className="text-sm leading-relaxed text-mist-700"
                      dangerouslySetInnerHTML={{ __html: detail.contentHtml }}
                    />
                  </div>

                  {detail.optionsHtml.length > 0 ? (
                    <ReviewOptions detail={detail} />
                  ) : (
                    <AnswerPair
                      userAnswerHtml={detail.userAnswerHtml}
                      correctAnswerHtml={detail.correctAnswerHtml}
                      credit={detail.credit}
                      className="border-t border-mist-100 pt-5"
                    />
                  )}

                  {/* No explanation and no video after the answers: the
                      owner's rule is the correct answer and the student's
                      own, not a worked solution (revealResultQuestion does
                      not send either). */}
                </div>
              )}
            </div>

            {/* A wrong key or a broken diagram is reported from the question
                itself, and the message already names it. Next is repeated
                here: it is where the student is once they have read it all. */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-mist-100 px-5 py-3">
              <a
                href={reportProblemHref(testTitle, current, isModular)}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClass({ variant: 'secondary', size: 'sm' })}
              >
                <Flag className="h-4 w-4" />
                Report a problem
                <span className="sr-only"> with this question (opens Telegram)</span>
              </a>
              {/* Kept, greyed, on the last one: removing the button that
                  has focus sends the keyboard back to the top of the page. */}
              <Button variant="secondary" size="sm" onClick={() => next && openQuestion(next)} aria-disabled={!next || undefined}>
                {nextLabel}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </section>
        ) : (
          // Where the question will open, at its place: a dashed panel, not
          // a line of centred grey text.
          <div className="border-t border-mist-100 p-5 @4xl:border-t-0">
            <EmptyState
              icon={<MousePointerClick />}
              title="No question open"
              description="Choose a number to see the question with your answer and the correct one."
              className="@4xl:h-full @4xl:justify-center"
            />
          </div>
        )}
      </div>
    </Card>
  );
}

/**
 * The review card of an olympiad attempt while the olympiad has not ended.
 * The page sends no question chips with it: which of the student's answers
 * were right would hand out the key to a second attempt as surely as the key
 * itself (getReviewOpensAt). `opens` is formatReviewOpens's sentence. Same id
 * as the open review, so a `#review` link still lands here.
 */
export function ClosedReview({ opens }: { opens: string }) {
  return (
    <Card
      as="section"
      id={REVIEW_ANCHOR_ID}
      tabIndex={-1}
      aria-label="Question review"
      className="scroll-mt-20 focus:outline-hidden md:scroll-mt-6"
    >
      <CardHeader title="Question review" />
      <div className="p-5">
        <EmptyState icon={<Lock />} title="Closed until the olympiad is over" description={opens} />
      </div>
    </Card>
  );
}

/**
 * "Your answer / Correct answer" in words: a grid-in question, or a choice
 * question whose answer or key names no letter. `userAnswerHtml` null leaves
 * the first half out; an empty string is "Not answered".
 */
function AnswerPair({
  userAnswerHtml,
  correctAnswerHtml,
  credit,
  className,
}: {
  userAnswerHtml: string | null;
  correctAnswerHtml: string | null;
  credit: number;
  className?: string;
}) {
  return (
    <dl className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2', className)}>
      {userAnswerHtml !== null && (
        <div>
          <dt className="text-xs font-medium text-mist-500">Your answer</dt>
          {userAnswerHtml ? (
            <dd
              className={cn('mt-1 text-base font-semibold', credit > 0 ? 'text-lime-800' : 'text-red-700')}
              dangerouslySetInnerHTML={{ __html: userAnswerHtml }}
            />
          ) : (
            <dd className="mt-1 text-base font-semibold text-mist-500">Not answered</dd>
          )}
        </div>
      )}
      {correctAnswerHtml && (
        <div>
          <dt className="text-xs font-medium text-mist-500">Correct answer</dt>
          <dd
            className="mt-1 text-base font-semibold text-mist-900"
            dangerouslySetInnerHTML={{ __html: correctAnswerHtml }}
          />
        </div>
      )}
    </dl>
  );
}

const OPTION_LETTERS = 'ABCDEFGH';

/** Under the choice's text on a phone, at the row's end once there is room. */
const optionBadgeClass = 'col-start-2 justify-self-start @md:col-start-auto @md:justify-self-end';

/**
 * The answer choices as the exam showed them, read-only, with the student's
 * pick and the key marked on them. A grid-in question keeps the plain
 * "Your answer / Correct answer" pair instead.
 */
function ReviewOptions({ detail }: { detail: RevealedQuestion }) {
  const picked = new Set(detail.userLetters);
  const right = new Set(detail.correctLetters);
  // An answer or a key that names no choice - the question was edited into a
  // choice question after this attempt, or its key is written out - is still
  // shown, in words: the choices alone would say "Not answered" over a typed
  // answer, and mark no choice right.
  const unmatchedAnswer = picked.size === 0 && detail.userAnswerHtml ? detail.userAnswerHtml : null;
  const unmatchedKey = right.size === 0 ? detail.correctAnswerHtml : null;

  return (
    <div className="space-y-2 border-t border-mist-100 pt-5">
      {!detail.userAnswerHtml && <p className="text-sm font-medium text-mist-600">Not answered</p>}
      <ol className="select-none space-y-2">
        {detail.optionsHtml.map((html, index) => {
          const letter = OPTION_LETTERS[index];
          const isRight = right.has(letter);
          const isPicked = picked.has(letter);
          const isWrongPick = isPicked && !isRight;

          return (
            <li
              key={letter}
              className={cn(
                // Two columns on a phone, the badge under the choice: beside
                // it, a sentence-long choice was squeezed into ~110px. The
                // card is the container (@container on the review).
                'grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5 rounded-xl border px-4 py-3 text-sm @md:grid-cols-[auto_minmax(0,1fr)_auto]',
                isRight
                  ? 'border-lime-700 bg-lime-50'
                  : isWrongPick
                    ? 'border-red-600 bg-red-50'
                    : 'border-mist-200',
              )}
            >
              <span
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                  isRight
                    ? 'border-lime-700 bg-lime-700 text-white'
                    : isWrongPick
                      ? 'border-red-600 bg-red-600 text-white'
                      : 'border-mist-300 text-mist-600',
                )}
              >
                {letter}
              </span>
              {/* From `renderMathHtml`, like the stem. */}
              <span className="min-w-0 break-words text-mist-900" dangerouslySetInnerHTML={{ __html: html }} />
              {isPicked && (
                <Badge tone={isRight ? 'success' : 'danger'} className={optionBadgeClass}>
                  {isRight ? <CheckCircle2 /> : <XCircle />}
                  Your answer
                  {/* The icon says right or wrong to the eye; on a multi-select
                      two picks can differ, so it is said out loud too. */}
                  <span className="sr-only">{isRight ? ', correct' : ', incorrect'}</span>
                </Badge>
              )}
              {isRight && !isPicked && (
                <Badge tone="success" className={optionBadgeClass}>
                  <Check />
                  Correct answer
                </Badge>
              )}
            </li>
          );
        })}
      </ol>
      {(unmatchedAnswer || unmatchedKey) && (
        <AnswerPair
          userAnswerHtml={unmatchedAnswer}
          correctAnswerHtml={unmatchedKey}
          credit={detail.credit}
          className="pt-3"
        />
      )}
    </div>
  );
}
