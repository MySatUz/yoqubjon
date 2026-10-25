import { tokenizeMathText } from '@/lib/mathTokens';
import { renderMathHtml } from '@/lib/renderMathHtml';

const PREVIEW_TEXT_BUDGET = 180;

/**
 * The opening of a question as one line of typeset maths, for the rows of the
 * question editor and the per-question stats. Raw TeX ("$\frac{3}{4}x$") was
 * what the admin used to read there.
 *
 * Built from the tokens rather than by cutting the source, so a formula is
 * never split in half, and every formula is set inline: a row has room for
 * one line, not for a centred display block. For server components only -
 * `renderMathHtml` pulls in katex, and the finished HTML is all the browser
 * needs (with katex.min.css on the page).
 */
export function renderQuestionPreview(content: string) {
  let source = '';
  let textLength = 0;

  for (const token of tokenizeMathText(content)) {
    if (textLength >= PREVIEW_TEXT_BUDGET) {
      source += ' …';
      break;
    }

    if (token.type !== 'text') {
      source += `\\(${token.value}\\)`;
      // A formula takes far less room set than its source does.
      textLength += Math.min(token.value.length, 24);
      continue;
    }

    const text = token.value.replace(/\s+/g, ' ');
    const room = PREVIEW_TEXT_BUDGET - textLength;
    if (text.length > room) {
      source += `${text.slice(0, room).trimEnd()} …`;
      break;
    }

    source += text;
    textLength += text.length;
  }

  return renderMathHtml(source.trim());
}
