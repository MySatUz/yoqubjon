'use client';

import 'katex/dist/katex.min.css';
import React, { useId, useState } from 'react';
import { flushSync } from 'react-dom';
import { unstable_rethrow } from 'next/navigation';
import { ArrowDown, ArrowUp, Dices, ListChecks, Loader2, Plus, RotateCcw, Wand2, X } from 'lucide-react';
import { createTestFromBank } from '@/app/admin/actions';
import { pickBankQuestions } from '@/app/admin/bank/actions';
import { BankPicker, useBankPicker } from '@/components/admin/bank/BankPicker';
import { BankTagBadges, KindBadge, choiceTileClass } from '@/components/admin/bank/bankBadges';
import { Button, IconButton } from '@/components/ui/Button';
import { CardBody, CardFooter, CardHeader, cardClass } from '@/components/ui/Card';
import { Alert, EmptyState } from '@/components/ui/Feedback';
import { Field, Input, Select, checkboxClass, hintClass, labelClass } from '@/components/ui/Field';
import { segmentClass, segmentedClass } from '@/components/ui/Misc';
import { cn } from '@/components/ui/cn';
import {
  DEFAULT_MODULE_COUNT,
  DEFAULT_MODULE_DURATION_SECONDS,
  MAX_MODULE_COUNT,
} from '@/lib/examModules';
import { MAX_TEST_MAX_ATTEMPTS, MIN_TEST_MAX_ATTEMPTS } from '@/lib/testAttempts';
import {
  BANK_DIFFICULTIES,
  BANK_DOMAINS,
  getDifficultyLabel,
  toggleValue,
  type BankDifficulty,
  type BankDomain,
  type BankPickRow,
} from '@/lib/questionBank';

export type BuildCourse = { value: string; label: string; maxAttempts: number };

/** How many bank questions there are per domain and difficulty (a groupBy). */
export type BankAvailability = { domain: string | null; difficulty: number | null; count: number }[];

type Method = 'manual' | 'random';
type Shortage = { difficulty: BankDifficulty; requested: number; available: number };

/** Counts are strings while typed, so clearing a field does not turn into `NaN`. */
type RandomDraft = {
  counts: Record<BankDifficulty, string>;
  domains: BankDomain[];
  /** Null until the first pick. */
  picked: BankPickRow[] | null;
  shortages: Shortage[];
};

type ModuleDraft = {
  key: string;
  minutes: string;
  method: Method;
  manual: BankPickRow[];
  random: RandomDraft;
};

const DEFAULT_MODULE_MINUTES = String(Math.round(DEFAULT_MODULE_DURATION_SECONDS / 60));
/** As the course's .tex upload starts a one-block test. */
const DEFAULT_BLOCK_MINUTES = '120';
const MIN_MODULES = 2;

let moduleCounter = 0;

function newModule(): ModuleDraft {
  moduleCounter += 1;
  return {
    key: `module-${moduleCounter}`,
    minutes: DEFAULT_MODULE_MINUTES,
    method: 'manual',
    manual: [],
    random: { counts: { 1: '', 2: '', 3: '' }, domains: [], picked: null, shortages: [] },
  };
}

function readCount(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function readMinutes(value: string, fallback: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : Number(fallback);
}

function questionCount(count: number) {
  return `${count} ${count === 1 ? 'question' : 'questions'}`;
}

function chosenOf(module: ModuleDraft) {
  return module.method === 'manual' ? module.manual : module.random.picked ?? [];
}

function matchesDomains(domain: string | null, domains: BankDomain[]) {
  return domains.length === 0 || (domain !== null && (domains as string[]).includes(domain));
}

/**
 * Builds a test in a course from the question bank: the settings a test
 * needs, then each module - or the one block - filled by hand (ticked in the
 * bank, in order) or at random (so many of each difficulty, from some
 * domains or all). No question can be in two modules. "Create test" makes
 * the test with copies of the chosen questions (`createTestFromBank`) and
 * opens it.
 */
export default function BuildTestForm({
  courses,
  defaultCourse,
  availability,
}: {
  courses: BuildCourse[];
  defaultCourse: string | null;
  availability: BankAvailability;
}) {
  const fieldId = useId();
  // No course in the URL: the admin picks one, rather than a test landing
  // in whichever course happens to be first.
  const [course, setCourse] = useState(defaultCourse ?? '');
  const courseAttempts = (value: string) => courses.find((item) => item.value === value)?.maxAttempts;
  const [title, setTitle] = useState('');
  const [format, setFormat] = useState<'modular' | 'single'>('modular');
  const [modules, setModules] = useState<ModuleDraft[]>(() => Array.from({ length: DEFAULT_MODULE_COUNT }, newModule));
  const [blockMinutes, setBlockMinutes] = useState(DEFAULT_BLOCK_MINUTES);
  const [attempts, setAttempts] = useState(() => String(courseAttempts(course) ?? 10));
  // Hidden by default: a built test is usually homework for one day, shown
  // when the teacher sets it.
  const [visible, setVisible] = useState(false);
  const [isFree, setIsFree] = useState(false);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [pickingKey, setPickingKey] = useState<string | null>(null);
  const [pickErrors, setPickErrors] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const picker = useBankPicker();

  // One block keeps the first module's questions; switching back to modules
  // brings the others back as they were.
  const active = format === 'single' ? modules.slice(0, 1) : modules;
  const moduleName = (index: number) => (format === 'single' ? 'the test' : `module ${index + 1}`);

  /** Question id → the module that has it, over every module but `skip`. */
  const usedElsewhere = (skip: number) => {
    const used = new Map<string, string>();
    active.forEach((module, index) => {
      if (index === skip) return;
      for (const row of chosenOf(module)) used.set(row.id, moduleName(index));
    });
    return used;
  };

  // Only reachable by switching a module between its two lists: the picker
  // and the random pick both leave out the other modules' questions.
  const seenCount = new Map<string, number>();
  for (const draft of active) {
    for (const row of chosenOf(draft)) seenCount.set(row.id, (seenCount.get(row.id) ?? 0) + 1);
  }
  const conflicts = new Set([...seenCount].filter(([, count]) => count > 1).map(([id]) => id));

  const totalQuestions = active.reduce((total, module) => total + chosenOf(module).length, 0);
  const emptyModule = active.findIndex((module) => chosenOf(module).length === 0);

  const blocker = !course
    ? 'Choose a course.'
    : !title.trim()
      ? 'Give the test a title.'
      : emptyModule >= 0
        ? (format === 'single' ? 'Choose the questions first.' : `Module ${emptyModule + 1} has no questions yet.`)
        : conflicts.size > 0
          ? `${questionCount(conflicts.size)} ${conflicts.size === 1 ? 'is' : 'are'} in two modules. Remove ${conflicts.size === 1 ? 'it' : 'them'} from one.`
          : null;

  const updateModule = (key: string, update: (module: ModuleDraft) => ModuleDraft) => {
    setModules((current) => current.map((module) => (module.key === key ? update(module) : module)));
  };

  /** What a random pick can draw from: the bank's matching questions less the other modules'. */
  const available = (difficulty: BankDifficulty, domains: BankDomain[], skip: number) => {
    const inBank = availability
      .filter((row) => row.difficulty === difficulty && matchesDomains(row.domain, domains))
      .reduce((total, row) => total + row.count, 0);
    const taken = active
      .filter((_, index) => index !== skip)
      .flatMap(chosenOf)
      .filter((row) => row.difficulty === difficulty && matchesDomains(row.domain, domains)).length;
    return Math.max(0, inBank - taken);
  };

  const pick = async (key: string) => {
    const index = active.findIndex((item) => item.key === key);
    const draft = active[index];
    if (!draft) return;

    setPickingKey(key);
    setPickErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });

    let response: Awaited<ReturnType<typeof pickBankQuestions>>;
    try {
      response = await pickBankQuestions({
        counts: {
          1: readCount(draft.random.counts[1]),
          2: readCount(draft.random.counts[2]),
          3: readCount(draft.random.counts[3]),
        },
        domains: draft.random.domains,
        excludeIds: [...usedElsewhere(index).keys()],
      });
    } catch {
      response = { success: false, error: 'No questions were picked. Check your connection and try again.' };
    }

    setPickingKey(null);
    if (!response.success) {
      setPickErrors((current) => ({ ...current, [key]: response.error }));
      return;
    }

    const { questions, shortages } = response;
    updateModule(key, (current) => ({
      ...current,
      random: { ...current.random, picked: questions, shortages },
    }));
  };

  const removeModule = (key: string) => {
    setModules((current) => current.filter((module) => module.key !== key));
  };

  const create = async () => {
    if (blocker || creating) return;
    setCreating(true);
    setCreateError(null);

    try {
      // On success the action opens the new test, so only a failure returns.
      const response = await createTestFromBank({
        course,
        title: title.trim(),
        format,
        minutes: format === 'single'
          ? [readMinutes(blockMinutes, DEFAULT_BLOCK_MINUTES)]
          : active.map((module) => readMinutes(module.minutes, DEFAULT_MODULE_MINUTES)),
        modules: active.map((module) => chosenOf(module).map((row) => row.id)),
        maxAttempts: attempts,
        visible,
        isFree,
      });
      if (response && !response.success) {
        setCreateError(response.error);
        setCreating(false);
      }
    } catch (error) {
      // The action's redirect rejects this call too: the test exists and the
      // router is already opening it, so it is no failure, and the button
      // stays busy - an enabled one invited a second, duplicate test.
      unstable_rethrow(error);
      setCreateError('The test was not created. Check your connection and try again.');
      setCreating(false);
    }
  };

  // Opens on the search, as the bank page does: nothing is listed until the
  // admin searches. Later opens keep the choices and the results.
  const openPicker = (key: string) => setPickerFor(key);

  // The empty state's "Choose questions" goes away with the first tick, so
  // the dialog has no opener to give focus back to: it goes to the module's
  // "Choose more questions" instead of falling to the top of the page.
  const closePicker = () => {
    const key = pickerFor;
    flushSync(() => setPickerFor(null));
    if (!key) return;
    const target = document.querySelector<HTMLElement>(`[data-choose-questions="${key}"]`);
    if (target && !target.contains(document.activeElement)) target.focus();
  };

  const pickerIndex = active.findIndex((module) => module.key === pickerFor);
  const pickerModule = pickerIndex >= 0 ? active[pickerIndex] : null;
  const courseLimit = courseAttempts(course);

  return (
    <div className="space-y-6">
      <section className={cardClass} aria-labelledby={`${fieldId}-settings`}>
        <CardHeader title={<span id={`${fieldId}-settings`}>Test</span>} description="Title, course, format and access." />
        <CardBody className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
          <Field label="Test title" htmlFor={`${fieldId}-title`}>
            <Input
              id={`${fieldId}-title`}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={200}
              required
              placeholder="e.g., Homework 12 · Linear equations"
            />
          </Field>

          <Field label="Course" htmlFor={`${fieldId}-course`}>
            <Select
              id={`${fieldId}-course`}
              value={course}
              onChange={(event) => {
                setCourse(event.target.value);
                setAttempts(String(courseAttempts(event.target.value) ?? attempts));
              }}
            >
              {!course && <option value="">Choose course</option>}
              {courses.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </Select>
          </Field>

          <div className="space-y-2 sm:col-span-2">
            <p id={`${fieldId}-format`} className={labelClass}>Format</p>
            <div role="radiogroup" aria-labelledby={`${fieldId}-format`} className={segmentedClass}>
              {([
                { value: 'modular' as const, label: 'Modules' },
                { value: 'single' as const, label: 'One block' },
              ]).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={format === option.value}
                  onClick={() => setFormat(option.value)}
                  className={segmentClass(format === option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {format === 'modular' ? (
              <div className="space-y-2 pt-1">
                <p className={hintClass}>Each module runs on its own timer and has its own questions.</p>
                {modules.map((module, index) => (
                  <div key={module.key} className="flex flex-wrap items-center gap-2">
                    <span className="w-20 text-sm text-mist-600">Module {index + 1}</span>
                    <Input
                      type="number"
                      min={1}
                      max={360}
                      step={1}
                      aria-label={`Module ${index + 1} minutes`}
                      value={module.minutes}
                      onChange={(event) => updateModule(module.key, (current) => ({ ...current, minutes: event.target.value }))}
                      suffix="minutes"
                      className="max-w-36"
                    />
                    {modules.length > MIN_MODULES && (
                      <IconButton
                        variant="danger-secondary"
                        onClick={() => removeModule(module.key)}
                        aria-label={`Remove module ${index + 1}`}
                        title="Remove module"
                      >
                        <X className="h-4 w-4" />
                      </IconButton>
                    )}
                  </div>
                ))}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setModules((current) => [...current, newModule()])}
                  disabled={modules.length >= MAX_MODULE_COUNT}
                >
                  <Plus className="h-4 w-4" />
                  Add module
                </Button>
              </div>
            ) : (
              <div className="max-w-xs pt-1">
                <p className={cn(hintClass, 'mb-2')}>One timer for the whole test, e.g. 30 questions in 60 minutes.</p>
                <Input
                  type="number"
                  min={1}
                  max={360}
                  step={1}
                  aria-label="Test time in minutes"
                  value={blockMinutes}
                  onChange={(event) => setBlockMinutes(event.target.value)}
                  suffix="minutes"
                />
              </div>
            )}
          </div>

          <Field
            label="Attempts per student"
            htmlFor={`${fieldId}-attempts`}
            hint={courseLimit !== undefined ? `The course allows ${courseLimit}.` : undefined}
          >
            <Input
              id={`${fieldId}-attempts`}
              type="number"
              min={MIN_TEST_MAX_ATTEMPTS}
              max={MAX_TEST_MAX_ATTEMPTS}
              step={1}
              value={attempts}
              onChange={(event) => setAttempts(event.target.value)}
              suffix="attempts"
            />
          </Field>

          <div className="space-y-2 self-end">
            <label className="flex items-center gap-2 text-sm text-mist-700">
              <input
                type="checkbox"
                checked={visible}
                onChange={(event) => setVisible(event.target.checked)}
                className={checkboxClass}
              />
              Show in Practice
            </label>
            <label className="flex items-center gap-2 text-sm text-mist-700">
              <input
                type="checkbox"
                checked={isFree}
                onChange={(event) => setIsFree(event.target.checked)}
                className={checkboxClass}
              />
              Free without a subscription
            </label>
          </div>
          {!visible && (
            <p className={cn(hintClass, 'sm:col-span-2')}>
              Students do not see it until it is shown in Practice, e.g. on the day it is set as homework. You can show it later from the course&rsquo;s test list or the test page.
            </p>
          )}
        </CardBody>
      </section>

      {active.map((module, index) => (
        <ModuleCard
          key={module.key}
          title={format === 'single' ? 'Questions' : `Module ${index + 1}`}
          methodLabel={format === 'single'
            ? 'How to choose the questions'
            : `How to choose the questions of module ${index + 1}`}
          minutes={format === 'single' ? blockMinutes : module.minutes}
          module={module}
          conflicts={conflicts}
          usedIn={usedElsewhere(index)}
          available={(difficulty) => available(difficulty, module.random.domains, index)}
          picking={pickingKey === module.key}
          pickError={pickErrors[module.key] ?? null}
          onMethod={(method) => updateModule(module.key, (current) => ({ ...current, method }))}
          onManual={(manual) => updateModule(module.key, (current) => ({ ...current, manual }))}
          onRandom={(patch) => updateModule(module.key, (current) => ({ ...current, random: { ...current.random, ...patch } }))}
          onChoose={() => openPicker(module.key)}
          onPick={() => void pick(module.key)}
          onEditByHand={() => updateModule(module.key, (current) => ({
            ...current,
            method: 'manual',
            manual: current.random.picked ?? [],
          }))}
        />
      ))}

      <div className={cn(cardClass, 'flex flex-wrap items-center justify-end gap-3 px-5 py-4')}>
        <p className="mr-auto text-sm tabular-nums text-mist-600">
          {blocker ?? (
            format === 'single'
              ? `${questionCount(totalQuestions)} on one timer.`
              : `${questionCount(totalQuestions)} in ${active.length} modules.`
          )}
        </p>
        {createError && (
          <p role="alert" className="basis-full text-sm text-red-600 sm:order-first">{createError}</p>
        )}
        <Button onClick={() => void create()} disabled={creating || blocker !== null}>
          {creating && <Loader2 className="h-4 w-4 animate-spin" />}
          Create test
        </Button>
      </div>

      {pickerModule && (
        <BankPicker
          open
          onClose={closePicker}
          title={format === 'single' ? 'Choose questions' : `Choose questions for module ${pickerIndex + 1}`}
          picker={picker}
          availability={availability}
          chosen={pickerModule.manual}
          usedElsewhere={usedElsewhere(pickerIndex)}
          onToggle={(row) => updateModule(pickerModule.key, (current) => ({
            ...current,
            manual: current.manual.some((item) => item.id === row.id)
              ? current.manual.filter((item) => item.id !== row.id)
              : [...current.manual, row],
          }))}
        />
      )}
    </div>
  );
}

function ModuleCard({
  title,
  methodLabel,
  minutes,
  module,
  conflicts,
  usedIn,
  available,
  picking,
  pickError,
  onMethod,
  onManual,
  onRandom,
  onChoose,
  onPick,
  onEditByHand,
}: {
  title: string;
  /** The name of the By hand / Random control; a one-block test has no module to name. */
  methodLabel: string;
  minutes: string;
  module: ModuleDraft;
  conflicts: Set<string>;
  usedIn: Map<string, string>;
  available: (difficulty: BankDifficulty) => number;
  picking: boolean;
  pickError: string | null;
  onMethod: (method: Method) => void;
  onManual: (rows: BankPickRow[]) => void;
  onRandom: (patch: Partial<RandomDraft>) => void;
  onChoose: () => void;
  onPick: () => void;
  onEditByHand: () => void;
}) {
  const fieldId = useId();
  const rows = chosenOf(module);
  const requested = BANK_DIFFICULTIES.reduce((total, difficulty) => total + readCount(module.random.counts[difficulty.value]), 0);

  const move = (index: number, step: -1 | 1) => {
    const next = [...module.manual];
    const [row] = next.splice(index, 1);
    next.splice(index + step, 0, row);
    onManual(next);
  };

  return (
    <section className={cardClass} aria-labelledby={`${fieldId}-title`}>
      <CardHeader
        title={<span id={`${fieldId}-title`}>{title}</span>}
        description={<span className="tabular-nums">{`${questionCount(rows.length)} · ${minutes || '—'} min`}</span>}
        actions={
          <div role="radiogroup" aria-label={methodLabel} className={segmentedClass}>
            {([
              { value: 'manual' as const, label: 'By hand', icon: <ListChecks className="h-4 w-4" /> },
              { value: 'random' as const, label: 'Random', icon: <Dices className="h-4 w-4" /> },
            ]).map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={module.method === option.value}
                onClick={() => onMethod(option.value)}
                className={segmentClass(module.method === option.value)}
              >
                {option.icon}
                {option.label}
              </button>
            ))}
          </div>
        }
      />

      {module.method === 'random' && (
        <CardBody className="space-y-4">
          <fieldset>
            <legend className={cn(labelClass, 'mb-1.5')}>How many of each difficulty</legend>
            <div className="flex flex-wrap gap-3">
              {BANK_DIFFICULTIES.map((difficulty) => {
                const count = readCount(module.random.counts[difficulty.value]);
                const inBank = available(difficulty.value);
                const short = count > inBank;

                return (
                  <div key={difficulty.value} className="w-36 space-y-1">
                    {/* Field's Input, so a count the bank cannot meet turns its border red, not only the caption. */}
                    <Input
                      type="number"
                      min={0}
                      max={200}
                      step={1}
                      inputMode="numeric"
                      placeholder="0"
                      aria-label={`${difficulty.label} questions`}
                      aria-invalid={short || undefined}
                      value={module.random.counts[difficulty.value]}
                      onChange={(event) => onRandom({
                        counts: { ...module.random.counts, [difficulty.value]: event.target.value },
                      })}
                      suffix={difficulty.label}
                    />
                    <p className={cn('text-xs tabular-nums', short ? 'text-red-600' : 'text-mist-500')}>
                      {short ? `Only ${inBank} match` : `${inBank} in the bank`}
                    </p>
                  </div>
                );
              })}
            </div>
          </fieldset>

          {/* The bank page's domain tiles, without counts: the counts that matter here are per difficulty, above. */}
          <fieldset className="space-y-1.5">
            <legend className={labelClass}>Domains</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {BANK_DOMAINS.map((domain) => (
                <label key={domain.value} className={choiceTileClass}>
                  <input
                    type="checkbox"
                    checked={module.random.domains.includes(domain.value)}
                    onChange={() => onRandom({ domains: toggleValue(module.random.domains, domain.value) })}
                    className={checkboxClass}
                  />
                  <span className="min-w-0 flex-1 text-sm font-medium text-mist-900">{domain.label}</span>
                </label>
              ))}
            </div>
            <p className={hintClass}>All domains while none is chosen.</p>
          </fieldset>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={onPick} disabled={picking || requested === 0}>
              {picking
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : module.random.picked ? <RotateCcw className="h-4 w-4" /> : <Dices className="h-4 w-4" />}
              {module.random.picked ? 'Pick again' : 'Pick questions'}
            </Button>
            {module.random.picked && module.random.picked.length > 0 && (
              <Button variant="quiet" onClick={onEditByHand} disabled={picking}>
                <Wand2 className="h-4 w-4" />
                Edit this list by hand
              </Button>
            )}
            {requested === 0 && <p className="text-sm text-mist-500">Set at least one count.</p>}
          </div>

          {pickError && <Alert tone="danger">{pickError}</Alert>}

          {module.random.shortages.length > 0 && (
            <Alert>
              {module.random.shortages
                .map((shortage) => `Only ${shortage.available} ${getDifficultyLabel(shortage.difficulty)} ${shortage.available === 1 ? 'question matches' : 'questions match'}, not ${shortage.requested}.`)
                .join(' ')}
              {' '}The list has what there is.
            </Alert>
          )}
        </CardBody>
      )}

      {rows.length > 0 ? (
        <ol className={cn('divide-y divide-mist-100', module.method === 'random' && 'border-t border-mist-100')}>
          {rows.map((row, index) => {
            const elsewhere = conflicts.has(row.id) ? usedIn.get(row.id) : undefined;

            return (
              <li key={row.id} className="flex items-center gap-3 px-4 py-2 sm:px-5">
                <span className="w-6 shrink-0 text-right text-xs tabular-nums text-mist-500">{index + 1}</span>
                <span className="min-w-0 flex-1">
                  <span
                    className="line-clamp-1 block text-sm text-mist-700"
                    dangerouslySetInnerHTML={{ __html: row.previewHtml || '<span class="text-mist-500">Image only</span>' }}
                  />
                  {elsewhere && <span className="block text-xs text-red-600">Also in {elsewhere}</span>}
                </span>
                <span className="hidden shrink-0 items-center gap-1 sm:flex">
                  <BankTagBadges domain={row.domain} difficulty={row.difficulty} />
                  <KindBadge kind={row.kind} />
                </span>
                {module.method === 'manual' && (
                  <span className="flex shrink-0 items-center gap-1">
                    <IconButton
                      variant="secondary"
                      size="sm"
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      aria-label={`Move question ${index + 1} up`}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </IconButton>
                    <IconButton
                      variant="secondary"
                      size="sm"
                      onClick={() => move(index, 1)}
                      disabled={index === rows.length - 1}
                      aria-label={`Move question ${index + 1} down`}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </IconButton>
                    <IconButton
                      variant="danger-secondary"
                      size="sm"
                      onClick={() => onManual(module.manual.filter((item) => item.id !== row.id))}
                      aria-label={`Remove question ${index + 1}`}
                    >
                      <X className="h-4 w-4" />
                    </IconButton>
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      ) : module.method === 'manual' ? (
        // Where the list will be, with the one button that fills it; the
        // footer's "Choose more" takes over once there is a list.
        <CardBody>
          <EmptyState
            icon={<ListChecks />}
            title="No questions yet"
            description="They are asked in the order you tick them."
            action={
              <Button variant="secondary" data-choose-questions={module.key} onClick={onChoose}>
                <ListChecks className="h-4 w-4" />
                Choose questions
              </Button>
            }
          />
        </CardBody>
      ) : null}

      {module.method === 'manual' && rows.length > 0 && (
        <CardFooter>
          <Button variant="secondary" data-choose-questions={module.key} onClick={onChoose}>
            <ListChecks className="h-4 w-4" />
            Choose more questions
          </Button>
        </CardFooter>
      )}
    </section>
  );
}
