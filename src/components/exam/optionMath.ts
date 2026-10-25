/**
 * An answer choice that is only a number - `3`, `-12`, `0.75`, `3/4`,
 * `1,200` - written as maths, so it is set in KaTeX like the numbers in the
 * question above it instead of in Inter beside them, and a fraction stands
 * stacked as it does on the test. Anything else is returned untouched: words,
 * units, and choices that already carry their own `\( \)` or `$`.
 *
 * One rule for every place a choice is shown - the exam (through
 * `@/lib/examQuestions`) and the printable PDF - and free of imports, so a
 * server module and a client one can both use it.
 */
const NUMBER = String.raw`(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?|\.\d+`;
const NUMERIC_CHOICE = new RegExp(String.raw`^([-−]?)\s*(${NUMBER})(?:\s*/\s*(${NUMBER}))?$`);

/** `1,200` keeps its comma as a thousands separator: `{,}` stops KaTeX spacing it as punctuation. */
function texNumber(value: string) {
  return value.replace(/,/g, '{,}');
}

export function optionAsMath(option: string) {
  const match = NUMERIC_CHOICE.exec(option.trim());
  if (!match) return option;

  const [, sign, numerator, denominator] = match;
  const minus = sign ? '-' : '';
  const tex = denominator
    ? `${minus}\\dfrac{${texNumber(numerator)}}{${texNumber(denominator)}}`
    : `${minus}${texNumber(numerator)}`;

  return `\\(${tex}\\)`;
}
