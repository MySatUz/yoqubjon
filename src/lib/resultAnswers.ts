export interface NormalizedAnswer {
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
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

function normalizeComparableAnswer(value: string) {
  return stripMathWrappers(value)
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
  const text = stripMathWrappers(value)
    .replace(/\\left|\\right/g, '')
    .replace(/\\,/g, '')
    .replace(/[, $]/g, '')
    .replace(/−/g, '-')
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
    const isCorrect =
      typeof answer.isCorrect === "boolean"
        ? answer.isCorrect
        : answersMatch(userAnswer, correctAnswer);

    return {
      userAnswer,
      correctAnswer,
      isCorrect,
    };
  }

  const userAnswer = normalizeText(storedAnswer);

  return {
    userAnswer,
    correctAnswer: fallbackCorrectAnswer,
    isCorrect: answersMatch(userAnswer, fallbackCorrectAnswer),
  };
}

export function answersMatch(userAnswer: string, correctAnswer: string) {
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
