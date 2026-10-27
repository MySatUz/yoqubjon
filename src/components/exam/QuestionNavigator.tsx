"use client";

import React, { memo, useEffect, useRef } from 'react';
import { Bookmark, ListChecks, X } from 'lucide-react';
import { useExamStore } from '@/store/useExamStore';
import { Button, IconButton } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import {
  ANSWERED_TONE,
  CURRENT_RING,
  MARKED_ICON_CLASS,
  MARKED_SOCKET_CLASS,
  UNANSWERED_TONE,
} from '@/components/exam/navigatorTones';

// The chip states, for anything that has to draw a question the way the
// navigator does. They live in `navigatorTones`, which is free of the exam
// store; outside the exam, import them from there.
export { ANSWERED_TONE, CURRENT_RING, MARKED_ICON_CLASS, MARKED_SOCKET_CLASS, UNANSWERED_TONE };

interface PaletteButtonProps {
  index: number;
  isCurrent: boolean;
  isMarked: boolean;
  isAnswered: boolean;
  onSelect: (index: number) => void;
}

/** The bookmark from the question's own "Flag" button, in a white socket. */
function MarkedFlag({ small = false }: { small?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(MARKED_SOCKET_CLASS, small ? '-right-1 -top-1 h-3 w-3' : '-right-1.5 -top-1.5 h-4 w-4')}
    >
      <Bookmark className={cn(MARKED_ICON_CLASS, small ? 'h-2 w-2' : 'h-3 w-3')} />
    </span>
  );
}

const LEGEND = [
  { label: 'Answered', tone: ANSWERED_TONE },
  { label: 'Not answered', tone: UNANSWERED_TONE },
  { label: 'Flagged', tone: UNANSWERED_TONE, marked: true },
  { label: 'You are here', tone: cn(UNANSWERED_TONE, CURRENT_RING), current: true },
];

/**
 * A module has 22-27 of these. Only the two buttons around a jump actually
 * change, so they are memoized on plain booleans; `onSelect` is stable and
 * receives the index, which keeps the props shallow-equal between renders.
 *
 * The bookmark shows on every state, so flagging an answered question - or
 * the one on screen - still leaves a visible flag on it. 40px everywhere, the
 * same tap target as the review navigator's chips on a phone.
 */
const PaletteButton = memo(function PaletteButton({
  index,
  isCurrent,
  isMarked,
  isAnswered,
  onSelect,
}: PaletteButtonProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(index)}
      aria-current={isCurrent ? 'true' : undefined}
      aria-label={`Question ${index + 1}${isAnswered ? ', answered' : ''}${isMarked ? ', flagged' : ''}`}
      className={cn(
        'relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-sm font-medium tabular-nums transition-colors',
        // offset-4 so the focus outline clears the current-question ring.
        'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink-600',
        isAnswered ? cn(ANSWERED_TONE, 'hover:bg-ink-700') : cn(UNANSWERED_TONE, 'hover:bg-gray-50'),
        isCurrent && CURRENT_RING,
      )}
    >
      {index + 1}
      {isMarked && <MarkedFlag />}
    </button>
  );
});

/** How many of the module's questions are answered, not answered, and flagged. */
export function useModuleCounts(questionIds: string[]) {
  const answered = useExamStore((state) =>
    questionIds.filter((questionId) => state.answers[questionId]?.trim()).length
  );
  const marked = useExamStore((state) =>
    questionIds.filter((questionId) => state.markedForReview[questionId]).length
  );
  return { answered, unanswered: questionIds.length - answered, marked };
}

/**
 * The legend and the grid of every question in the module, with each one's
 * status. Shared by the navigator and "Check your work", so a question looks
 * the same in both. `currentIndex` is null where no question is on screen.
 */
export function QuestionGrid({
  questionIds,
  currentIndex,
  onSelect,
  className,
}: {
  questionIds: string[];
  currentIndex: number | null;
  /** Stable, so the chips stay memoized. */
  onSelect: (index: number) => void;
  className?: string;
}) {
  // These two references only change when an answer or a flag changes.
  const answers = useExamStore((state) => state.answers);
  const markedForReview = useExamStore((state) => state.markedForReview);

  return (
    <div className={className}>
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-600">
        {LEGEND.filter((item) => currentIndex !== null || !item.current).map((item) => (
          <li key={item.label} className="flex items-center gap-2">
            <span className={cn('relative h-4 w-4 rounded-md border', item.tone)}>
              {item.marked && <MarkedFlag small />}
            </span>
            {item.label}
          </li>
        ))}
      </ul>

      {/* As many 40px chips as fit a phone's width (six at 390px, five at
          320px); ten a row from `sm`, where the panel sizes to the grid. */}
      <div className="mt-4 grid grid-cols-[repeat(auto-fill,2.5rem)] justify-start gap-2 sm:grid-cols-[repeat(10,2.5rem)]">
        {questionIds.map((questionId, i) => (
          <PaletteButton
            key={questionId}
            index={i}
            isCurrent={i === currentIndex}
            isMarked={Boolean(markedForReview[questionId])}
            isAnswered={Boolean(answers[questionId]?.trim())}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

interface QuestionNavigatorProps {
  id: string;
  questionIds: string[];
  currentIndex: number;
  moduleIndex: number;
  moduleCount: number;
  /** Stable, so the chips stay memoized. */
  onSelect: (index: number) => void;
  onClose: () => void;
  /** Opens "Check your work", where the module is finished. */
  onReview: () => void;
  /** The "Question N of M" button: a press on it is its own toggle, not an outside click. */
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

/**
 * Bluebook's question navigator: the grid of every question in the module,
 * opened from the "Question N of M" button in the middle of the bottom bar.
 * It replaces the strip of chips that used to scroll sideways in the bar.
 *
 * Mounted only while open, so the answers and the flags are only followed -
 * and the bar only repaints for them - while the grid is on screen.
 */
export default function QuestionNavigator({
  id,
  questionIds,
  currentIndex,
  moduleIndex,
  moduleCount,
  onSelect,
  onClose,
  onReview,
  triggerRef,
}: QuestionNavigatorProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const { unanswered, marked } = useModuleCounts(questionIds);

  // Keyboard users land on the question they are on.
  useEffect(() => {
    panelRef.current?.querySelector<HTMLElement>('[aria-current="true"]')?.focus();
  }, []);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Node ? event.target : null;
      if (!target) return;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      onClose();
      triggerRef.current?.focus();
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose, triggerRef]);

  return (
    // A phone has no room to hang it off the button, so there it spans the
    // screen above the bar.
    <div
      ref={panelRef}
      id={id}
      role="dialog"
      aria-label="Question navigator"
      className="fixed inset-x-4 bottom-20 rounded-2xl border border-gray-200 bg-white p-4 shadow-lg md:absolute md:inset-x-auto md:bottom-full md:left-1/2 md:mb-6 md:w-max md:-translate-x-1/2 md:p-5"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tabular-nums text-gray-900">
            {moduleCount > 1 && <>Module {moduleIndex} of {moduleCount} · </>}
            {questionIds.length} {questionIds.length === 1 ? 'question' : 'questions'}
          </h2>
          {/* What is still open, at a glance: the reason to open this grid in
              the last minutes of a module. */}
          <p className="mt-0.5 text-xs tabular-nums text-gray-500">
            {unanswered === 0 ? 'All answered' : `${unanswered} not answered`}
            {marked > 0 && ` · ${marked} flagged`}
          </p>
        </div>
        {/* Back to the button that opened it, as Escape does: this one is
            about to unmount with focus on it. */}
        <IconButton
          size="sm"
          onClick={() => {
            onClose();
            triggerRef.current?.focus();
          }}
          aria-label="Close navigator"
          className="-mr-1.5"
        >
          <X className="h-4 w-4" />
        </IconButton>
      </div>

      <QuestionGrid
        questionIds={questionIds}
        currentIndex={currentIndex}
        onSelect={onSelect}
        className="mt-3"
      />

      {/* The way to finish early, as the old "End module" in the header
          was: finishing always goes through the review. */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-gray-100 pt-4">
        <p className="text-xs text-gray-500">Nothing is sent until you finish the test.</p>
        <Button variant="secondary" size="sm" onClick={onReview} className="max-sm:w-full">
          <ListChecks className="h-4 w-4" />
          Check your work
        </Button>
      </div>

      <span
        aria-hidden
        className="absolute -bottom-2 left-1/2 hidden h-4 w-4 -translate-x-1/2 rotate-45 border-b border-r border-gray-200 bg-white md:block"
      />
    </div>
  );
}
