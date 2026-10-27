'use client';

import type { ReactNode } from 'react';
import { ArrowUp, Check, CircleDot, Minus, X, type LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { linkClass } from '@/components/ui/Button';
import { cardClass } from '@/components/ui/Card';
import { cn } from '@/components/ui/cn';
import { formatDuration } from '@/lib/olympiad';
import { useWarmupEcho } from '@/lib/landing/hooks';
import {
  QUESTIONS,
  answerLabel,
  countCorrect,
  totalTime,
  type AnswerStatus,
  type WarmupAnswer,
} from '@/lib/landing/warmup';

/*
 * The review, built from the student's own warm-up as soon as there is one —
 * live while they answer, then from sessionStorage — and from a labelled
 * example until then. The chips use the result page's own colours and corner
 * glyphs, so this reads as the app rather than as an illustration of it.
 *
 * No score tile: three questions do not make a score estimate, and an empty
 * "— — —" read as a broken block. The footer line says where one comes from.
 * Times are written the way the result page writes them (formatDuration).
 *
 * The rows do not open into an explanation: the app's review shows the
 * correct answer and the student's own and no worked solution (the owner's
 * rule), so the example promises exactly that.
 */

// Shown until the visitor has answered anything.
const EXAMPLE: WarmupAnswer[] = [
  { q: 0, status: 'incorrect', given: 'C', ms: 52000 },
  { q: 1, status: 'correct', given: '-2', ms: 70000 },
  { q: 2, status: 'incorrect', given: 'C', ms: 91000 },
];

type ChipStatus = AnswerStatus | 'partial';

// The same tones and glyphs as ResultReview's question chips: a mistake is
// the solid one, and each status carries a glyph besides its colour.
const CHIP_TONE: Record<ChipStatus, string> = {
  incorrect: 'border-red-600 bg-red-600 text-white',
  correct: 'border-green-700 bg-white text-green-800',
  partial: 'border-dashed border-green-700 bg-white text-green-800',
  skipped: 'border-gray-400 bg-gray-100 text-gray-600',
};

const CHIP_GLYPH: Record<ChipStatus, { icon: LucideIcon; tone: string }> = {
  incorrect: { icon: X, tone: 'text-red-600 ring-red-600' },
  correct: { icon: Check, tone: 'text-green-700 ring-green-700' },
  partial: { icon: CircleDot, tone: 'text-green-700 ring-green-700' },
  skipped: { icon: Minus, tone: 'text-gray-500 ring-gray-400' },
};

const STATUS_WORD: Record<AnswerStatus, string> = {
  correct: 'Correct',
  incorrect: 'Incorrect',
  skipped: 'Not answered',
};

function Chip({ status, children }: { status: ChipStatus; children: ReactNode }) {
  const { icon: Icon, tone } = CHIP_GLYPH[status];
  return (
    <span
      className={cn(
        'relative grid h-7 w-7 place-items-center rounded-lg border text-xs font-medium tabular-nums',
        CHIP_TONE[status],
      )}
    >
      {children}
      <span
        aria-hidden="true"
        className={cn('absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white ring-1', tone)}
      >
        <Icon className="h-2.5 w-2.5" strokeWidth={3} />
      </span>
    </span>
  );
}

// Static rows: the chip, the topic with the answers, the time.
const rowGrid = 'grid w-full grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 border-t border-gray-100 px-4 py-3 text-left';

const seconds = (ms: number) => formatDuration(ms / 1000);

export default function ReviewEcho() {
  const { live, stored } = useWarmupEcho();

  const fromThisVisit = live.answers.length > 0;
  const answers = fromThisVisit ? live.answers : stored?.answers.length ? stored.answers : EXAMPLE;
  const mine = answers !== EXAMPLE;
  const correct = countCorrect(answers);

  return (
    <div className={cn(cardClass, 'mt-8 max-w-3xl overflow-hidden')}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <h3 className="text-base font-semibold text-gray-900">
          {mine ? 'Your warm-up review' : 'Example review'}
        </h3>
        {mine ? (
          // A stored run can be hours old (sessionStorage lasts as long as the
          // tab), so only the live one is "a minute ago".
          <Badge tone="accent">{fromThisVisit ? 'That was you, a minute ago.' : 'From earlier in this tab'}</Badge>
        ) : (
          <a href="#warmup-card" className={cn(linkClass, 'inline-flex items-center gap-1 text-sm')}>
            Try these three yourself
            <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        )}
      </div>

      <dl className="grid grid-cols-2 border-t border-gray-100">
        <div className="min-w-0 px-4 py-3">
          <dt className="text-xs text-gray-500">Accuracy</dt>
          <dd className="text-xl font-semibold tracking-tight tabular-nums text-gray-900 sm:text-2xl">
            {correct}/{answers.length}
          </dd>
        </div>
        <div className="min-w-0 border-l border-gray-100 px-4 py-3">
          <dt className="text-xs text-gray-500">Time</dt>
          <dd className="text-xl font-semibold tracking-tight tabular-nums text-gray-900 sm:text-2xl">
            {seconds(totalTime(answers))}
          </dd>
        </div>
      </dl>

      <ul>
        {answers.map((answer, index) => {
          const question = QUESTIONS[answer.q];
          const word = STATUS_WORD[answer.status];
          const you = answerLabel(question, answer.given);
          const meta =
            answer.status === 'correct'
              ? `${word} · ${you}`
              : answer.status === 'skipped'
                ? `${word} · Correct: ${question.correctLabel}`
                : `${word} · You: ${you} · Correct: ${question.correctLabel}`;

          return (
            <li key={`${answer.q}-${index}`} className={rowGrid}>
              <Chip status={answer.status}>Q{answer.q + 1}</Chip>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-gray-900">{question.topic}</span>
                <span className="block text-sm text-gray-500">{meta}</span>
              </span>
              <span className="whitespace-nowrap text-sm tabular-nums text-gray-500">{seconds(answer.ms)}</span>
            </li>
          );
        })}
        {/* The app also scores multi-select questions with partial credit;
            the warm-up has none, so this row stays an example. */}
        <li className={rowGrid}>
          <Chip status="partial">Q4</Chip>
          <span className="min-w-0">
            <span className="block text-sm font-medium text-gray-900">Example · multi-select</span>
            <span className="block text-sm text-gray-500">Partial credit · You: A, C · Correct: A, C, D</span>
          </span>
          <span className="whitespace-nowrap text-sm tabular-nums text-gray-500">{seconds(65000)}</span>
        </li>
      </ul>

      <p className="border-t border-gray-100 px-4 py-3 text-sm text-gray-500">
        Every finished test gets a review like this, and a full test a score estimate on the 200–800 scale. On any
        plan.
      </p>
    </div>
  );
}
