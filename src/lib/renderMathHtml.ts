import katex from 'katex';
import { tokenizeMathText, unescapePlainText } from '@/lib/mathTokens';

/**
 * Server-side twin of `renderMathText`: same tokenizer, same output, but an
 * HTML string instead of a React tree.
 *
 * The exam page renders question text through this on the server and ships the
 * finished HTML to `SplitScreen`, which only needs `katex.min.css` to display
 * it. That keeps ~293 KB of `katex` JS (~86 KB gzip) out of the exam bundle.
 *
 * The markup is byte-identical to what `renderMathText` produces, down to the
 * `data-testid="react-katex"` wrappers `react-katex` emits, so the exam DOM and
 * every KaTeX CSS selector keep matching exactly what they matched before.
 *
 * Never call this on a value that is not question content, and never enable
 * KaTeX's `trust` option: with the default (`false`) KaTeX refuses
 * `\href{javascript:...}` and friends, which is what keeps a maliciously
 * crafted formula from turning into script in the page.
 */

/**
 * Escapes exactly the characters React escapes in a text node, so a question
 * containing `<script>` stays text after it is injected with
 * `dangerouslySetInnerHTML`. Every plain-text segment MUST pass through here -
 * React is no longer doing it for us.
 */
function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function renderPlainTextHtml(value: string) {
  return `<span>${escapeHtml(unescapePlainText(value)).replace(/\n/g, '<br/>')}</span>`;
}

/** Same fallback as the React path: the raw formula in red monospace. */
function renderMathErrorHtml(value: string) {
  return `<span class="font-mono text-red-600">${escapeHtml(value)}</span>`;
}

function renderFormulaHtml(value: string, displayMode: boolean) {
  let html: string;

  try {
    // `throwOnError: true` is what `react-katex` passes whenever a `renderError`
    // is given, which is how the red fallback below gets its chance to run.
    html = katex.renderToString(value, { displayMode, throwOnError: true });
  } catch {
    return renderMathErrorHtml(value);
  }

  return displayMode
    ? `<div data-testid="react-katex">${html}</div>`
    : `<span data-testid="react-katex">${html}</span>`;
}

export function renderMathHtml(text: string) {
  if (!text) return '';

  let html = '';

  for (const token of tokenizeMathText(text)) {
    if (token.type === 'text') {
      html += renderPlainTextHtml(token.value);
      continue;
    }

    html += renderFormulaHtml(token.value, token.type === 'blockMath');
  }

  return html;
}
