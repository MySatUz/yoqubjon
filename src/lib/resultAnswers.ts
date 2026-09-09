export interface NormalizedAnswer {
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  /**
   * Share of the question the student earned, 0..1. Only a multi-select
   * question can land between the two: everything else scores 0 or 1.
   */
  credit: number;
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value : "";
}

function stripMathWrappers(value: string) {
  let text = value.trim();
  let changed = true;

  while (changed) {
    changed = false;

    const wrappers: Array<[string, string]> = [
      ['\\(', '\\)'],
      ['\\[', '\\]'],
      ['$$', '$$'],
      ['$', '$'],
    ];

    for (const [start, end] of wrappers) {
      if (text.startsWith(start) && text.endsWith(end) && text.length >= start.length + end.length) {
        text = text.slice(start.length, text.length - end.length).trim();
        changed = true;
      }
    }
  }

  return text;
}

function normalizeMinusSigns(value: string) {
  return value
    .replace(/\u2212/g, '-')
    .replace(/[\u2013\u2014]/g, '-');
}

function normalizeComparableAnswer(value: string) {
  return normalizeMinusSigns(stripMathWrappers(value))
    .replace(/\\left|\\right/g, '')
    .replace(/\\([$%])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

type Rational = {
  numerator: bigint;
  denominator: bigint;
};

const BIGINT_ZERO = BigInt(0);
const BIGINT_ONE = BigInt(1);
const BIGINT_NEGATIVE_ONE = BigInt(-1);
const BIGINT_TEN = BigInt(10);

function gcd(a: bigint, b: bigint): bigint {
  let x = a < BIGINT_ZERO ? -a : a;
  let y = b < BIGINT_ZERO ? -b : b;

  while (y !== BIGINT_ZERO) {
    const remainder = x % y;
    x = y;
    y = remainder;
  }

  return x || BIGINT_ONE;
}

function simplifyRational(value: Rational): Rational | null {
  if (value.denominator === BIGINT_ZERO) return null;

  const sign = value.denominator < BIGINT_ZERO ? BIGINT_NEGATIVE_ONE : BIGINT_ONE;
  const numerator = value.numerator * sign;
  const denominator = value.denominator * sign;
  const divisor = gcd(numerator, denominator);

  return {
    numerator: numerator / divisor,
    denominator: denominator / divisor,
  };
}

function parseDecimalNumber(value: string): Rational | null {
  const match = value.match(/^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))$/);
  if (!match) return null;

  const sign = match[1] === '-' ? BIGINT_NEGATIVE_ONE : BIGINT_ONE;
  const integerPart = match[2] || '0';
  const fractionalPart = match[3] ?? match[4] ?? '';
  const digits = `${integerPart}${fractionalPart}`.replace(/^0+(?=\d)/, '') || '0';
  const denominator = BIGINT_TEN ** BigInt(fractionalPart.length);

  return simplifyRational({
    numerator: BigInt(digits) * sign,
    denominator,
  });
}

function parseRationalAnswer(value: string): Rational | null {
  const text = normalizeMinusSigns(stripMathWrappers(value))
    .replace(/\\left|\\right/g, '')
    .replace(/\\,/g, '')
    .replace(/[, $]/g, '')
    .replace(/\s+/g, '');

  const latexFraction = text.match(/^([+-]?)\\(?:dfrac|tfrac|frac)\{([^{}]+)\}\{([^{}]+)\}$/);
  if (latexFraction) {
    const numerator = parseDecimalNumber(latexFraction[2]);
    const denominator = parseDecimalNumber(latexFraction[3]);
    if (!numerator || !denominator || denominator.numerator === BIGINT_ZERO) return null;

    return simplifyRational({
      numerator: numerator.numerator * denominator.denominator * (latexFraction[1] === '-' ? BIGINT_NEGATIVE_ONE : BIGINT_ONE),
      denominator: numerator.denominator * denominator.numerator,
    });
  }

  const fraction = text.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\/([+-]?(?:\d+(?:\.\d*)?|\.\d+))$/);
  if (fraction) {
    const numerator = parseDecimalNumber(fraction[1]);
    const denominator = parseDecimalNumber(fraction[2]);
    if (!numerator || !denominator || denominator.numerator === BIGINT_ZERO) return null;

    return simplifyRational({
      numerator: numerator.numerator * denominator.denominator,
      denominator: numerator.denominator * denominator.numerator,
    });
  }

  return parseDecimalNumber(text);
}

function splitAnswerAlternatives(value: string) {
  const text = value.trim();
  if (!text) return [''];

  const alternatives = text
    .split(/\s+or\s+|[;|]/i)
    .map((option) => stripMathWrappers(option).trim())
    .filter(Boolean);

  return alternatives.length > 0 ? alternatives : [stripMathWrappers(text)];
}

export function normalizeStoredAnswer(
  storedAnswer: unknown,
  fallbackCorrectAnswer: string
): NormalizedAnswer {
  if (
    storedAnswer &&
    typeof storedAnswer === "object" &&
    !Array.isArray(storedAnswer)
  ) {
    const answer = storedAnswer as Record<string, unknown>;
    const userAnswer = normalizeText(answer.userAnswer);
    const correctAnswer = normalizeText(answer.correctAnswer) || fallbackCorrectAnswer;
    const graded = gradeAnswer(userAnswer, correctAnswer);
    // A row written before partial credit existed carries no `credit`, so the
    // stored flag still decides: re-grading alone could only ever demote an
    // answer an older run had accepted.
    const isCorrect =
      typeof answer.isCorrect === "boolean"
        ? answer.isCorrect || graded.isCorrect
        : graded.isCorrect;
    const storedCredit =
      typeof answer.credit === "number" && Number.isFinite(answer.credit)
        ? clampCredit(answer.credit)
        : null;

    return {
      userAnswer,
      correctAnswer,
      isCorrect,
      credit: storedCredit ?? (isCorrect ? 1 : graded.credit),
    };
  }

  const userAnswer = normalizeText(storedAnswer);
  const graded = gradeAnswer(userAnswer, fallbackCorrectAnswer);

  return {
    userAnswer,
    correctAnswer: fallbackCorrectAnswer,
    isCorrect: graded.isCorrect,
    credit: graded.credit,
  };
}

function singleAnswerMatches(userAnswer: string, correctAnswer: string) {
  if (normalizeComparableAnswer(userAnswer) === normalizeComparableAnswer(correctAnswer)) {
    return true;
  }

  const userRational = parseRationalAnswer(userAnswer);
  const correctRational = parseRationalAnswer(correctAnswer);

  return Boolean(
    userRational &&
    correctRational &&
    userRational.numerator === correctRational.numerator &&
    userRational.denominator === correctRational.denominator
  );
}

export function answersMatch(userAnswer: string, correctAnswer: string) {
  const userAlternatives = splitAnswerAlternatives(userAnswer);
  const correctAlternatives = splitAnswerAlternatives(correctAnswer);

  return userAlternatives.some((userOption) =>
    correctAlternatives.some((correctOption) =>
      singleAnswerMatches(userOption, correctOption)
    )
  );
}

/**
 * The letters of a multi-select answer key or selection, e.g. `"B, C"` ->
 * `['B', 'C']`. Null when the value is not a list of option letters at all,
 * which is how a grid-in value stays a value: `1,000` has no letters in it.
 *
 * A key of one letter parses to a one-element list, so `isMultiSelectKey`
 * below - not this function - decides which questions are multi-select. The
 * importer rejects a letter list on a question without `\options{}`, so the
 * shape of the key alone is enough to tell the two apart everywhere else and
 * no caller has to carry the option list around to grade an answer.
 */
export function parseAnswerLetters(value: string): string[] | null {
  const text = normalizeComparableAnswer(value);
  if (!text) return null;

  const letters = text.split(',').map((letter) => letter.trim()).filter(Boolean);
  if (letters.length === 0) return null;
  if (!letters.every((letter) => /^[A-H]$/.test(letter))) return null;

  return letters;
}

/** True for an answer key that names two or more distinct options. */
export function isMultiSelectKey(correctAnswer: string) {
  const letters = parseAnswerLetters(correctAnswer);
  return letters !== null && new Set(letters).size >= 2;
}

/** Sorted, de-duplicated, comma-joined - the one stored form of a letter set. */
export function formatAnswerLetters(letters: Iterable<string>) {
  return [...new Set(letters)].sort().join(',');
}

function clampCredit(value: number) {
  // 4 decimals is past anything a real question can produce (a set of 8
  // correct options gives eighths) and keeps 1/3 out of the stored JSON as
  // 0.3333 rather than seventeen digits.
  return Math.round(Math.min(Math.max(value, 0), 1) * 10000) / 10000;
}

export interface GradedAnswer {
  isCorrect: boolean;
  /** 0..1. Strictly between the two only on a partly right multi-select. */
  credit: number;
}

/**
 * Partial credit on a multi-select question: every right option earns a share,
 * every wrong one gives that share back, and the result never drops below zero.
 *
 *   credit = (chosen right - chosen wrong) / (right options)
 *
 * Subtracting the wrong picks is what makes the scheme worth having. Counting
 * hits alone would hand full marks to a student who ticks every box, so the
 * question would stop measuring anything at all.
 */
function gradeMultiSelect(userAnswer: string, correctLetters: string[]) {
  const correct = new Set(correctLetters);
  if (correct.size === 0) return 0;

  const selected = new Set(parseAnswerLetters(userAnswer) ?? []);
  let chosenRight = 0;
  let chosenWrong = 0;

  for (const letter of selected) {
    if (correct.has(letter)) chosenRight++;
    else chosenWrong++;
  }

  return clampCredit((chosenRight - chosenWrong) / correct.size);
}

/**
 * The single grading entry point. Single-choice and grid-in answers keep going
 * through `answersMatch`, so their behaviour - the fraction and alternative
 * handling above - is untouched.
 */
export function gradeAnswer(userAnswer: string, correctAnswer: string): GradedAnswer {
  const correctLetters = parseAnswerLetters(correctAnswer);

  if (correctLetters && new Set(correctLetters).size >= 2) {
    const credit = gradeMultiSelect(userAnswer, correctLetters);
    return { credit, isCorrect: credit >= 1 };
  }

  const isCorrect = answersMatch(userAnswer, correctAnswer);
  return { credit: isCorrect ? 1 : 0, isCorrect };
}

/**
 * Renders a credit total for a human: `18`, `17.5`, `17.25`. Trailing zeros are
 * dropped so a test without a single multi-select question still reads as a
 * plain count.
 */
export function formatCreditTotal(value: number) {
  return Number(value.toFixed(2)).toString();
}
