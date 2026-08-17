import React from 'react';
import { BlockMath, InlineMath } from 'react-katex';
import { tokenizeMathText, unescapePlainText } from '@/lib/mathTokens';

/**
 * React renderer for question maths, used by the *server* components only
 * (`/exam/[id]/pdf`, `/dashboard/results/[id]`), where `react-katex` runs
 * during the render and never reaches the browser bundle.
 *
 * The exam page uses `@/lib/renderMathHtml` instead, which produces the same
 * markup as a string. Both share the tokenizer in `@/lib/mathTokens`, so a
 * change to the delimiter handling applies to both. Do not import this module
 * from a client component - it pulls `katex` in with it.
 */

function renderPlainText(value: string, keyPrefix: string) {
  const readableValue = unescapePlainText(value);

  return readableValue.split('\n').map((line, index, lines) => (
    <React.Fragment key={`${keyPrefix}-${index}`}>
      {line}
      {index < lines.length - 1 && <br />}
    </React.Fragment>
  ));
}

function renderMathError(value: string) {
  return <span className="font-mono text-red-600">{value}</span>;
}

/** Rough upper bound for both caches - one test never comes close to it. */
const MATH_CACHE_LIMIT = 500;

const MATH_ERROR_RENDERERS = new Map<string, () => React.ReactElement>();

/**
 * `react-katex` memoises its output on `[formula, errorColor, renderError]`, so
 * an inline arrow here would re-run `katex.renderToString` on every render.
 * One renderer per formula keeps that reference stable.
 */
function getMathErrorRenderer(value: string) {
  let renderer = MATH_ERROR_RENDERERS.get(value);
  if (!renderer) {
    renderer = () => renderMathError(value);
    if (MATH_ERROR_RENDERERS.size >= MATH_CACHE_LIMIT) MATH_ERROR_RENDERERS.clear();
    MATH_ERROR_RENDERERS.set(value, renderer);
  }
  return renderer;
}

/** Tokenising and the element tree only depend on the text, so both are reused. */
const MATH_TEXT_CACHE = new Map<string, React.ReactNode>();

export function renderMathText(text: string) {
  if (!text) return null;

  const cached = MATH_TEXT_CACHE.get(text);
  if (cached !== undefined) return cached;

  const nodes = tokenizeMathText(text).map((token, index) => {
    if (token.type === 'inlineMath') {
      return (
        <InlineMath key={index} renderError={getMathErrorRenderer(token.value)}>
          {token.value}
        </InlineMath>
      );
    }

    if (token.type === 'blockMath') {
      return (
        <BlockMath key={index} renderError={getMathErrorRenderer(token.value)}>
          {token.value}
        </BlockMath>
      );
    }

    return <span key={index}>{renderPlainText(token.value, `text-${index}`)}</span>;
  });

  if (MATH_TEXT_CACHE.size >= MATH_CACHE_LIMIT) MATH_TEXT_CACHE.clear();
  MATH_TEXT_CACHE.set(text, nodes);

  return nodes;
}
