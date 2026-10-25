import React from 'react';
import 'katex/dist/katex.min.css';
import { cn } from '@/components/ui/cn';
import type { MathText as MathTextParts } from '@/lib/landing/warmup';
import math from './math.module.css';

/*
 * Maths on the landing is set in KaTeX's own faces — the ones the exam's
 * questions are rendered in — rather than the system serif (Georgia on
 * Windows). katex.min.css is imported only for its @font-face rules; the
 * `.katex` box itself (1.21em, its own line height) is not used here, so a
 * variable sits in a line of Fira Sans prose the way it does in an exam stem.
 * The faces are named in math.module.css, which says why not in Tailwind.
 */
// KaTeX's own scale: its faces are drawn smaller on the em than Fira Sans, and
// 1.21em is what the exam's `.katex` box uses to match the text around it.
const mathSize = 'text-[1.21em] leading-none';

// "(2, 7)" never breaks after its comma.
const keepPairs = (text: string) => text.replace(/\(([^()\s]+), ([^()\s]+)\)/g, '($1,\u00a0$2)');

/** An italic maths variable, the way a printed SAT sets ℓ, k, m and x. */
export function Var({ children }: { children: React.ReactNode }) {
  return <var className={cn(math.variable, mathSize)}>{children}</var>;
}

/** Digits and operators of a formula, upright in KaTeX_Main. */
export function MathRun({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn(math.upright, mathSize, className)}>{children}</span>;
}

/** A stacked fraction; screen readers get "23/3". */
export function Frac({ top, bottom }: { top: string; bottom: string }) {
  return (
    <>
      <span
        aria-hidden="true"
        className={cn(math.upright, 'mx-px inline-flex flex-col items-center align-middle text-[1.05em] leading-[1.1]')}
      >
        <span className="border-b-[1.5px] border-current px-0.5">{top}</span>
        <span>{bottom}</span>
      </span>
      <span className="sr-only">
        {top}/{bottom}
      </span>
    </>
  );
}

/**
 * A run of maths text. In prose only the variables and fractions are maths;
 * with `math`, the whole run is a formula (an equation line, an answer value)
 * and its digits and operators are set in KaTeX_Main too.
 *
 * A variable that a word hyphenates onto — the y in "y-intercept" — is kept on
 * one line with that word: the hyphen was a line-break opportunity, and "y-"
 * at the end of one line read as a typo.
 */
export function MathText({ parts, math = false }: { parts: MathTextParts; math?: boolean }) {
  const nodes: React.ReactNode[] = [];
  const text = (value: string, key: React.Key) =>
    math ? <MathRun key={key}>{value}</MathRun> : <React.Fragment key={key}>{keepPairs(value)}</React.Fragment>;

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    if (typeof part === 'string') {
      nodes.push(text(part, index));
      continue;
    }
    if ('frac' in part) {
      nodes.push(<Frac key={index} top={part.frac[0]} bottom={part.frac[1]} />);
      continue;
    }

    const next = parts[index + 1];
    const joined = !math && typeof next === 'string' ? /^-\S+/.exec(next)?.[0] : undefined;
    if (joined && typeof next === 'string') {
      nodes.push(
        <span key={index} className="whitespace-nowrap">
          <Var>{part.v}</Var>
          {joined}
        </span>,
      );
      const rest = next.slice(joined.length);
      if (rest) nodes.push(text(rest, `${index}-rest`));
      index += 1;
      continue;
    }
    nodes.push(<Var key={index}>{part.v}</Var>);
  }

  return <>{nodes}</>;
}
