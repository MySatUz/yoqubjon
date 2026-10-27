'use client';

import React, { useId, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import Link from 'next/link';
import { updateQuestion, updateTestDetails } from '@/app/admin/actions';
import { AlertCircle, CheckCircle2, ChevronDown, Edit3, Library, Loader2, Plus, Save, X } from 'lucide-react';
import { getTestCategory, type TestCollectionOption } from '@/lib/testCatalog';
import { MAX_TEST_MAX_ATTEMPTS, MIN_TEST_MAX_ATTEMPTS } from '@/lib/testAttempts';
import { readModuleDurations, secondsToMinutes } from '@/lib/examModules';
import { isMultiSelectKey } from '@/lib/resultAnswers';
import { formatBankTags, isBankDifficulty, isBankDomain } from '@/lib/questionBank';
import AccessCodeField from '@/components/admin/AccessCodeField';
import OlympiadWindowFields from '@/components/admin/OlympiadWindowFields';
import { affixControlClass, affixInputClass, affixTextClass } from '@/components/admin/adminControls';
import { Badge } from '@/components/ui/Badge';
import { Button, IconButton, buttonClass, linkClass } from '@/components/ui/Button';
import { CardBody, CardFooter, CardHeader, cardClass, insetClass } from '@/components/ui/Card';
import { Field, Input, Select, Textarea, checkboxClass, hintClass, labelClass } from '@/components/ui/Field';
import { List } from '@/components/ui/List';
import { cn } from '@/components/ui/cn';

export type EditorQuestion = {
  id: string;
  content: string;
  options: unknown;
  correctAnswer: string;
  explanation: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  order: number;
  /** The opening of `content`, typeset on the server (see questionPreview.ts). */
  previewHtml: string;
  /** The bank question this row was copied from; null for a test from before the bank. */
  bank: { id: string; domain: string | null; difficulty: number | null } | null;
};

export type EditorTest = {
  id: string;
  title: string;
  description: string | null;
  collectionCategory: string | null;
  durationSeconds: number;
  moduleDurations: number[];
  maxAttempts: number;
  olympiadStartsAt: Date | null;
  olympiadEndsAt: Date | null;
  accessCode: string | null;
  isFree: boolean;
  visible: boolean;
};

function durationToMinutes(seconds: number) {
  return Math.max(1, Math.round(seconds / 60));
}

/**
 * Everything about the test except its questions, saved together. One card
 * with Save in its footer: the button used to sit between the settings and
 * the question list, where it read as saving the questions too.
 */
export function TestSettingsCard({
  test,
  collections,
}: {
  test: EditorTest;
  collections: TestCollectionOption[];
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; error?: string } | null>(null);
  const category = getTestCategory(test);
  // A test with no course (its course was deleted) keeps none until the admin
  // picks one. Falling back to the first course moved it there on any save,
  // a title fix included, and opened it to that course's students.
  const selectedCategory = category && collections.some((collection) => collection.value === category)
    ? category
    : '';
  const sectionRule = collections.find((collection) => collection.value === selectedCategory)?.maxAttempts;
  // Module questions are fixed at upload time, so only their timers are editable.
  const moduleDurations = readModuleDurations(test);
  const fieldId = useId();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setResult(null);

    // `updateTestDetails` calls `refresh()` itself, so the new title and badges
    // in the page header arrive with this response instead of a second round-trip.
    const response = await updateTestDetails(test.id, new FormData(event.currentTarget));
    setResult(response);
    setIsSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className={cardClass}>
      <CardHeader
        title="Settings"
        description="Title, course, time and access. Each question below is saved on its own."
      />

      <CardBody className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
        <Field label="Test title" htmlFor={`${fieldId}-title`}>
          <Input id={`${fieldId}-title`} name="title" required defaultValue={test.title} />
        </Field>

        <Field label="Course" htmlFor={`${fieldId}-section`}>
          {/* Empty keeps the test where it is (updateTestDetails). */}
          <Select id={`${fieldId}-section`} name="testCategory" defaultValue={selectedCategory}>
            {!selectedCategory && <option value="">No course</option>}
            {collections.map((collection) => (
              <option key={collection.value} value={collection.value}>
                {collection.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Attempts per student"
          htmlFor={`${fieldId}-attempts`}
          hint={sectionRule !== undefined ? `The course allows ${sectionRule}.` : undefined}
        >
          <Input
            id={`${fieldId}-attempts`}
            name="maxAttempts"
            type="number"
            min={MIN_TEST_MAX_ATTEMPTS}
            max={MAX_TEST_MAX_ATTEMPTS}
            step={1}
            required
            defaultValue={test.maxAttempts}
            suffix="attempts"
          />
        </Field>

        <Field
          label={moduleDurations.length > 1 ? 'Time per module' : 'Time'}
          htmlFor={`${fieldId}-time`}
        >
          {moduleDurations.length > 1 ? (
            <div className="grid grid-cols-2 gap-2">
              {moduleDurations.map((duration, index) => (
                <label key={`module-${index}-${duration}`} className={affixControlClass}>
                  <span className={affixTextClass}>M{index + 1}</span>
                  <input
                    id={index === 0 ? `${fieldId}-time` : undefined}
                    name="moduleMinutes"
                    type="number"
                    min={1}
                    max={360}
                    step={1}
                    required
                    aria-label={`Module ${index + 1} minutes`}
                    defaultValue={secondsToMinutes(duration)}
                    className={affixInputClass}
                  />
                  <span className={affixTextClass}>min</span>
                </label>
              ))}
            </div>
          ) : (
            <Input
              id={`${fieldId}-time`}
              name="durationMinutes"
              type="number"
              min={1}
              max={360}
              step={1}
              required
              defaultValue={durationToMinutes(test.durationSeconds)}
              suffix="minutes"
            />
          )}
        </Field>

        <OlympiadWindowFields
          initialStartsAt={test.olympiadStartsAt}
          initialEndsAt={test.olympiadEndsAt}
          className="sm:col-span-2"
          hint="Both empty for an ordinary test. Times are Tashkent time; entry closes one test length before the end."
        />

        <AccessCodeField
          initialCode={test.accessCode}
          className="sm:col-span-2"
          hint="Students enter it once before the test opens. Saving a new code asks everyone again."
        />

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 sm:col-span-2">
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input type="hidden" name="isVisible" value="false" />
            <input
              name="isVisible"
              type="checkbox"
              value="true"
              defaultChecked={test.visible}
              className={checkboxClass}
            />
            Show in Practice
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              name="isFree"
              type="checkbox"
              value="true"
              defaultChecked={test.isFree}
              className={checkboxClass}
            />
            Free without a subscription
          </label>
        </div>
      </CardBody>

      {/* The outcome sits left (mr-auto), Save on the right, as on the Sections card. */}
      <CardFooter>
        {result?.success && (
          <p role="status" className="mr-auto inline-flex items-center gap-1.5 text-sm text-green-800">
            <CheckCircle2 className="h-4 w-4" />
            Settings saved.
          </p>
        )}
        {result?.error && (
          <p role="alert" className="mr-auto inline-flex items-center gap-1.5 text-sm text-red-600">
            <AlertCircle className="h-4 w-4" />
            {result.error}
          </p>
        )}
        <Button type="submit" disabled={isSaving || collections.length === 0}>
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save settings
        </Button>
      </CardFooter>
    </form>
  );
}

function readOptions(options: unknown) {
  return Array.isArray(options)
    ? options.filter((option): option is string => typeof option === 'string')
    : [];
}

/**
 * Answer options arrive as a plain string array, so rows need their own ids to
 * survive a removal in the middle of the list.
 */
type OptionDraft = { id: string; text: string };

let optionDraftCounter = 0;

function createOptionDraft(text: string): OptionDraft {
  optionDraftCounter += 1;
  return { id: `option-${optionDraftCounter}`, text };
}

/**
 * Owns the editable answer options. It is remounted through a `key` built from
 * the saved options, so a refresh that actually changed them re-syncs the
 * fields while leaving the surrounding form open. The bank question page
 * edits options with the same control.
 */
export function QuestionOptionsEditor({ initialOptions }: { initialOptions: string[] }) {
  const [options, setOptions] = useState(() => initialOptions.map(createOptionDraft));
  const listRef = useRef<HTMLDivElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);

  const handleOptionChange = (id: string, value: string) => {
    setOptions((current) => current.map((option) => (
      option.id === id ? { ...option, text: value } : option
    )));
  };

  // The pressed X goes away with its row, so focus moves to the X that took
  // its place (or the one above it), and to "Add option" once none is left,
  // instead of falling to the top of the page.
  const handleRemoveOption = (id: string, index: number) => {
    flushSync(() => setOptions((current) => current.filter((option) => option.id !== id)));
    const removeButtons = listRef.current?.querySelectorAll<HTMLButtonElement>('[data-remove-option]');
    const next = removeButtons?.[Math.min(index, removeButtons.length - 1)];
    (next ?? addButtonRef.current)?.focus();
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h4 className={labelClass}>Answer options</h4>
          <p className={hintClass}>
            Leave empty for grid-in questions. Use at least two options for multiple choice.
          </p>
        </div>
        <Button
          ref={addButtonRef}
          variant="secondary"
          size="sm"
          onClick={() => setOptions((current) => [...current, createOptionDraft('')])}
        >
          <Plus className="h-4 w-4" />
          Add option
        </Button>
      </div>

      {options.length > 0 ? (
        <div ref={listRef} className="space-y-2">
          {options.map((option, index) => (
            <div key={option.id} className="flex items-start gap-2">
              <span className="w-5 shrink-0 pt-2.5 text-sm font-medium text-gray-500">
                {String.fromCharCode(65 + index)}
              </span>
              <Textarea
                name="options"
                value={option.text}
                onChange={(event) => handleOptionChange(option.id, event.target.value)}
                rows={2}
                aria-label={`Option ${String.fromCharCode(65 + index)}`}
                className="flex-1"
              />
              {/* Outlined, red only on hover and focus: one bare X per option
                  read as decoration, a red one as an alarm on every row. */}
              <IconButton
                variant="danger-secondary"
                data-remove-option
                onClick={() => handleRemoveOption(option.id, index)}
                aria-label={`Remove option ${String.fromCharCode(65 + index)}`}
                title="Remove option"
              >
                <X className="h-4 w-4" />
              </IconButton>
            </div>
          ))}
        </div>
      ) : (
        <p className={cn(insetClass, 'px-3 py-2.5 text-sm text-gray-500')}>
          No options. This question will be treated as a grid-in answer.
        </p>
      )}
    </div>
  );
}

function QuestionEditor({ question }: { question: EditorQuestion }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; error?: string } | null>(null);
  const fieldId = useId();
  const savedOptions = useMemo(() => readOptions(question.options), [question.options]);
  // Version of the saved data, not a random value: the fields reset only when
  // the options themselves changed.
  const savedOptionsVersion = useMemo(
    () => `${savedOptions.length}:${savedOptions.join('\u0000')}`,
    [savedOptions]
  );
  const isMultiSelect = isMultiSelectKey(question.correctAnswer);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setIsSaving(true);
    setResult(null);
    // On success the action's own `refresh()` re-renders this row, which is what
    // re-keys `QuestionOptionsEditor` when the saved options changed. The
    // outcome is said beside the button, as on the settings card: a save used
    // to report nothing on success and a browser alert on failure.
    const res = await updateQuestion(question.id, new FormData(event.currentTarget));
    setResult(res);
    setIsSaving(false);
  };

  return (
    <li>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        // The focus ring is drawn inside: the row runs edge to edge in its card.
        className="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-gray-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink-600 sm:px-5"
      >
        <span className="w-6 shrink-0 text-right text-xs tabular-nums text-gray-500">
          <span className="sr-only">Question </span>
          {question.order}
        </span>
        {/* Typeset on the server; empty only for a question that is all image. */}
        <span
          className="line-clamp-1 min-w-0 flex-1 text-sm text-gray-700"
          dangerouslySetInnerHTML={{ __html: question.previewHtml || '<span class="text-gray-500">Image only</span>' }}
        />
        {(savedOptions.length === 0 || isMultiSelect || question.bank) && (
          <span className="hidden shrink-0 items-center gap-1 sm:flex">
            {/* A fact, not a control: the link to the bank question is in
                the opened editor, so the row keeps one thing to press. */}
            {/* "Not sorted" waits for the admin, so it is the warning badge
                it is in the bank (bankBadges.tsx), not a neutral fact. */}
            {question.bank && (
              isBankDomain(question.bank.domain) && isBankDifficulty(question.bank.difficulty) ? (
                <Badge title="From the question bank">
                  {formatBankTags(question.bank.domain, question.bank.difficulty)}
                </Badge>
              ) : (
                <Badge
                  tone="warning"
                  title={!isBankDomain(question.bank.domain) ? 'From the question bank; no domain yet' : 'From the question bank; no difficulty yet'}
                >
                  Not sorted
                </Badge>
              )
            )}
            {savedOptions.length === 0 && <Badge>Grid-in</Badge>}
            {isMultiSelect && <Badge>Multi-select</Badge>}
          </span>
        )}
        <span className={buttonClass({ variant: 'secondary', size: 'sm' })}>
          <Edit3 className="h-4 w-4" />
          Edit
          <ChevronDown className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
        </span>
      </button>

      {isOpen && (
        <form onSubmit={handleSubmit} className="space-y-4 border-t border-gray-100 bg-gray-50 p-4 sm:p-5">
          {question.bank && (
            <p className="flex items-start gap-2 text-sm text-gray-600">
              <Library aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
              <span>
                From the question bank ({formatBankTags(question.bank.domain, question.bank.difficulty)}).
                {' '}Saving changes the text, options, answer and image there and in every other test that uses it.
                {' '}<Link href={`/admin/bank/${question.bank.id}`} prefetch={false} className={linkClass}>
                  Open in the bank
                </Link>
              </span>
            </p>
          )}

          <Field label="Question text" htmlFor={`${fieldId}-content`}>
            <Textarea
              id={`${fieldId}-content`}
              name="content"
              required
              defaultValue={question.content}
              rows={6}
            />
          </Field>

          <QuestionOptionsEditor key={savedOptionsVersion} initialOptions={savedOptions} />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field
              label="Correct answer"
              htmlFor={`${fieldId}-answer`}
              hint={
                <>
                  One option letter, a value for a grid-in, or several letters such as
                  {' '}<code className="font-medium text-gray-700">B, C</code> to make the question multi-select.
                </>
              }
            >
              <Input id={`${fieldId}-answer`} name="correctAnswer" required defaultValue={question.correctAnswer} />
            </Field>

            <Field label="Explanation" htmlFor={`${fieldId}-explanation`}>
              <Input id={`${fieldId}-explanation`} name="explanation" defaultValue={question.explanation ?? ''} />
            </Field>

            <Field label="Image URL" htmlFor={`${fieldId}-image`}>
              <Input
                id={`${fieldId}-image`}
                name="imageUrl"
                defaultValue={question.imageUrl ?? ''}
                placeholder="https://..."
              />
            </Field>

            <Field label="Video URL" htmlFor={`${fieldId}-video`}>
              <Input
                id={`${fieldId}-video`}
                name="videoUrl"
                defaultValue={question.videoUrl ?? ''}
                placeholder="https://..."
              />
            </Field>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            {result?.success && (
              <p role="status" className="mr-auto inline-flex items-center gap-1.5 text-sm text-green-800">
                <CheckCircle2 className="h-4 w-4" />
                Question saved.
              </p>
            )}
            {result && !result.success && (
              <p role="alert" className="mr-auto inline-flex items-center gap-1.5 text-sm text-red-600">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {result.error || 'The question was not saved.'}
              </p>
            )}
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save question
            </Button>
          </div>
        </form>
      )}
    </li>
  );
}

/** One card of question rows; each opens its own editor and saves on its own. */
export function QuestionList({ questions }: { questions: EditorQuestion[] }) {
  return (
    <List>
      {questions.map((question) => (
        <QuestionEditor key={question.id} question={question} />
      ))}
    </List>
  );
}
