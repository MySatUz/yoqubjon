import React from 'react';
import { BlockMath, InlineMath } from 'react-katex';

type MathToken =
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

function tokenizeMathText(text: string) {
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

function renderPlainText(value: string, keyPrefix: string) {
  return value.split('\n').map((line, index, lines) => (
    <React.Fragment key={`${keyPrefix}-${index}`}>
      {line}
      {index < lines.length - 1 && <br />}
    </React.Fragment>
  ));
}

function renderMathError(value: string) {
  return <span className="font-mono text-red-600">{value}</span>;
}

export function renderMathText(text: string) {
  if (!text) return null;

  return tokenizeMathText(text).map((token, index) => {
    if (token.type === 'inlineMath') {
      return (
        <InlineMath key={index} renderError={() => renderMathError(token.value)}>
          {token.value}
        </InlineMath>
      );
    }

    if (token.type === 'blockMath') {
      return (
        <BlockMath key={index} renderError={() => renderMathError(token.value)}>
          {token.value}
        </BlockMath>
      );
    }

    return <span key={index}>{renderPlainText(token.value, `text-${index}`)}</span>;
  });
}
