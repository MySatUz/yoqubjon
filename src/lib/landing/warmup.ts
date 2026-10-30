/**
 * The landing's three-question warm-up: the questions, how an answer is
 * checked, and where a run is kept. Nothing here leaves the browser — the hero
 * promises "Your answers stay on this page", so a finished run goes to
 * sessionStorage and nowhere else.
 *
 * Free of React on purpose: the warm-up card, the review echo, the sticky bar
 * and the sign-up chip all read from here, and none of them should have to
 * import another one to do it.
 */

import { formatDuration } from '@/lib/olympiad';

/** The real minus sign, U+2212. A hyphen in a maths answer reads as a dash. */
export const MINUS = '−';

/** 35 minutes for 22 questions on the real Digital SAT Math module. */
export const PER_QUESTION_SECONDS = 95;

/** Shared links point at the production domain, never at a preview deploy. */
export const SITE_URL = 'https://www.slope.uz';

/** Support contact, the same one the footer lists for Mr Yoqubjon. */
export const TELEGRAM_URL = 'https://t.me/Yokubjon_Isaqjonov';
export const TELEGRAM_HANDLE = `@${TELEGRAM_URL.slice('https://t.me/'.length)}`;

/**
 * Sent on window by the landing's phone menu (SiteNav) as it opens (detail
 * true) and closes: the warm-up clock stops while the menu covers its card.
 */
export const SITE_MENU_EVENT = 'mysat:site-menu';

/** The free offer's one name, on every button that signs a visitor up. */
export const FREE_OFFER_CTA = 'Start my free test';

/**
 * The free offer counted (countFreeTests in freeTests.ts reads the number):
 * "3 free timed Math tests." The short form, "3 free tests.", is for the
 * phone's bottom bar.
 */
export function freeTestsPhrase(count: number, short = false) {
  const noun = count === 1 ? 'test' : 'tests';
  return short ? `${count} free ${noun}.` : `${count} free timed Math ${noun}.`;
}

/* ─────────────────────────────── questions ─────────────────────────────── */

/** A run of maths text: plain strings, italic variables and stacked fractions. */
export type MathPart = string | { v: string } | { frac: [string, string] };
export type MathText = MathPart[];

export type AnswerStatus = 'correct' | 'incorrect' | 'skipped';

interface QuestionBase {
  /** The step chip in the card header: "Warm-up", "No options", "800-type". */
  chip: string;
  /** The row title in the review. */
  topic: string;
  stem: MathText;
  /** Shown for "Not sure? Show me", and in the review when a row is opened. */
  explain: string;
  /** The correct answer as the review prints it. */
  correctLabel: string;
}

export interface ChoiceQuestion extends QuestionBase {
  kind: 'choice';
  /** Two-by-two grid instead of one column. */
  grid: boolean;
  correct: string;
  options: { letter: string; value: MathText; plain: string }[];
  /** One named trap per wrong option, and the "Right." line for the answer. */
  feedback: Record<string, string>;
  /** Q3 draws the parabola and the line through (0, 4) above its options. */
  figure?: boolean;
}

export interface GridInQuestion extends QuestionBase {
  kind: 'grid-in';
  kicker: string;
  equations: MathText[];
  correctValue: number;
  right: string;
  /** Traps keyed by the number the student typed, as `String(number)`. */
  traps: Record<string, string>;
  otherwise: string;
}

export type WarmupQuestion = ChoiceQuestion | GridInQuestion;

// Authored for this page, not taken from College Board material. The maths:
// 23/3, −2, and a sum of 0 — to be checked by a teacher before each change.
export const QUESTIONS: WarmupQuestion[] = [
  {
    kind: 'choice',
    chip: 'Warm-up',
    topic: 'Perpendicular lines',
    grid: true,
    correct: 'B',
    stem: [
      'Line ', { v: 'ℓ' }, ' has slope 3 and passes through (2, 7). Line ', { v: 'k' },
      ' is perpendicular to ', { v: 'ℓ' }, ' and passes through the same point. What is the ',
      { v: 'y' }, '-intercept of line ', { v: 'k' }, '?',
    ],
    options: [
      { letter: 'A', value: ['1'], plain: '1' },
      { letter: 'B', value: [{ frac: ['23', '3'] }], plain: '23/3' },
      { letter: 'C', value: [{ frac: ['19', '3'] }], plain: '19/3' },
      { letter: 'D', value: ['13'], plain: '13' },
    ],
    feedback: {
      A: 'Trap: that’s line ℓ’s intercept. The question asked about k.',
      B: 'Right. Perpendicular slope is −1/3, so b = 7 + 2/3 = 23/3.',
      C: 'Trap: sign slip. −(1/3)(0 − 2) is +2/3, not −2/3.',
      D: 'Trap: you flipped the sign but forgot the reciprocal. Slope −3 gives 13.',
    },
    explain: 'Perpendicular slope is −1/3. Through (2, 7): b = 7 + 2/3 = 23/3.',
    correctLabel: '23/3',
  },
  {
    kind: 'grid-in',
    chip: 'No options',
    topic: 'Systems with no solution',
    kicker: 'On the SAT this is a student-produced response. You can’t guess it.',
    stem: ['For what value of ', { v: 'k' }, ' does this system have no solution?'],
    equations: [
      ['3', { v: 'x' }, ' + ', { v: 'ky' }, ' = 7'],
      ['6', { v: 'x' }, ` ${MINUS} 4`, { v: 'y' }, ' = 11'],
    ],
    correctValue: -2,
    right:
      'Right. No solution means parallel lines. Doubling the first gives 6x + 2ky = 14, so 2k = −4: k = −2. And 14 ≠ 11, so they never meet.',
    traps: {
      '2': 'Trap: sign. 2k has to equal −4, so k = −2.',
      '-4': 'Trap: you matched −4 without scaling. Doubling the first equation gives 6x + 2ky = 14, so 2k = −4: k = −2.',
      '4': 'Two slips: scale first, keep the sign. 2k = −4, so k = −2.',
    },
    otherwise:
      'No solution means parallel lines. Doubling the first gives 6x + 2ky = 14, so 2k = −4: k = −2.',
    explain: 'Parallel lines: 3/6 = k/(−4), so k = −2, and 7/11 ≠ 1/2.',
    correctLabel: `${MINUS}2`,
  },
  {
    kind: 'choice',
    chip: '800-type',
    topic: 'Tangent line',
    grid: false,
    correct: 'B',
    figure: true,
    stem: [
      'The line ', { v: 'y' }, ' = ', { v: 'mx' }, ' + 4, where ', { v: 'm' },
      ' is a constant, intersects the parabola ', { v: 'y' }, ' = ', { v: 'x' },
      '² + 8 at exactly one point. What is the sum of all possible values of ', { v: 'm' }, '?',
    ],
    options: [
      { letter: 'A', value: [`${MINUS}16`], plain: `${MINUS}16` },
      { letter: 'B', value: ['0'], plain: '0' },
      { letter: 'C', value: ['4'], plain: '4' },
      { letter: 'D', value: ['8'], plain: '8' },
    ],
    feedback: {
      A: 'Trap: that’s the product, 4 × (−4). The question asks for the sum.',
      B: 'Right. m² − 16 = 0 gives m = 4 and m = −4, and they cancel. “All possible values” was the trap.',
      C: 'Trap: that’s one tangent. The line can touch on the left too, with m = −4. Sum: 0.',
      D: 'Trap: 4 + 4 counts the same line twice. The other tangent has slope −4. Sum: 0.',
    },
    explain: 'x² − mx + 4 = 0 has one root when m² − 16 = 0: m = 4 or −4. Sum 0.',
    correctLabel: '0',
  },
];

/* ─────────────────────────────── checking ─────────────────────────────── */

/**
 * A typed grid-in answer as stored: the real minus folded into a hyphen and
 * spaces dropped, so "−2", "- 2" and "-2" are one answer.
 */
export function normalizeGridIn(raw: string) {
  return raw.trim().replace(/−/g, '-').replace(/\s/g, '');
}

/** "-2", "-2.0" and "-2/1" are all −2; anything unreadable is NaN. */
export function parseGridIn(raw: string) {
  const value = normalizeGridIn(raw);
  if (/^-?\d+(\.\d+)?\/-?\d+(\.\d+)?$/.test(value)) {
    const [top, bottom] = value.split('/').map(Number);
    return top / bottom;
  }
  return value === '' ? Number.NaN : Number(value);
}

export function checkAnswer(question: WarmupQuestion, given: string | null): AnswerStatus {
  if (given === null) return 'skipped';
  if (question.kind === 'choice') return given === question.correct ? 'correct' : 'incorrect';
  return Math.abs(parseGridIn(given) - question.correctValue) < 1e-9 ? 'correct' : 'incorrect';
}

/** The one line under the options once the student checks or skips. */
export function feedbackFor(question: WarmupQuestion, given: string | null, status: AnswerStatus) {
  if (status === 'skipped' || given === null) return question.explain;
  if (question.kind === 'choice') return question.feedback[given] ?? question.explain;
  if (status === 'correct') return question.right;
  return question.traps[String(parseGridIn(given))] ?? question.otherwise;
}

/* ─────────────────────────────── runs ─────────────────────────────── */

export interface WarmupAnswer {
  /** Index into QUESTIONS. */
  q: number;
  given: string | null;
  status: AnswerStatus;
  /** Time on the question, pauses excluded. */
  ms: number;
}

export interface WarmupRun {
  answers: WarmupAnswer[];
  totalMs: number;
  done: boolean;
}

export interface LiveRun extends WarmupRun {
  /** The question on screen. */
  index: number;
}

export const countCorrect = (answers: WarmupAnswer[]) =>
  answers.filter((answer) => answer.status === 'correct').length;

export const totalTime = (answers: WarmupAnswer[]) =>
  answers.reduce((sum, answer) => sum + answer.ms, 0);

/** A clock reading, rounded up: 94.2 seconds left still shows 1:35. */
export function formatClock(seconds: number) {
  const whole = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

export function verdictFor(correct: number) {
  if (correct === 3) return 'Clean. The real Module 2 asks for that 22 times in 35 minutes.';
  if (correct === 2) return 'One trap got you. At the top of the scale, traps are the whole game.';
  return 'Now you know what the hard end feels like. Better here than in the test center.';
}

/**
 * A Telegram share link carrying `?vs=2-221` for the friend's hero line. The
 * time is written the way the app writes spent time ("3 min 41 s"); the link
 * carries whole seconds, so the friend's line reads the same.
 */
export function challengeLink(correct: number, totalMs: number) {
  const seconds = Math.round(totalMs / 1000);
  const url = `${SITE_URL}/?vs=${correct}-${seconds}`;
  const text = `I got ${correct} of 3 on the slope.uz warm-up in ${formatDuration(seconds)}. The third one is 800-type. Your turn:`;
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
}

/**
 * The hero's line for a friend's challenge link, or null. Anything that does
 * not look like a real run — more than three correct, more than an hour — is
 * ignored rather than shown.
 */
export function friendChallengeLine(search: string, hash: string) {
  const fromQuery = new URLSearchParams(search).get('vs');
  const fromHash = hash.match(/vs-(\d-\d{1,4})/)?.[1];
  const value = fromQuery ?? fromHash;
  if (!value || !/^[0-3]-\d{1,4}$/.test(value)) return null;

  const [correct, seconds] = value.split('-').map(Number);
  if (seconds > 3600) return null;
  return `A friend got ${correct} of 3 in ${formatDuration(seconds)}. Beat it. No sign-up.`;
}

/* ──────────────────────── storage and the live run ──────────────────────── */

const STORAGE_KEY = 'mysat.warmup.v1';
const WARMUP_EVENT = 'mysat:warmup';

const EMPTY_LIVE_RUN: LiveRun = { index: 0, answers: [], totalMs: 0, done: false };

// The run in progress, shared by the islands on one page. It lives in memory
// only: a reload starts the warm-up again from question 1, while a finished
// run keeps echoing from sessionStorage until a new one replaces it.
let liveRun: LiveRun = EMPTY_LIVE_RUN;

function announce() {
  window.dispatchEvent(new Event(WARMUP_EVENT));
}

export function publishLiveRun(run: LiveRun) {
  liveRun = run;
  announce();
}

export const getLiveRun = () => liveRun;
export const getServerLiveRun = () => EMPTY_LIVE_RUN;

export function subscribeWarmup(onChange: () => void) {
  window.addEventListener(WARMUP_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(WARMUP_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

/** Raw stored value; a string, so it can serve as a stable store snapshot. */
export function readStoredRunRaw(): string | null {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage blocked (private mode, in-app browsers): the echoes fall back
    // to the live run, or to the example.
    return null;
  }
}

const isStatus = (value: unknown): value is AnswerStatus =>
  value === 'correct' || value === 'incorrect' || value === 'skipped';

/** Reads a stored run back, dropping anything that is not one. */
export function parseStoredRun(raw: string | null): WarmupRun | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as { v?: unknown; done?: unknown; answers?: unknown; totalMs?: unknown };
    if (data.v !== 1 || !Array.isArray(data.answers)) return null;

    const answers: WarmupAnswer[] = [];
    for (const item of data.answers as Record<string, unknown>[]) {
      const q = Number(item?.q);
      if (!Number.isInteger(q) || q < 0 || q >= QUESTIONS.length || !isStatus(item.status)) return null;
      answers.push({
        q,
        status: item.status,
        given: typeof item.given === 'string' ? item.given : null,
        ms: Math.max(0, Number(item.ms) || 0),
      });
    }

    return {
      answers,
      done: data.done === true,
      totalMs: Math.max(0, Number(data.totalMs) || totalTime(answers)),
    };
  } catch {
    return null;
  }
}

export function saveFinishedRun(answers: WarmupAnswer[], totalMs: number) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, done: true, answers, totalMs }));
  } catch {
    // Storage blocked: the echoes on this page still read the live run.
  }
  announce();
}
