'use client';

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { BookOpen, Bookmark, Calculator } from 'lucide-react';
import {
  ANSWERED_TONE,
  CURRENT_RING,
  MARKED_ICON_CLASS,
  MARKED_SOCKET_CLASS,
  UNANSWERED_TONE,
} from '@/components/exam/navigatorTones';
import { cardClass } from '@/components/ui/Card';
import { cn } from '@/components/ui/cn';
import { ChipCheck, chipClass } from '@/components/ui/Misc';
import { useReducedMotion } from '@/lib/landing/hooks';
import { MINUS, type MathText as MathParts } from '@/lib/landing/warmup';
import { MathText } from './MathText';
import Odometer from './Odometer';
import styles from './landing.module.css';

/*
 * A phone-sized exam room drawn with the runner's own chip and tool styles
 * (QuestionNavigator, TopNav, SplitScreen's flag button), and five chips
 * that point at one part of it each. Tap only — no auto-cycling. The ring
 * glides to the part a chip names; the calculator and the reference sheet
 * slide in the way they do in the real room. The panels are a sketch, not a
 * copy of the Desmos interface; the question is a real one, authored here,
 * and its answer rows are SplitScreen's at mock scale.
 */

type TourKey = 'clocks' | 'calc' | 'sheet' | 'flag' | 'nav';

const TOUR: { key: TourKey; label: string; caption: string }[] = [
  {
    key: 'clocks',
    label: 'Two clocks',
    caption: 'Two modules, two clocks. Module 2 starts on a fresh clock. Leftover time doesn’t carry over.',
  },
  {
    key: 'calc',
    label: 'Graphing calculator',
    caption: 'The Desmos graphing calculator you’ll have on test day, built into every question.',
  },
  {
    key: 'sheet',
    label: 'Reference sheet',
    caption: 'The formulas the SAT gives you, one tap away. Learn what’s on it, so you don’t memorize what you don’t need.',
  },
  { key: 'flag', label: 'Flag', caption: 'Flag a question, move on, come back to it. Knowing when to move on is a skill.' },
  { key: 'nav', label: 'Navigator', caption: 'What’s answered, what’s flagged, what’s left, at a glance.' },
];

const FORMULAS: MathParts[] = [
  [{ v: 'A' }, ' = ', { v: 'π' }, { v: 'r' }, '²'],
  [{ v: 'C' }, ' = 2', { v: 'π' }, { v: 'r' }],
  [{ v: 'A' }, ' = ', { frac: ['1', '2'] }, { v: 'bh' }],
  [{ v: 'c' }, '² = ', { v: 'a' }, '² + ', { v: 'b' }, '²'],
  [{ v: 'V' }, ' = ', { v: 'lwh' }],
  [{ v: 'V' }, ' = ', { v: 'π' }, { v: 'r' }, '²', { v: 'h' }],
];

// Question 7 of the example module: 2(4) − 5 = 3, so B. Nothing is chosen yet.
const STEM: MathParts = [
  'The function ', { v: 'f' }, ' is defined by ', { v: 'f' }, '(', { v: 'x' }, ') = 2', { v: 'x' },
  ` ${MINUS} 5. What is the value of `, { v: 'f' }, '(4)?',
];
const OPTIONS: { letter: string; value: MathParts }[] = [
  { letter: 'A', value: [`${MINUS}3`] },
  { letter: 'B', value: ['3'] },
  { letter: 'C', value: ['8'] },
  { letter: 'D', value: ['13'] },
];

// The tools look like TopNav's ghost icon buttons, at mock scale.
const toolClass = 'grid h-7 w-7 place-items-center rounded-lg text-gray-600';

// The exam navigator's own chip states (navigatorTones), so the demo cannot
// drift from the real room: answered is solid ink blue, unanswered a dashed
// outline, "you are here" a ring over either one, and a flagged question
// carries the flag mark in its corner. Only the ring's offset changes, 1 not 2
// at this mock scale; it is swapped in the string because cn() does not
// merge, and an added 'ring-offset-1' would fight the 2.
const MOCK_CURRENT_RING = CURRENT_RING.replace('ring-offset-2', 'ring-offset-1');
const CURRENT = 7;
// Answered up to the one on screen, plus one moved ahead to; 3 was flagged
// on the way.
const ANSWERED = new Set([1, 2, 3, 4, 5, 6, 9]);

/** The mark from the question's own flag button, in a white socket. */
function MarkedFlag({ pop = false }: { pop?: boolean }) {
  return (
    <span className={cn(MARKED_SOCKET_CLASS, '-right-1 -top-1 h-3 w-3', pop && styles.pop)}>
      <Bookmark className={cn(MARKED_ICON_CLASS, 'h-2 w-2')} />
    </span>
  );
}

export default function RunnerTour({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  const [active, setActive] = useState<TourKey>('clocks');
  // The room opens on Module 1; tapping "Two clocks" rolls it to Module 2.
  const [moduleTwo, setModuleTwo] = useState(false);

  const mockRef = useRef<HTMLDivElement>(null);
  const spotRef = useRef<HTMLDivElement>(null);
  const placedOnce = useRef(false);

  useLayoutEffect(() => {
    const mock = mockRef.current;
    const spot = spotRef.current;
    if (!mock || !spot) return;

    const place = () => {
      const target = mock.querySelector(`[data-tour="${active}"]`);
      if (!target) return;
      const box = mock.getBoundingClientRect();
      const rect = target.getBoundingClientRect();
      // The first placement and reduced motion jump; every later one glides.
      spot.style.transition = !placedOnce.current || reduce ? 'none' : '';
      spot.style.width = `${rect.width}px`;
      spot.style.height = `${rect.height}px`;
      spot.style.transform = `translate(${rect.left - box.left}px, ${rect.top - box.top}px)`;
      placedOnce.current = true;
    };

    place();
    const observer = new ResizeObserver(place);
    observer.observe(mock);
    return () => observer.disconnect();
  }, [active, reduce, moduleTwo]);

  const choose = (key: TourKey) => {
    setActive(key);
    setModuleTwo(key === 'clocks');
  };

  const caption = TOUR.find((item) => item.key === active)?.caption;

  return (
    // minmax(0, 1fr) on phones too: the chip row scrolls sideways, and an auto
    // column would grow to its full width and push the page wider than the screen.
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-center lg:gap-16">
      <div>
        {children}
        {/* Five options, so chips (chipClass), not a segmented control. On a
            phone the row scrolls sideways instead of wrapping; the padding
            keeps the focus ring inside the scroll box, which would clip it,
            and the negative margin keeps the chips level with the text. */}
        <div
          role="group"
          aria-label="Test screen features"
          className="-mx-1 mt-3 flex snap-x snap-mandatory gap-2 overflow-x-auto p-1 [scrollbar-width:none] lg:flex-wrap lg:overflow-visible [&::-webkit-scrollbar]:hidden"
        >
          {TOUR.map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={active === item.key}
              onClick={() => choose(item.key)}
              className={chipClass(active === item.key, 'shrink-0 snap-start')}
            >
              <ChipCheck active={active === item.key} />
              {item.label}
            </button>
          ))}
        </div>
        <p aria-live="polite" className="mt-3 min-h-14 text-base leading-7 text-gray-600">
          <span key={active} className={cn('block', styles.fadeUp)}>
            {caption}
          </span>
        </p>
      </div>

      <div>
        <p className="mb-2 text-center text-xs font-medium text-gray-600">Example</p>
        <div ref={mockRef} aria-hidden="true" className={cn(cardClass, 'relative mx-auto w-full max-w-[380px] overflow-hidden')}>
          <div className="grid h-11 grid-cols-[1fr_auto_1fr] items-center border-b border-gray-100 px-3 text-sm">
            <span className="text-gray-700">{moduleTwo ? 'Module 2' : 'Module 1'}</span>
            <span data-tour="clocks" className="inline-flex rounded-full bg-gray-100 px-3 py-0.5 font-semibold tabular-nums text-gray-900">
              <Odometer value={moduleTwo ? '35:00' : '31:24'} animate={!reduce} />
            </span>
            <span className="flex justify-end gap-1.5">
              <span data-tour="calc" className={toolClass}>
                <Calculator className="h-4 w-4" />
              </span>
              <span data-tour="sheet" className={toolClass}>
                <BookOpen className="h-4 w-4" />
              </span>
            </span>
          </div>

          <div className="p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-lg bg-gray-900 text-xs font-semibold tabular-nums text-white">
                {CURRENT}
              </span>
              <span
                data-tour="flag"
                className={cn(
                  'inline-flex h-7 items-center gap-1.5 rounded-lg px-2 text-xs font-medium',
                  active === 'flag' ? 'text-gray-900' : 'text-gray-600',
                )}
              >
                <Bookmark className={cn('h-3.5 w-3.5', active === 'flag' && cn(MARKED_ICON_CLASS, styles.pop))} />
                Flag
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-gray-900">
              <MathText parts={STEM} />
            </p>
            <div className="mt-2 grid gap-1.5">
              {OPTIONS.map((option) => (
                <div key={option.letter} className="flex h-9 items-center gap-2 rounded-xl border border-gray-300 px-2 text-sm text-gray-900">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md border border-gray-300 text-xs font-medium text-gray-600">
                    {option.letter}
                  </span>
                  <MathText parts={option.value} math />
                </div>
              ))}
            </div>
          </div>

          <div data-tour="nav" className="border-t border-gray-100 px-3 pb-3 pt-2">
            <p className="mb-2 text-xs tabular-nums text-gray-500">
              Question {CURRENT} of 22 · {active === 'flag' ? 2 : 1} flagged
            </p>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: 22 }, (_, i) => {
                const number = i + 1;
                const isCurrent = number === CURRENT;
                const isMarked = number === 3 || (isCurrent && active === 'flag');
                return (
                  <span
                    key={number}
                    className={cn(
                      'relative grid h-6 w-6 place-items-center rounded-md border text-xs tabular-nums',
                      ANSWERED.has(number) ? ANSWERED_TONE : UNANSWERED_TONE,
                      isCurrent && MOCK_CURRENT_RING,
                    )}
                  >
                    {number}
                    {isMarked && <MarkedFlag pop={isCurrent} />}
                  </span>
                );
              })}
            </div>
          </div>

          <div
            className={cn(
              'absolute bottom-0 right-0 top-11 w-[62%] rounded-l-xl border border-gray-200 bg-white p-3 shadow-lg transition-transform duration-260',
              'ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
              active === 'calc' ? 'translate-x-0' : 'translate-x-[105%]',
            )}
          >
            <p className="mb-2 text-xs font-semibold text-gray-900">Graphing calculator</p>
            <svg viewBox="0 0 100 80" className="h-auto w-full">
              <defs>
                <pattern id="tour-grid" width="10" height="10" patternUnits="userSpaceOnUse">
                  <path d="M10 0H0V10" fill="none" className="stroke-gray-200" strokeWidth="0.6" />
                </pattern>
              </defs>
              <rect width="100" height="80" fill="url(#tour-grid)" />
              <line x1="50" y1="0" x2="50" y2="80" className="stroke-gray-400" strokeWidth="0.7" />
              <line x1="0" y1="40" x2="100" y2="40" className="stroke-gray-400" strokeWidth="0.7" />
              <line x1="10" y1="72" x2="92" y2="10" className="stroke-ink-600" strokeWidth="1.6" />
            </svg>
            <p className="mt-2 text-xs text-gray-600">
              <MathText parts={[{ v: 'y' }, ' = 0.75', { v: 'x' }, ' + 2']} math />
            </p>
          </div>

          <div
            className={cn(
              'absolute inset-x-0 bottom-0 h-[58%] rounded-t-2xl border border-gray-200 bg-white p-3 shadow-lg transition-transform duration-260',
              'ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
              active === 'sheet' ? 'translate-y-0' : 'translate-y-[105%]',
            )}
          >
            <p className="mb-2 text-xs font-semibold text-gray-900">Reference</p>
            <div className="grid grid-cols-3 gap-1.5 text-xs text-gray-900">
              {FORMULAS.map((formula, index) => (
                <span key={index} className="flex min-h-9 items-center rounded-lg border border-gray-200 px-2 py-1">
                  <MathText parts={formula} math />
                </span>
              ))}
            </div>
          </div>

          {/* The ring moves with translate; its size follows the target. */}
          <div
            ref={spotRef}
            className="pointer-events-none absolute left-0 top-0 rounded-xl outline-2 outline-offset-2 outline-ink-600 transition-[transform,width,height] duration-280 ease-[cubic-bezier(0.22,1,0.36,1)]"
          />
        </div>
      </div>
    </div>
  );
}
