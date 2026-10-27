"use client";

import React, { memo, useEffect, useState } from 'react';
import Image from 'next/image';
import { CircleCheck, Strikethrough } from 'lucide-react';
import { focusRingClass } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { fieldFocusClass } from '@/components/ui/Field';

/**
 * The question as the exam draws it - the column, the number tile, the
 * diagram, the answer rows and the grid-in field - with no store behind any
 * of it. `SplitScreen` puts these together for a test; the admin Board
 * (`src/components/board/`) puts the same ones together for one question, so
 * a question on the board is a question on the test, down to the pixel.
 *
 * `contentHtml` / `optionsHtml` everywhere here are rendered on the server by
 * `@/lib/renderMathHtml`, which escapes every plain-text segment and leaves
 * KaTeX's `trust` option off. Nothing else may be injected.
 */

/** Intrinsic size the question diagram is requested at. */
export const QUESTION_IMAGE_WIDTH = 800;
export const QUESTION_IMAGE_HEIGHT = 480;

/**
 * One size whether a tool window is open or not: the column never narrows, so
 * neither does the diagram. At most the column's 680px less the frame's padding.
 */
export const QUESTION_IMAGE_SIZES = '(min-width: 768px) 40rem, 90vw';

/**
 * The scroller. `overflow-x-hidden`: the surface inside slides sideways out
 * from under a tool window, and must not grow a horizontal scrollbar doing it.
 */
export const questionScrollerClass = 'flex-1 overflow-y-auto overflow-x-hidden';

/**
 * The whiteboard's surface: the whole scrolling content, padding and side
 * margins included, at least a screen tall. The padding lives here rather
 * than on the scroller so a drawing reaches the edges, and `isolate` keeps
 * the canvas's z-index inside this box. A tool window beside it moves it with
 * `translate` (see `useColumnOffset`) and never resizes it.
 */
export const questionSurfaceClass =
  'relative isolate flex min-h-full flex-col px-4 py-6 transition-transform duration-300 ease-out motion-reduce:transition-none md:px-8 md:py-8';

/**
 * One column, one size, with a calculator or without. KaTeX sets its maths
 * 1.21x the surrounding text; at 1.1x a formula sits on the line instead of
 * jumping out of it. Important, because KaTeX's stylesheet is unlayered and
 * beats any utility otherwise.
 */
export const questionColumnClass = 'mx-auto flex w-full max-w-[680px] flex-1 flex-col [&_.katex]:text-[1.1em]!';

/** The row over the question: its number and whatever acts on it. */
export const questionHeadClass = 'mb-5 flex items-center gap-3 border-b border-gray-200 pb-3 focus:outline-hidden';

/** The stem's reading size. The answers never go larger or heavier. */
export const questionStemClass = 'text-lg leading-[1.6] text-gray-900';

/**
 * Bluebook's question-number tile, one of the two places the exam copies the
 * real test's dark chrome (AGENTS.md, "Colour").
 */
export function QuestionNumberTile({ number }: { number: number }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-900 text-sm font-semibold tabular-nums text-white">
      <span className="sr-only">Question </span>
      {number}
    </span>
  );
}

/**
 * The diagram. It is on screen the moment the question is, so the default
 * `loading="lazy"` only ever delays it; in Next 16 `priority` is deprecated in
 * favour of these two props. A picture the optimizer cannot fetch - one the
 * Board holds as a `blob:` URL in the browser - is drawn as it is.
 */
export function QuestionDiagram({ src, unoptimized = false }: { src: string; unoptimized?: boolean }) {
  return (
    <div className="mb-5 overflow-hidden rounded-xl border border-gray-200 bg-white p-3">
      <Image
        src={src}
        alt="Question diagram"
        width={QUESTION_IMAGE_WIDTH}
        height={QUESTION_IMAGE_HEIGHT}
        loading="eager"
        fetchPriority="high"
        sizes={QUESTION_IMAGE_SIZES}
        unoptimized={unoptimized}
        className="mx-auto h-auto max-h-65 w-full object-contain"
      />
    </div>
  );
}

/** Over the choices of a question with several right answers. */
export function MultiSelectHint() {
  return <p className="mb-3 text-sm font-medium text-gray-700">Select all that apply</p>;
}

interface AnswerChoiceProps {
  letter: string;
  optionHtml: string;
  isSelected: boolean;
  isCrossedOut: boolean;
  isMultiSelect: boolean;
  /**
   * Marked as the right answer - only on the admin Board, after "Show answer".
   * The exam never passes it.
   */
  isCorrect?: boolean;
  onSelect: (letter: string) => void;
  onToggleCrossOut: (letter: string) => void;
}

/**
 * Memoized so picking an answer only re-renders the two choices whose
 * selection state actually changed.
 *
 * Selected is ink - the app's one "selected" colour; green is kept for a
 * correct answer, and a correct row also says so in words and with an icon,
 * so selected and correct are never told apart by hue alone. The 1px ring doubles
 * the border without moving the row. Idle rows are drawn in the controls'
 * gray-300: gray-200 all but vanished on white (1.23:1).
 *
 * A multi-select choice keeps every other treatment and only squares off its
 * letter box - `rounded-lg` against `rounded-xl` - which is the same
 * checkbox-against-radio cue the rest of the app uses, without inventing a
 * shape or a colour for it.
 *
 * Crossing out is its own small button at the row's right edge - a sibling,
 * not inside the choice, as a button cannot hold a button. It is outlined, as
 * every action in a row is: a bare icon there read as decoration until it was
 * hovered. A crossed-out choice is greyed and struck through, and stays
 * pressable: choosing it brings it back (see `toggleCrossOut` in the store).
 */
export const AnswerChoice = memo(function AnswerChoice({
  letter,
  optionHtml,
  isSelected,
  isCrossedOut,
  isMultiSelect,
  isCorrect = false,
  onSelect,
  onToggleCrossOut,
}: AnswerChoiceProps) {
  return (
    <div className="relative">
      <button
        type="button"
        aria-pressed={isSelected}
        onClick={() => onSelect(letter)}
        className={cn(
          'group flex min-h-13 w-full items-center rounded-xl border py-2.5 pl-4 pr-14 text-left transition-colors pointer-coarse:min-h-14',
          focusRingClass,
          isCorrect
            ? 'border-green-700 bg-green-50 ring-1 ring-green-700'
            : isSelected
              ? 'border-ink-600 bg-ink-50 ring-1 ring-ink-600'
              : 'border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50'
        )}
      >
        {/* Letter and text together, so the strike runs through what is
            crossed out and not on across the empty row. */}
        <span className="relative flex min-w-0 items-center gap-3">
          <span
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center border text-sm font-semibold transition-colors',
              isMultiSelect ? 'rounded-lg' : 'rounded-xl',
              isCorrect
                ? 'border-green-700 bg-green-700 text-white'
                : isSelected
                  ? 'border-ink-600 bg-ink-600 text-white'
                  : isCrossedOut
                    ? 'border-gray-300 text-gray-500'
                    : 'border-gray-300 text-gray-600 group-hover:border-gray-400 group-hover:text-gray-900'
            )}
          >
            {letter}
          </span>
          {/* The stem's size and weight - never larger or heavier than the
              question it answers. KaTeX takes its colour from here. */}
          <span
            className={cn('min-w-0 text-lg', isCrossedOut ? 'text-gray-500' : 'text-gray-900')}
            dangerouslySetInnerHTML={{ __html: optionHtml }}
          />
          {isCrossedOut && (
            <>
              <span className="sr-only">, crossed out</span>
              {/* A drawn line rather than `line-through`, which does not reach
                  into KaTeX's inline blocks. */}
              <span
                aria-hidden
                className="pointer-events-none absolute -inset-x-1.5 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-gray-600"
              />
            </>
          )}
        </span>
        {isCorrect && (
          <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 pl-3 text-sm font-medium text-green-800">
            <CircleCheck aria-hidden className="h-4 w-4" />
            Correct answer
          </span>
        )}
      </button>
      <button
        type="button"
        aria-pressed={isCrossedOut}
        aria-label={`Cross out ${letter}`}
        title={`Cross out ${letter}`}
        onClick={() => onToggleCrossOut(letter)}
        // `iconButtonClass` (sm, secondary) geometry and colours, key edge
        // included, spelled out for the pressed state the primitive does not
        // have: pressed is a neutral grey with the key down, never the board
        // green of a chosen answer beside it.
        className={cn(
          'absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg border transition-colors pointer-coarse:h-10 pointer-coarse:w-10',
          focusRingClass,
          isCrossedOut
            ? 'border-gray-400 bg-gray-200 text-gray-900 hover:bg-gray-300'
            : 'border-gray-400 border-b-gray-500 bg-white text-gray-800 shadow-xs hover:border-gray-500 hover:bg-gray-50 hover:text-gray-900 active:bg-gray-100 active:shadow-none'
        )}
      >
        <Strikethrough className="h-4 w-4" />
      </button>
    </div>
  );
});

/* ------------------------------------------------------------ grid-in */

/** The real test's entry rules, so they are practised too. */
export const GRID_IN_RULES = 'A fraction like 3/4 or a decimal like 0.75. Up to 5 characters, 6 for a negative answer.';
const GRID_IN_MAX_LENGTH = 5;

/**
 * Why a grid-in value would not be accepted on the test, or null when it
 * would. Bluebook refuses such a keystroke outright; here it is refused too,
 * with the reason in place of the rules, so the student learns the format
 * instead of wondering why a key did nothing.
 */
function gridInProblem(value: string) {
  // A decimal comma is how most students here write 0,75 - and the grader
  // reads a comma as a thousands separator, so 0,75 would be marked as 75.
  if (value.includes(',')) return 'Use a dot for decimals, like 0.75.';
  // A space almost always means a mixed number, which the test does not take:
  // 1 1/2 entered without its space is read as 11/2.
  if (/\s/.test(value)) return 'No spaces or mixed numbers: write 1 1/2 as 3/2 or 1.5.';
  if (!/^-?[0-9./]*$/.test(value)) return 'Only digits, a dot, a slash and a minus at the start.';
  const parts = value.replace(/^-/, '').split('/');
  if (parts.length > 2) return 'One slash only, as in 3/4.';
  if (parts.some((part) => part.split('.').length > 2)) return 'One decimal point per number.';
  if (value.replace(/^-/, '').length > GRID_IN_MAX_LENGTH) return 'Up to 5 characters, 6 with a minus sign.';
  return null;
}

/**
 * What one edit of the grid-in field does: the new value, or the reason it
 * was refused (and the old value stays). Deleting is always allowed, so an
 * answer saved before these rules can still be corrected one character at a
 * time.
 */
export function readGridInEdit(raw: string, previous: string): { value: string; problem: string | null } {
  // A typographic minus from a paste is no reason to refuse.
  const value = raw.replace(/[−–—]/g, '-');
  const reason = gridInProblem(value);
  if (reason && value.length >= previous.length) return { value: previous, problem: reason };
  return { value, problem: null };
}

type Katex = (typeof import('katex'))['default'];
let katexLoad: Promise<Katex> | null = null;

/**
 * KaTeX's JS stays out of the exam bundle (see `ExamRunner`); the preview is
 * the one place that needs it in the browser, so it is fetched the first time
 * a grid-in answer is typed, and only once.
 */
function loadKatex() {
  katexLoad ??= import('katex')
    .then((module) => module.default)
    .catch((error: unknown) => {
      // A failed chunk is tried again by the next preview.
      katexLoad = null;
      throw error;
    });
  return katexLoad;
}

/** The typed value as TeX: a slash becomes a stacked fraction. Only ever digits, dots, a slash and a minus. */
function previewTex(value: string) {
  if (!/^-?[0-9.]*(\/[0-9.]*)?$/.test(value)) return null;

  const sign = value.startsWith('-') ? '-' : '';
  const [numerator, denominator] = value.replace(/^-/, '').split('/');
  if (denominator === undefined) return `${sign}${numerator}`;

  // An empty side keeps its place, so "3/" already reads as a fraction.
  const side = (part: string) => part || '\\phantom{0}';
  return `${sign}\\dfrac{${side(numerator)}}{${side(denominator)}}`;
}

/**
 * Bluebook's answer preview: the value as it will be read, with a fraction
 * stacked, set in the same KaTeX as the question. Plain text until KaTeX has
 * arrived. Hidden from screen readers: the field itself already says it.
 */
function AnswerPreview({ value }: { value: string }) {
  const [katex, setKatex] = useState<Katex | null>(null);

  useEffect(() => {
    let isCurrent = true;
    loadKatex().then(
      (loaded) => {
        if (isCurrent) setKatex(loaded);
      },
      () => {}
    );
    return () => {
      isCurrent = false;
    };
  }, []);

  const tex = previewTex(value);
  const html = katex && tex !== null
    ? katex.renderToString(tex, { throwOnError: false, output: 'html' })
    : null;

  return (
    <div aria-hidden className="mt-3 flex min-h-14 items-center gap-3">
      <span className="text-xs text-gray-500">Answer preview</span>
      {html ? (
        <span className="text-xl text-gray-900" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <span className="text-xl tabular-nums text-gray-900">{value}</span>
      )}
    </div>
  );
}

/**
 * The grid-in field as the student sees it: the heading, the input at answer
 * size, the rules (or why the last keystroke was refused) and the preview.
 * Whoever renders it owns the value - the exam's store, or the Board's own
 * state - and runs each edit through `readGridInEdit`.
 */
export function GridInField({
  value,
  problem,
  onChange,
  onBlur,
  children,
}: {
  value: string;
  problem: string | null;
  /** The raw text of the field after an edit. */
  onChange: (raw: string) => void;
  onBlur?: () => void;
  /** Shown under the preview: the Board's revealed answer. */
  children?: React.ReactNode;
}) {
  return (
    <div className="max-w-xs">
      <h4 className="text-sm font-medium text-gray-700">
        Student-produced response
      </h4>
      <div className="mt-2 w-full max-w-56">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          aria-label="Your answer"
          aria-describedby="grid-in-rules"
          // A full keyboard, not inputMode="decimal": the iOS decimal keypad has
          // neither a minus nor a slash, so a phone could not enter -3 or 3/4 -
          // and grid-in answers are often negative or fractions. The landing's
          // warm-up solves the same gap with its own minus toggle (Warmup.tsx).
          inputMode="text"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          // `inputClass` geometry at answer size: a grid-in value is read back at
          // a glance, so it is h-12 and text-xl rather than a form field's h-9.
          // `focus:outline-hidden`, as in Field.tsx: high-contrast mode still
          // shows the focus.
          className={cn(
            'h-12 w-full rounded-lg border border-gray-400 bg-white px-3 text-center text-xl font-medium tabular-nums text-gray-900 transition-colors hover:border-gray-500 focus:outline-hidden',
            fieldFocusClass
          )}
        />
      </div>
      {/* The rules, or why the last keystroke was refused, in their place so
          nothing below moves; read out when it changes. */}
      <p
        id="grid-in-rules"
        role="status"
        className={cn('mt-2 text-xs leading-5', problem ? 'text-red-600' : 'text-gray-500')}
      >
        {problem ?? GRID_IN_RULES}
      </p>
      {value !== '' && <AnswerPreview value={value} />}
      {children}
    </div>
  );
}
