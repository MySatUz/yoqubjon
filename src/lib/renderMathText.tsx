import React from 'react';
import { BlockMath, InlineMath } from 'react-katex';

export function renderMathText(text: string) {
  if (!text) return null;

  const parts = text.split(/(\$.*?\$|\\\(.*?\\\)|\\\[.*?\\\])/gs);

  return parts.map((part, index) => {
    if (
      (part.startsWith('$') && part.endsWith('$')) ||
      (part.startsWith('\\(') && part.endsWith('\\)'))
    ) {
      const formula = part.startsWith('$')
        ? part.slice(1, -1)
        : part.slice(2, -2);

      return <InlineMath key={index}>{formula}</InlineMath>;
    }

    if (part.startsWith('\\[') && part.endsWith('\\]')) {
      return <BlockMath key={index}>{part.slice(2, -2)}</BlockMath>;
    }

    return <span key={index}>{part}</span>;
  });
}
