/**
 * Splits question text into plain-text and maths segments.
 *
 * Both renderers share this module so the React path (`renderMathText`, used by
 * the server-rendered PDF and results pages) and the HTML-string path
 * (`renderMathHtml`, used by the exam page) can never drift apart.
 *
 * Deliberately free of any `react` / `katex` import: it is pulled into both a
 * client-usable module and a server-only one.
 */

export type MathToken =
  | { type: 'text'; value: string }
  | { type: 'inlineMath' | 'blockMath'; value: string };

function isEscaped(value: string, index: number) {
  let slashCount = 0;
  for (let i = index - 1; i >= 0 && value[i] === '\\'; i--) {
    slashCount++;
  }
  return slashCount % 2 === 1;
}

function findClosingDelimiter(value: string, delimiter: string, startIndex: number) {
  let index = startIndex;
  while (index < value.length) {
    const foundIndex = value.indexOf(delimiter, index);
    if (foundIndex === -1) return -1;
    if (!isEscaped(value, foundIndex)) return foundIndex;
    index = foundIndex + delimiter.length;
  }
  return -1;
}

export function tokenizeMathText(text: string) {
  const tokens: MathToken[] = [];
  let index = 0;
  let textStart = 0;

  function pushText(endIndex: number) {
    if (endIndex > textStart) {
      tokens.push({ type: 'text', value: text.slice(textStart, endIndex) });
    }
  }

  while (index < text.length) {
    if (text.startsWith('\\[', index)) {
      const end = findClosingDelimiter(text, '\\]', index + 2);
      if (end === -1) break;
      pushText(index);
      tokens.push({ type: 'blockMath', value: text.slice(index + 2, end) });
      index = end + 2;
      textStart = index;
      continue;
    }

    if (text.startsWith('\\(', index)) {
      const end = findClosingDelimiter(text, '\\)', index + 2);
      if (end === -1) break;
      pushText(index);
      tokens.push({ type: 'inlineMath', value: text.slice(index + 2, end) });
      index = end + 2;
      textStart = index;
      continue;
    }

    if (text.startsWith('$$', index) && !isEscaped(text, index)) {
      const end = findClosingDelimiter(text, '$$', index + 2);
      if (end === -1) break;
      pushText(index);
      tokens.push({ type: 'blockMath', value: text.slice(index + 2, end) });
      index = end + 2;
      textStart = index;
      continue;
    }

    if (text[index] === '$' && !isEscaped(text, index)) {
      const end = findClosingDelimiter(text, '$', index + 1);
      if (end === -1) break;
      pushText(index);
      tokens.push({ type: 'inlineMath', value: text.slice(index + 1, end) });
      index = end + 1;
      textStart = index;
      continue;
    }

    index++;
  }

  pushText(text.length);
  return tokens;
}

/** `\$` and `\%` are LaTeX escapes; outside maths they are read as plain characters. */
export function unescapePlainText(value: string) {
  return value.replace(/\\([$%])/g, '$1');
}
