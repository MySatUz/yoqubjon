import { estimateSatMathScore } from '@/lib/satScoring';
import { formatCreditTotal } from '@/lib/resultAnswers';

/**
 * How a score estimate is shown to a student: the result page, Results, the
 * profile and the Practice home all read from here, so one attempt reads the
 * same everywhere. Free of Prisma and React - client components import it too.
 */

export const SAT_SCORE_MIN = 200;
export const SAT_SCORE_MAX = 800;

/**
 * A score estimate from fewer questions than this is noise, not a score: on a
 * three-question check one answer moves the 200-800 scale by 200 points, and
 * the result still looked as precise as a full module's. Below it an attempt is
 * reported as "2 of 3 correct" and kept out of averages and best scores.
 */
export const MIN_QUESTIONS_FOR_SCORE = 10;

export function hasScoreEstimate(questionCount: number) {
  return questionCount >= MIN_QUESTIONS_FOR_SCORE;
}

/** Questions either way the likely range allows for. */
const RANGE_MARGIN_QUESTIONS = 2;

/**
 * The band a score is likely to fall in: the same estimate two questions
 * either way, so it is wide on a short test and narrow on a long one without
 * a separate rule. `estimateSatMathScore` bounds the count, which keeps the
 * band inside 200-800. The stored score is always inside it - an attempt
 * scored by an older formula keeps the number it was given.
 */
export function likelyScoreRange(correct: number, questionCount: number, score: number) {
  return {
    low: Math.min(score, estimateSatMathScore(correct - RANGE_MARGIN_QUESTIONS, questionCount)),
    high: Math.max(score, estimateSatMathScore(correct + RANGE_MARGIN_QUESTIONS, questionCount)),
  };
}

/** Where a score sits on the 200-800 scale, as a percentage for a CSS `left`. */
export function scorePercent(score: number) {
  const bounded = Math.min(SAT_SCORE_MAX, Math.max(SAT_SCORE_MIN, score));
  return ((bounded - SAT_SCORE_MIN) / (SAT_SCORE_MAX - SAT_SCORE_MIN)) * 100;
}

/** `+40`, `−20` (a real minus sign: a hyphen reads as a dash), `0`. */
export function formatSignedDelta(delta: number) {
  const rounded = Number(delta.toFixed(2));
  if (rounded > 0) return `+${formatCreditTotal(rounded)}`;
  if (rounded < 0) return `−${formatCreditTotal(-rounded)}`;
  return '0';
}

/** `17 of 22`. Credit, not a count: a part-right multi-select makes it 17.5. */
export function formatCorrectOf(correct: number, questionCount: number) {
  return `${formatCreditTotal(correct)} of ${questionCount}`;
}

/** `560–640`, with an en dash. */
export function formatScoreRange({ low, high }: { low: number; high: number }) {
  return low === high ? String(low) : `${low}–${high}`;
}
