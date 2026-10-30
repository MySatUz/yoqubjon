"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  BookOpen,
  Calculator,
  ChevronRight,
  CircleCheck,
  Eye,
  EyeOff,
  Loader2,
  Maximize,
  Minimize,
  PenLine,
} from 'lucide-react';
// The maths arrives as KaTeX HTML; only its stylesheet is needed here.
import 'katex/dist/katex.min.css';
import CalculatorWindow from '@/components/exam/CalculatorWindow';
import ReferenceModal from '@/components/exam/ReferenceModal';
import { useColumnOffset, useSheetInset } from '@/components/exam/examWindows';
import {
  AnswerChoice,
  GridInField,
  MultiSelectHint,
  QuestionDiagram,
  questionColumnLeftClass,
  questionScrollerClass,
  questionStemClass,
  questionSurfaceClass,
  readGridInEdit,
} from '@/components/exam/questionParts';
import {
  labelledToolClass,
  toolActiveClass,
  toolIconClass,
  toolIdleClass,
} from '@/components/exam/toolButtons';
import BoardWhiteboard from '@/components/board/BoardWhiteboard';
import type { BankTags, BoardQuestion } from '@/components/board/types';
import BrandMark from '@/components/layout/BrandMark';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { usePageScrollLock } from '@/components/ui/usePageScrollLock';
import { getDifficultyLabel, getDomainLabel } from '@/lib/questionBank';

/** A question on the board, as `BoardApp` hands it over. */
export type ShownQuestion = {
  /** New for every showing, so a question shown again starts clean. */
  key: string;
  question: BoardQuestion;
  imageSrc: string | null;
  /** A picture the optimizer cannot fetch: a chosen file's `blob:` URL. */
  imageUnoptimized: boolean;
  /** Its place in the bank list, or 1 for a pasted one; read out when it comes up. */
  number: number;
  /** In the top bar beside the logo; a pasted question has none. */
  tags: BankTags | null;
};

export type NextQuestion = {
  onNext: () => void;
  isLoading: boolean;
  isLast: boolean;
  error: string | null;
};

/* ------------------------------------------------------- full screen */

function subscribeToFullscreen(onChange: () => void) {
  document.addEventListener('fullscreenchange', onChange);
  return () => document.removeEventListener('fullscreenchange', onChange);
}
const subscribeToNothing = () => () => {};

/**
 * The whole page in full screen, not the board's own layer: the whiteboard's
 * toolbar and the tool windows are positioned against the window, and a
 * full-screen element shows nothing outside itself.
 */
function useFullscreen() {
  const isFullscreen = useSyncExternalStore(
    subscribeToFullscreen,
    () => document.fullscreenElement !== null,
    () => false
  );
  // An iPhone has no Fullscreen API for pages: the switch is left out there.
  const canFullscreen = useSyncExternalStore(
    subscribeToNothing,
    () => Boolean(document.fullscreenEnabled),
    () => false
  );
  const toggle = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void document.documentElement.requestFullscreen().catch(() => {});
  }, []);
  return { isFullscreen, canFullscreen, toggle };
}

/**
 * While the board is up, everything behind it is `inert`: the admin shell is
 * still in the page under the board's layer, and Tab would otherwise walk
 * through its sidebar unseen.
 */
function useInertBehind(layer: HTMLElement | null, isActive: boolean) {
  useLayoutEffect(() => {
    if (!layer || !isActive) return;
    const changed: Element[] = [];
    for (const child of Array.from(document.body.children)) {
      if (child === layer || child.contains(layer) || child.hasAttribute('inert')) continue;
      if (child.tagName === 'SCRIPT' || child.tagName === 'STYLE') continue;
      child.setAttribute('inert', '');
      changed.push(child);
    }
    return () => {
      for (const child of changed) child.removeAttribute('inert');
    };
  }, [isActive, layer]);
}

/* -------------------------------------------------------- the question */

type Choices = { selected: string[]; crossed: string[] };
type ChoiceAction = { type: 'select' | 'cross'; letter: string; isMultiSelect: boolean };

/**
 * The exam store's rules for choices (`setAnswer`, `toggleAnswerChoice`,
 * `toggleCrossOut`), kept here because nothing on the board is stored:
 * choosing a crossed-out letter brings it back, and crossing out a chosen one
 * takes it out of the answer.
 */
function choicesReducer(state: Choices, { type, letter, isMultiSelect }: ChoiceAction): Choices {
  if (type === 'select') {
    const selected = isMultiSelect
      ? state.selected.includes(letter)
        ? state.selected.filter((item) => item !== letter)
        : [...state.selected, letter].sort()
      : [letter];
    return { selected, crossed: state.crossed.filter((item) => !selected.includes(item)) };
  }
  if (state.crossed.includes(letter)) {
    return { ...state, crossed: state.crossed.filter((item) => item !== letter) };
  }
  return {
    crossed: [...state.crossed, letter].sort(),
    selected: state.selected.filter((item) => item !== letter),
  };
}

const NO_CHOICES: Choices = { selected: [], crossed: [] };

/*
 * The question stands at the left, under the tags beside the logo, and the
 * right side stays free to write on (the owner's layout). The bars and the
 * question share the surface's `px-4 md:px-8` gutter, so from `sm`, where the
 * logo shows, the column steps in by the logo and its gap (40 + 12px).
 */
const BAR_GUTTER_CLASS = 'px-4 md:px-8';
const BOARD_COLUMN_CLASS = cn(questionColumnLeftClass, 'sm:ml-13 focus:outline-hidden');
/** Where the column's text starts on a wide screen: the md:px-8 gutter and the step in. */
const BOARD_COLUMN_START = 32 + 52;

/** A grid-in's key, or a key the choices cannot show, printed once "Show answer" is pressed. */
function RevealedAnswer({ html }: { html: string }) {
  return (
    <div className="mt-4 rounded-xl border border-green-700 bg-green-50 px-4 py-3">
      <p className="flex items-center gap-1.5 text-sm font-medium text-green-800">
        <CircleCheck aria-hidden className="h-4 w-4" />
        Correct answer
      </p>
      <div className="mt-1 text-xl text-gray-900" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

/**
 * The question as the exam lays it out - the same column, diagram, stem and
 * answer rows (`questionParts`) - with the answer kept here instead of in the
 * exam's store. No number row over it: on the board the question is alone,
 * and its domain and difficulty sit in the top bar (the owner's layout).
 * Keyed by the showing, so a new question starts at its top with nothing
 * chosen, crossed out or drawn.
 */
function BoardQuestionPane({
  shown,
  isRevealed,
  isActive,
  isWhiteboardOpen,
  onCloseWhiteboard,
  toolbarContainer,
}: {
  shown: ShownQuestion;
  isRevealed: boolean;
  isActive: boolean;
  isWhiteboardOpen: boolean;
  onCloseWhiteboard: () => void;
  toolbarContainer: HTMLElement | null;
}) {
  const { question } = shown;
  const isMultipleChoice = question.optionsHtml.length > 0;
  const isMultiSelect = isMultipleChoice && question.multiSelect;
  const [choices, dispatch] = useReducer(choicesReducer, NO_CHOICES);
  const [gridIn, setGridIn] = useState({ value: '', problem: null as string | null });
  // Where the open tool windows leave room for the question (see `examWindows`).
  const columnOffset = useColumnOffset(BOARD_COLUMN_START);
  const sheetInset = useSheetInset();

  const correctLetters = useMemo(() => new Set(question.correctLetters ?? []), [question.correctLetters]);
  const selected = useMemo(() => new Set(choices.selected), [choices.selected]);
  const crossed = useMemo(() => new Set(choices.crossed), [choices.crossed]);

  const handleSelect = useCallback(
    (letter: string) => dispatch({ type: 'select', letter, isMultiSelect }),
    [isMultiSelect]
  );
  const handleCrossOut = useCallback(
    (letter: string) => dispatch({ type: 'cross', letter, isMultiSelect }),
    [isMultiSelect]
  );

  return (
    <div className={questionScrollerClass}>
      <div
        style={{
          translate: columnOffset ? `${columnOffset}px 0` : undefined,
          paddingBottom: sheetInset ? `calc(1.5rem + ${sheetInset}px)` : undefined,
        }}
        className={questionSurfaceClass}
      >
        <div data-board-question tabIndex={-1} className={BOARD_COLUMN_CLASS}>
          {shown.imageSrc && <QuestionDiagram src={shown.imageSrc} unoptimized={shown.imageUnoptimized} />}

          <div className={questionStemClass} dangerouslySetInnerHTML={{ __html: question.contentHtml }} />

          <div className="mt-6">
            {isMultipleChoice ? (
              <div>
                {isMultiSelect && <MultiSelectHint />}
                <div className="grid gap-2">
                  {question.optionsHtml.map((optionHtml, index) => {
                    const letter = String.fromCharCode(65 + index);
                    return (
                      <AnswerChoice
                        key={index}
                        letter={letter}
                        optionHtml={optionHtml}
                        isSelected={selected.has(letter)}
                        isCrossedOut={crossed.has(letter)}
                        isMultiSelect={isMultiSelect}
                        isCorrect={isRevealed && correctLetters.has(letter)}
                        onSelect={handleSelect}
                        onToggleCrossOut={handleCrossOut}
                      />
                    );
                  })}
                </div>
                {/* A key that names no letter (written as the choice's text)
                    cannot be marked on a row, so it is printed instead. */}
                {isRevealed && correctLetters.size === 0 && <RevealedAnswer html={question.correctAnswerHtml} />}
              </div>
            ) : (
              <GridInField
                value={gridIn.value}
                problem={gridIn.problem}
                onChange={(raw) => {
                  const edit = readGridInEdit(raw, gridIn.value);
                  setGridIn(edit);
                }}
              >
                {isRevealed && <RevealedAnswer html={question.correctAnswerHtml} />}
              </GridInField>
            )}
          </div>
        </div>
        <BoardWhiteboard
          pageKey={`board:${shown.key}`}
          isOpen={isWhiteboardOpen}
          isActive={isActive}
          onClose={onCloseWhiteboard}
          toolbarContainer={toolbarContainer}
        />
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- the board */

/**
 * The teacher's board: one question laid out as on the test, with the exam's
 * tools - the Desmos calculator, the reference sheet and the whiteboard - and
 * none of the test around it: no timer, no navigator, no finishing, nothing
 * saved. The answer stays hidden until "Show answer".
 *
 * It takes the whole window, over the admin shell, so the question gets the
 * room the exam gives it: on a 1366×768 laptop the sidebar would take a sixth
 * of the width out of a recording. The bars are the exam's heights (h-14 and
 * h-16), which the tool windows and the whiteboard's toolbar are placed
 * against (`examWindows`, `BoardToolbar`).
 *
 * Kept mounted and only hidden while a new question is picked, so the
 * calculator's graphs survive from one question to the next, as they do
 * between the questions of a test.
 */
export default function BoardScreen({
  shown,
  isVisible,
  referenceSheet,
  onNewQuestion,
  next,
}: {
  shown: ShownQuestion;
  isVisible: boolean;
  /** `ReferenceSheet`, rendered on the server with its formulas typeset. */
  referenceSheet: React.ReactNode;
  onNewQuestion: () => void;
  /** Only for a bank question: the next one in the list. */
  next: NextQuestion | null;
}) {
  const [layer, setLayer] = useState<HTMLDivElement | null>(null);
  const [isCalculatorOpen, setCalculatorOpen] = useState(false);
  const [wasCalculatorOpened, setWasCalculatorOpened] = useState(false);
  const [isReferenceOpen, setReferenceOpen] = useState(false);
  const [isWhiteboardOpen, setWhiteboardOpen] = useState(false);
  // Which showing the answer is revealed for: a new question starts hidden
  // without an effect to reset it.
  const [revealedFor, setRevealedFor] = useState<string | null>(null);
  const isRevealed = revealedFor === shown.key;
  const { isFullscreen, canFullscreen, toggle: toggleFullscreen } = useFullscreen();

  if (isCalculatorOpen && !wasCalculatorOpened) {
    setWasCalculatorOpened(true);
  }

  useInertBehind(layer, isVisible);
  // The admin page under the board holds still: its scrollbar showed at the
  // board's right edge, over a question with nothing to scroll.
  usePageScrollLock(isVisible);

  // Coming up, the board takes the keyboard at the question; moving on with
  // Next leaves it on Next, as the exam does.
  useEffect(() => {
    if (isVisible) layer?.querySelector<HTMLElement>('[data-board-question]')?.focus({ preventScroll: true });
  }, [isVisible, layer]);

  const { question } = shown;
  const announcement = isRevealed
    ? question.optionsHtml.length > 0 && question.correctLetters?.length
      ? `Correct answer: ${question.correctLetters.join(', ')}`
      : 'Correct answer shown under the question'
    : `Question ${shown.number}`;

  return createPortal(
    <div
      ref={setLayer}
      role="dialog"
      aria-modal="true"
      aria-label="Board"
      // z-50 with the shell's own top layer, and later in the page, so over it.
      className={cn('fixed inset-0 z-50 flex-col overflow-hidden bg-gray-100', isVisible ? 'flex' : 'hidden')}
    >
      <header
        className={cn(
          'sticky top-0 z-50 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-gray-200 bg-white',
          BAR_GUTTER_CLASS,
        )}
      >
        {/* The logo at its larger size and the question's tags: the bar says
            nothing else, so a recording shows only the question. */}
        <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
          <span className="hidden sm:block">
            <BrandMark size="md" />
          </span>
          {shown.tags?.domain && <Badge size="md">{getDomainLabel(shown.tags.domain)}</Badge>}
          {shown.tags?.difficulty && <Badge size="md">{getDifficultyLabel(shown.tags.difficulty)}</Badge>}
        </div>

        {/* The exam's strip, in the exam's order, with full screen at the end. */}
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setWhiteboardOpen(!isWhiteboardOpen)}
            aria-pressed={isWhiteboardOpen}
            aria-label="Whiteboard"
            title="Whiteboard"
            className={cn(labelledToolClass, isWhiteboardOpen ? toolActiveClass : toolIdleClass)}
          >
            <PenLine className={toolIconClass} />
            {/* Named, unlike the exam's: on the Board drawing is the main tool. */}
            <span className="hidden xl:inline">Whiteboard</span>
          </button>
          <button
            type="button"
            onClick={() => setReferenceOpen(!isReferenceOpen)}
            aria-pressed={isReferenceOpen}
            aria-label="Reference sheet"
            title="Reference sheet"
            className={cn(labelledToolClass, isReferenceOpen ? toolActiveClass : toolIdleClass)}
          >
            <BookOpen className={toolIconClass} />
            <span className="hidden xl:inline">Reference</span>
          </button>
          <button
            type="button"
            onClick={() => setCalculatorOpen(!isCalculatorOpen)}
            aria-pressed={isCalculatorOpen}
            aria-label="Graphing calculator"
            title="Graphing calculator"
            className={cn(labelledToolClass, isCalculatorOpen ? toolActiveClass : toolIdleClass)}
          >
            <Calculator className={toolIconClass} />
            <span className="hidden xl:inline">Calculator</span>
          </button>
          {canFullscreen && (
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-pressed={isFullscreen}
              aria-label="Full screen"
              title={isFullscreen ? 'Leave full screen (Esc)' : 'Full screen'}
              className={cn(labelledToolClass, 'ml-1', isFullscreen ? toolActiveClass : toolIdleClass)}
            >
              {isFullscreen ? <Minimize className={toolIconClass} /> : <Maximize className={toolIconClass} />}
              <span className="hidden xl:inline">Full screen</span>
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-1 flex-col overflow-hidden bg-white">
        <p className="sr-only" role="status">
          {isVisible ? announcement : ''}
        </p>
        <BoardQuestionPane
          key={shown.key}
          shown={shown}
          isRevealed={isRevealed}
          isActive={isVisible}
          isWhiteboardOpen={isWhiteboardOpen}
          onCloseWhiteboard={() => setWhiteboardOpen(false)}
          toolbarContainer={layer}
        />
        {wasCalculatorOpened && (
          <CalculatorWindow isOpen={isCalculatorOpen} onClose={() => setCalculatorOpen(false)} />
        )}
      </div>

      {/* The exam's bottom bar and its upward shadow. */}
      <footer
        className={cn(
          'sticky bottom-0 z-50 flex h-16 shrink-0 items-center gap-2 border-t border-gray-200 bg-white shadow-[0_-12px_30px_rgba(15,23,42,0.08)]',
          BAR_GUTTER_CLASS,
        )}
      >
        <Button variant="secondary" size="lg" onClick={onNewQuestion} aria-label="New question" title="New question">
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">New question</span>
        </Button>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
          {next?.error ? (
            <p role="alert" title={next.error} className="min-w-0 truncate text-xs text-red-600">
              {next.error}
            </p>
          ) : next?.isLast ? (
            <p className="hidden text-xs text-gray-500 sm:block">Last question in this list</p>
          ) : null}
          <Button variant="secondary" size="lg" onClick={() => setRevealedFor(isRevealed ? null : shown.key)}>
            {isRevealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {isRevealed ? 'Hide answer' : 'Show answer'}
          </Button>
          {next && (
            <Button size="lg" onClick={next.onNext} disabled={next.isLoading || next.isLast}>
              {next.isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              <span className="hidden sm:inline">Next question</span>
              <span className="sm:hidden">Next</span>
              {!next.isLoading && <ChevronRight className="h-4 w-4" />}
            </Button>
          )}
        </div>
      </footer>

      <ReferenceModal isOpen={isReferenceOpen} onClose={() => setReferenceOpen(false)}>
        {referenceSheet}
      </ReferenceModal>
    </div>,
    document.body
  );
}
