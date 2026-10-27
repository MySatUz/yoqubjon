'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import Link from 'next/link';
import { Check, Pause, Play, X } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button, IconButton, buttonClass, focusRingClass } from '@/components/ui/Button';
import { fieldFocusClass } from '@/components/ui/Field';
import { cn } from '@/components/ui/cn';
import { formatDuration } from '@/lib/olympiad';
import { useLocationQuery, useReducedMotion } from '@/lib/landing/hooks';
import {
  FREE_OFFER_CTA,
  MINUS,
  PER_QUESTION_SECONDS,
  QUESTIONS,
  SITE_MENU_EVENT,
  checkAnswer,
  feedbackFor,
  formatClock,
  freeTestsPhrase,
  friendChallengeLine,
  normalizeGridIn,
  publishLiveRun,
  saveFinishedRun,
  totalTime,
  type ChoiceQuestion,
  type GridInQuestion,
  type WarmupAnswer,
} from '@/lib/landing/warmup';
import { MathText } from './MathText';
import Odometer from './Odometer';
import RiseMeter from './RiseMeter';
import TangentFigure from './TangentFigure';
import WarmupResult from './WarmupResult';
import styles from './landing.module.css';

/*
 * The hero. On the left, what MYSATuz is — the page's one h1, the promise and
 * the button to the free test. On the right, the live demo: three
 * questions, each one harder, 1:35 each — the time a real Digital SAT Math
 * module allows per question. No sign-up; the answers stay in this tab.
 *
 * The clock is honest about pausing. It starts 1.2 s after the card is at
 * least 60 % on screen, stops when the card leaves or the tab is hidden, and
 * at 0:00 it only says so: there is no penalty, and time keeps being counted.
 * Under reduced motion it never starts itself — the student starts it, or
 * just answers.
 */

// StickyCta finds the card and its title by these ids.
const CARD_ID = 'warmup-card';
const WARMUP_TITLE_ID = 'warmup-title';

const EASE_ENTER = 'ease-[cubic-bezier(0.22,1,0.36,1)]';

/* ───────────────────────────── the clock ───────────────────────────── */

function useCountdown(total: number) {
  const [shown, setShown] = useState(total);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [expired, setExpired] = useState(false);
  const barRef = useRef<HTMLElement>(null);
  const clock = useRef({ left: total, shown: total, running: false, started: false, expired: false, last: 0, frame: 0, spent: 0 });

  // The bar is one linear CSS transition per stretch of running time, drained
  // to zero over exactly the seconds left. Pausing reads where it got to.
  const setBar = useCallback((fraction: number, drainSeconds = 0) => {
    const bar = barRef.current;
    if (!bar) return;
    bar.style.transition = 'none';
    bar.style.transform = `scaleX(${fraction})`;
    if (drainSeconds > 0) {
      void bar.getBoundingClientRect();
      bar.style.transition = `transform ${drainSeconds}s linear`;
      bar.style.transform = 'scaleX(0)';
    }
  }, []);

  const start = useCallback(() => {
    const c = clock.current;
    if (c.running) return;
    c.running = true;
    c.started = true;
    c.last = performance.now();
    setRunning(true);
    setPaused(false);
    if (!c.expired) setBar(c.left / total, c.left);

    const tick = (now: number) => {
      if (!c.running) return;
      const elapsed = Math.max(0, now - c.last);
      c.last = now;
      c.spent += elapsed;
      c.left = Math.max(0, c.left - elapsed / 1000);
      if (c.left === 0 && !c.expired) {
        c.expired = true;
        setExpired(true);
      }
      const whole = Math.ceil(c.left);
      if (whole !== c.shown) {
        c.shown = whole;
        setShown(whole);
      }
      c.frame = requestAnimationFrame(tick);
    };
    c.frame = requestAnimationFrame(tick);
  }, [setBar, total]);

  const pause = useCallback(
    (showPaused: boolean) => {
      const c = clock.current;
      if (!c.running) return;
      c.running = false;
      cancelAnimationFrame(c.frame);
      setRunning(false);
      const bar = barRef.current;
      if (bar) {
        const matrix = getComputedStyle(bar).transform;
        const reached = matrix.startsWith('matrix') ? parseFloat(matrix.slice(7).split(',')[0]) : c.left / total;
        setBar(Number.isFinite(reached) ? reached : c.left / total);
      }
      if (showPaused) setPaused(true);
    },
    [setBar, total],
  );

  const reset = useCallback(() => {
    const c = clock.current;
    cancelAnimationFrame(c.frame);
    Object.assign(c, { running: false, left: total, shown: total, expired: false, spent: 0 });
    setRunning(false);
    setPaused(false);
    setExpired(false);
    setShown(total);
    setBar(1);
  }, [setBar, total]);

  const empty = useCallback(() => setBar(0), [setBar]);
  const spentMs = useCallback(() => clock.current.spent, []);
  const everStarted = useCallback(() => clock.current.started, []);

  useEffect(() => {
    const c = clock.current;
    return () => cancelAnimationFrame(c.frame);
  }, []);

  return { shown, running, paused, expired, barRef, start, pause, reset, empty, spentMs, everStarted };
}

/* ───────────────────────────── the card ───────────────────────────── */

type Slide = 'idle' | 'leaving' | 'entering';

const slideClass: Record<Slide, string> = {
  idle: `translate-x-0 opacity-100 transition-[transform,opacity] duration-260 ${EASE_ENTER}`,
  leaving: '-translate-x-6 opacity-0 transition-[transform,opacity] duration-180 ease-[cubic-bezier(0.4,0,1,1)]',
  entering: 'translate-x-6 opacity-0 transition-none',
};

const WHY_NOTE = (
  <p>
    <span className="font-medium text-gray-900">Why 1:35?</span> On the real Digital SAT, a Math module is 35 minutes
    for 22 questions.
  </p>
);

/** `freeTests`: how many tests are free (countFreeTests), or null to leave the number out. */
export default function Warmup({ freeTests }: { freeTests: number | null }) {
  const reduce = useReducedMotion();
  const { search, hash } = useLocationQuery();
  const friendLine = useMemo(() => friendChallengeLine(search, hash), [search, hash]);

  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<WarmupAnswer[]>([]);
  const [result, setResult] = useState<{ from: DOMRect | null } | null>(null);
  const [slide, setSlide] = useState<Slide>('idle');
  const [selected, setSelected] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [manual, setManual] = useState(false);
  const [swingDone, setSwingDone] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const meterRef = useRef<SVGSVGElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const focusTitle = useRef(false);

  const { shown, running, paused, expired, barRef, start, pause, reset, empty, spentMs, everStarted } =
    useCountdown(PER_QUESTION_SECONDS);

  const question = QUESTIONS[index];
  const current = answers[index] ?? null;
  const done = result !== null;

  // What the observers need to know, kept current for callbacks that outlive
  // the render they were made in.
  const gate = useRef({ visible: false, timer: 0, done: false, checked: false, reduce: false, manual: false, menu: false });
  useEffect(() => {
    Object.assign(gate.current, { done, checked: current !== null, reduce, manual });
  });

  const tryStart = useCallback(() => {
    const g = gate.current;
    if (g.done || g.checked || g.menu || (g.reduce && !g.manual)) return;
    start();
  }, [start]);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const g = gate.current;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Q3 is taller than a landscape phone: there, filling 60 % of the
        // screen counts as on screen, or its clock could never start.
        const fills = entry.rootBounds !== null && entry.intersectionRect.height >= entry.rootBounds.height * 0.6;
        g.visible = entry.intersectionRatio >= 0.6 || fills;
        window.clearTimeout(g.timer);
        if (g.done) return;
        if (g.visible) g.timer = window.setTimeout(tryStart, everStarted() ? 400 : 1200);
        else pause(true);
      },
      { threshold: [0, 0.2, 0.4, 0.6, 0.8, 1] },
    );
    observer.observe(card);

    const onVisibility = () => {
      if (document.hidden) pause(true);
      else if (g.visible) tryStart();
    };
    document.addEventListener('visibilitychange', onVisibility);

    // The phone menu covers the card without moving it, so the observer
    // never sees it go: the menu says so itself (SiteNav).
    const onMenu = (event: Event) => {
      g.menu = (event as CustomEvent<boolean>).detail;
      if (g.menu) pause(true);
      else if (g.visible) tryStart();
    };
    window.addEventListener(SITE_MENU_EVENT, onMenu);

    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener(SITE_MENU_EVENT, onMenu);
      window.clearTimeout(g.timer);
    };
  }, [everStarted, pause, tryStart]);

  const submit = (skipped: boolean) => {
    if (current) return;
    pause(false);
    const given = skipped ? null : question.kind === 'choice' ? selected : normalizeGridIn(typed);
    const status = skipped ? 'skipped' : checkAnswer(question, given);
    const next = [...answers, { q: index, given, status, ms: Math.max(1000, spentMs()) }];
    setAnswers(next);
    publishLiveRun({ index, answers: next, totalMs: totalTime(next), done: false });
    // Keyboard users land on the next step instead of on a vanished button.
    requestAnimationFrame(() => nextRef.current?.focus({ preventScroll: true }));
  };

  const goNext = () => {
    // A second click during the 180 ms exit would replay the slide.
    if (slide !== 'idle') return;
    const nextIndex = index + 1;
    focusTitle.current = true;
    reset();
    const apply = () => {
      setIndex(nextIndex);
      setSelected(null);
      setTyped('');
      publishLiveRun({ index: nextIndex, answers, totalMs: totalTime(answers), done: false });
    };

    if (reduce) {
      apply();
    } else {
      setSlide('leaving');
      window.setTimeout(() => {
        apply();
        setSlide('entering');
        requestAnimationFrame(() => requestAnimationFrame(() => setSlide('idle')));
        const card = cardRef.current;
        // 80: the card's scroll-mt-20, the room the sticky header takes.
        if (card && card.getBoundingClientRect().top < 80) card.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }, 180);
    }
    window.setTimeout(() => {
      if (gate.current.visible) tryStart();
    }, 700);
  };

  const showResult = () => {
    const from = meterRef.current?.getBoundingClientRect() ?? null;
    pause(false);
    window.clearTimeout(gate.current.timer);
    empty();
    const totalMs = totalTime(answers);
    focusTitle.current = true;
    setResult({ from });
    saveFinishedRun(answers, totalMs);
    publishLiveRun({ index, answers, totalMs, done: true });
  };

  const onSettled = useCallback(() => setSwingDone(true), []);

  // The button that was pressed is gone once the next question (or the
  // result) renders; hand focus to the card's title rather than leave it on
  // the page body, so keyboard and screen-reader users stay in the card.
  useEffect(() => {
    if (!focusTitle.current) return;
    focusTitle.current = false;
    const active = document.activeElement;
    if (!active || active === document.body) document.getElementById(WARMUP_TITLE_ID)?.focus({ preventScroll: true });
  }, [index, done]);

  // Q3's "See my result" only appears once the swing settles, after Check has
  // already unmounted; focus it then, unless the student has moved on.
  useEffect(() => {
    if (!swingDone) return;
    const active = document.activeElement;
    if (!active || active === document.body) nextRef.current?.focus({ preventScroll: true });
  }, [swingDone]);

  const hurry = !done && shown <= 15 && shown > 0;
  const heroClock = done ? formatClock(PER_QUESTION_SECONDS) : formatClock(shown);
  const showStartButton = reduce && !manual && !running && !current && !done;

  const startManually = () => {
    setManual(true);
    gate.current.manual = true;
    start();
    // The button that was pressed gives way to the clock: keep keyboard and
    // screen-reader users in the card instead of on the page body.
    requestAnimationFrame(() => {
      const active = document.activeElement;
      if (!active || active === document.body) document.getElementById(WARMUP_TITLE_ID)?.focus({ preventScroll: true });
    });
  };

  // On a 390px phone the title, the chip and the meter leave about 60px for
  // this slot, so "Paused" and "Start the clock" are icons there and words
  // from sm up; as words they ran under the chip. The start control is an
  // outlined button either way: as grey text it did not read as one.
  let headerClock: ReactNode;
  if (done) headerClock = formatDuration(totalTime(answers) / 1000);
  else if (showStartButton) {
    headerClock = (
      <>
        <IconButton variant="secondary" size="sm" aria-label="Start the clock" className="sm:hidden" onClick={startManually}>
          <Play className="h-4 w-4" aria-hidden="true" />
        </IconButton>
        <Button variant="secondary" size="sm" className="max-sm:hidden" onClick={startManually}>
          <Play className="h-4 w-4" aria-hidden="true" />
          Start the clock
        </Button>
      </>
    );
  } else if (paused && !current) {
    headerClock = (
      <span className="inline-flex items-center gap-1">
        <Pause className="h-3.5 w-3.5 sm:hidden" aria-hidden="true" />
        <span className="max-sm:sr-only">Paused · </span>
        {formatClock(shown)}
      </span>
    );
  } else headerClock = <Odometer value={formatClock(shown)} animate={!reduce} />;

  return (
    <div className="relative mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-6 px-4 pb-12 pt-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_460px] lg:items-start lg:gap-14 lg:px-8 lg:pb-24 lg:pt-16">
      <div>
        <h1
          id="warmup-heading"
          className="text-3xl/9 font-semibold tracking-tight text-balance text-gray-900 lg:text-5xl lg:leading-[1.05]"
        >
          Digital SAT Math practice that feels like test day.
        </h1>
        <p className="mt-4 max-w-[52ch] text-base leading-7 text-pretty text-gray-600 lg:text-lg lg:leading-8">
          Full timed tests on a screen like the real one. After each, a score estimate on the 200–800 scale
          and a review of every question. Made for students aiming at 750–800.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link href="/register?from=hero" className={buttonClass({ size: 'lg' })}>
            {FREE_OFFER_CTA}
          </Link>
          <span className="text-sm text-gray-600">
            {freeTests ? `${freeTestsPhrase(freeTests)} ` : ''}No payment details.
          </span>
        </div>

        {/* The demo's own line, with the card's clock in it. It never
            reflows: only the digits change, and they are tabular. */}
        <div className="mt-8 border-t border-gray-200 pt-6 lg:mt-12">
          <p className="text-lg font-semibold tracking-tight text-gray-900">
            Or try three questions first. Each one harder. You have{' '}
            <span className={cn('inline-flex tabular-nums', hurry ? 'text-amber-700' : 'text-ink-600')}>
              <Odometer value={heroClock} animate={!reduce} />
            </span>
            .
          </p>
          <p key={friendLine ?? 'default'} className={cn('mt-1 text-sm text-gray-600', friendLine && styles.fade)}>
            {friendLine ?? 'No sign-up. Your answers stay on this page.'}
          </p>
          <div className="mt-4 hidden max-w-[52ch] text-sm text-gray-600 lg:block">{WHY_NOTE}</div>
        </div>
      </div>

      <div>
        <div
          ref={cardRef}
          id={CARD_ID}
          aria-label="Warm-up"
          role="region"
          className={cn(
            'relative min-h-[420px] scroll-mt-20 overflow-hidden rounded-2xl border border-gray-200 bg-white',
            styles.cardIn,
          )}
        >
          <div className="flex h-11 items-center justify-between gap-2 border-b border-gray-100 px-4">
            <div className="flex min-w-0 items-center gap-2">
              <h2 id={WARMUP_TITLE_ID} tabIndex={-1} className="whitespace-nowrap text-sm font-semibold text-gray-900 focus:outline-hidden">
                {done ? 'Your warm-up' : `Question ${index + 1} of 3`}
              </h2>
              <Badge>{done ? 'Done' : question.chip}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <RiseMeter ref={meterRef} answers={answers} hidden={done} />
              <span className={cn('whitespace-nowrap text-sm font-medium tabular-nums', hurry ? 'text-amber-700' : 'text-gray-500')}>
                {headerClock}
              </span>
            </div>
          </div>

          <div className="relative h-[3px] overflow-hidden bg-gray-100" aria-hidden="true">
            <i
              ref={barRef}
              className={cn('absolute inset-0 origin-left', hurry ? 'bg-amber-600' : 'bg-ink-600')}
              style={{ transform: 'scaleX(1)' }}
            />
          </div>

          <div className="p-4">
            {done ? (
              <WarmupResult answers={answers} totalMs={totalTime(answers)} from={result.from} reduce={reduce} />
            ) : (
              <div className={slideClass[slide]}>
                <QuestionBody question={question} />
                {question.kind === 'choice' && question.figure && (
                  <TangentFigure checked={current !== null} given={current?.given ?? null} reduce={reduce} onSettled={onSettled} />
                )}

                {question.kind === 'choice' ? (
                  <Choices
                    question={question}
                    name={`warmup-${index}`}
                    selected={selected}
                    answer={current}
                    onSelect={setSelected}
                  />
                ) : (
                  <GridIn
                    question={question}
                    value={typed}
                    answer={current}
                    inputRef={inputRef}
                    onChange={setTyped}
                    onEnter={() => submit(false)}
                  />
                )}

                <div className="mt-4 grid justify-items-center gap-2">
                  {!current ? (
                    <>
                      <Button
                        size="lg"
                        block
                        disabled={question.kind === 'choice' ? selected === null : typed.trim() === ''}
                        onClick={() => submit(false)}
                      >
                        Check
                      </Button>
                      {/* Outlined and smaller than Check: a real choice, so it
                          looks pressable, but not the one the card leads to. */}
                      <Button variant="secondary" onClick={() => submit(true)}>
                        Not sure? Show me
                      </Button>
                    </>
                  ) : index < QUESTIONS.length - 1 ? (
                    <button ref={nextRef} type="button" className={buttonClass({ size: 'lg', block: true })} onClick={goNext}>
                      Next question
                    </button>
                  ) : swingDone ? (
                    <button
                      ref={nextRef}
                      type="button"
                      className={buttonClass({ size: 'lg', block: true, className: styles.fadeUp })}
                      onClick={showResult}
                    >
                      See my result
                    </button>
                  ) : null}
                </div>

                <div aria-live="polite" className="mt-3 text-sm leading-6">
                  {current && (
                    <div className={styles.fadeUp}>
                      <Feedback status={current.status} message={feedbackFor(question, current.given, current.status)} />
                      {current.status === 'incorrect' && answers.findIndex((a) => a.status === 'incorrect') === index && (
                        <span className="mt-1.5 block text-gray-500">Nobody saw that. That’s the point.</span>
                      )}
                    </div>
                  )}
                  {current && question.kind === 'grid-in' && <Parallels />}
                </div>

                {expired && (
                  <p className={cn('mt-2 text-sm text-amber-700', styles.fadeUpSlow)}>
                    Time’s up. On test day you’d move on. Here, finish it.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 text-sm text-gray-600 lg:hidden">{WHY_NOTE}</div>
      </div>
    </div>
  );
}

/* ───────────────────────────── pieces ───────────────────────────── */

function QuestionBody({ question }: { question: (typeof QUESTIONS)[number] }) {
  if (question.kind === 'grid-in') {
    return (
      <div className="text-base leading-7 text-gray-900">
        <p className="mb-1 text-xs text-gray-500">{question.kicker}</p>
        <p>
          <MathText parts={question.stem} />
        </p>
        <div className="mt-2 grid gap-1">
          {question.equations.map((line, i) => (
            <span key={i}>
              <MathText parts={line} math />
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <p className="text-base leading-7 text-gray-900">
      <MathText parts={question.stem} />
    </p>
  );
}

function Choices({
  question,
  name,
  selected,
  answer,
  onSelect,
}: {
  question: ChoiceQuestion;
  name: string;
  selected: string | null;
  answer: WarmupAnswer | null;
  onSelect: (letter: string) => void;
}) {
  return (
    <fieldset className={cn('mt-4 grid gap-2', question.grid && 'grid-cols-2')} disabled={answer !== null}>
      <legend className="sr-only">Answer choices</legend>
      {question.options.map((option) => {
        const isCorrect = answer !== null && option.letter === question.correct;
        const isWrongPick = answer !== null && !isCorrect && option.letter === answer.given;
        const isSelected = answer === null && option.letter === selected;
        const dim = answer !== null && !isCorrect && !isWrongPick;

        return (
          <label
            key={option.letter}
            className={cn(
              'relative flex min-h-12 items-center gap-2 rounded-xl border bg-white px-3 py-1.5 text-left text-base',
              'transition-[color,transform] duration-160 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink-600',
              answer === null && 'cursor-pointer hover:border-gray-400 active:scale-[0.98]',
              isCorrect
                ? 'border-green-700 bg-green-50'
                : isWrongPick
                  ? 'border-red-600 bg-red-50'
                  : isSelected
                    ? 'border-ink-600 bg-ink-50 ring-1 ring-ink-600'
                    : 'border-gray-300',
              // The options it was not about step back in the palette, not
              // through opacity, which turned them into off-palette tints.
              dim && 'text-gray-500',
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.letter}
              checked={isSelected}
              onChange={() => onSelect(option.letter)}
              className="sr-only"
            />
            <span
              className={cn(
                'grid h-6 w-6 shrink-0 place-items-center rounded-lg border text-xs font-medium',
                isCorrect
                  ? 'border-green-700 bg-green-700 text-white'
                  : isWrongPick
                    ? 'border-red-600 bg-red-600 text-white'
                    : isSelected
                      ? 'border-ink-600 bg-ink-600 text-white'
                      : 'border-gray-300 text-gray-600',
              )}
            >
              {option.letter}
            </span>
            <span className="tabular-nums">
              <MathText parts={option.value} math />
            </span>
            {isCorrect && (
              <>
                <Check className={cn('absolute right-2.5 top-1/2 -mt-2 h-4 w-4 text-green-700', styles.pop)} aria-hidden="true" />
                <span className="sr-only">Correct answer</span>
              </>
            )}
            {isWrongPick && (
              <>
                <X className={cn('absolute right-2.5 top-1/2 -mt-2 h-4 w-4 text-red-600', styles.pop)} aria-hidden="true" />
                <span className="sr-only">Your answer</span>
              </>
            )}
          </label>
        );
      })}
    </fieldset>
  );
}

function GridIn({
  question,
  value,
  answer,
  inputRef,
  onChange,
  onEnter,
}: {
  question: GridInQuestion;
  value: string;
  answer: WarmupAnswer | null;
  inputRef: RefObject<HTMLInputElement | null>;
  onChange: (value: string) => void;
  onEnter: () => void;
}) {
  // The iOS decimal keypad has no minus key, so the sign is its own toggle.
  const negative = /^[-−]/.test(value);
  const shown = answer?.status === 'skipped' ? `${MINUS}${Math.abs(question.correctValue)}` : value;
  // The toggle reads the field as shown: once "Show me" fills in −2, it is on.
  const shownNegative = /^[-−]/.test(shown);
  // One border colour at a time: cn() does not merge, and two would fight.
  const tone =
    answer === null
      ? 'border-gray-400 bg-white hover:border-gray-500'
      : answer.status === 'incorrect'
        ? 'border-red-600 bg-red-50'
        : 'border-green-700 bg-green-50';

  return (
    <div className="mt-4 flex gap-2">
      <button
        type="button"
        aria-label="Negative"
        aria-pressed={shownNegative}
        disabled={answer !== null}
        onClick={() => {
          onChange(negative ? value.replace(/^[-−]/, '') : `-${value}`);
          inputRef.current?.focus();
        }}
        className={cn(
          'h-12 w-12 shrink-0 rounded-lg border text-xl transition-colors',
          focusRingClass,
          // No hover once the answer is locked: it no longer does anything.
          shownNegative
            ? 'border-ink-600 bg-ink-50 text-ink-700'
            : // Keyed like a secondary button (Button.tsx): a gray-400 box
              // with a darker bottom edge, over a hairline shadow.
              'border-gray-400 border-b-gray-500 bg-white text-gray-900 shadow-xs enabled:hover:border-gray-500 enabled:hover:bg-gray-50 enabled:active:shadow-none',
        )}
      >
        {MINUS}
      </button>
      <input
        ref={inputRef}
        inputMode="decimal"
        autoComplete="off"
        placeholder="Your answer"
        aria-label="Your answer"
        value={shown}
        disabled={answer !== null}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && value.trim() !== '') {
            // No keypress after it, so the same Enter cannot also press the
            // "Next question" button that takes focus next.
            event.preventDefault();
            onEnter();
          }
        }}
        className={cn(
          'h-12 min-w-0 flex-1 rounded-lg border px-3 text-xl font-semibold tabular-nums text-gray-900 focus:outline-hidden',
          'placeholder:text-base placeholder:font-normal placeholder:text-gray-500',
          fieldFocusClass,
          tone,
        )}
      />
    </div>
  );
}

function Feedback({ status, message }: { status: WarmupAnswer['status']; message: string }) {
  const tag =
    status === 'correct'
      ? { text: 'Correct.', className: 'text-green-800' }
      : status === 'skipped'
        ? { text: 'Not answered.', className: 'text-gray-500' }
        : { text: 'Not this time.', className: 'text-red-700' };

  return (
    <p className="text-gray-700">
      <span className={cn('font-semibold', tag.className)}>{tag.text}</span> {message}
    </p>
  );
}

/** After Q2: the two lines the system describes, drawn only once it is answered. */
function Parallels() {
  return (
    <div className="mt-3 flex items-center gap-3 text-sm text-gray-500">
      <svg width="100" height="44" viewBox="0 0 100 44" aria-hidden="true">
        <line x1="4" y1="34" x2="96" y2="6" className={cn('stroke-ink-600', styles.drawX)} strokeWidth="2.2" strokeLinecap="round" />
        <line x1="4" y1="42" x2="96" y2="14" className={cn('stroke-ink-600', styles.drawX)} strokeWidth="2.2" strokeLinecap="round" />
      </svg>
      <span>Same slope. Never meet.</span>
    </div>
  );
}
