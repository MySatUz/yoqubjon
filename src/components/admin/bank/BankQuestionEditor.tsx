'use client';

import React, { useId, useMemo, useState } from 'react';
import { unstable_rethrow } from 'next/navigation';
import { AlertCircle, CheckCircle2, Loader2, Save, Trash2 } from 'lucide-react';
import { deleteBankQuestion, updateBankQuestion } from '@/app/admin/bank/actions';
import { QuestionOptionsEditor } from '@/components/admin/TestEditor';
import { DifficultySegments } from '@/components/admin/bank/TagControls';
import { Button } from '@/components/ui/Button';
import { CardBody, CardFooter, CardHeader, cardClass } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { Field, Input, Textarea, labelClass } from '@/components/ui/Field';
import { ChipCheck, chipClass, chipGroupClass } from '@/components/ui/Misc';
import { BANK_DOMAINS, type BankDifficulty, type BankDomain } from '@/lib/questionBank';

export type EditableBankQuestion = {
  id: string;
  content: string;
  options: string[];
  correctAnswer: string;
  imageUrl: string | null;
  domain: BankDomain | null;
  difficulty: BankDifficulty | null;
};

function testCount(count: number) {
  return `${count} ${count === 1 ? 'test' : 'tests'}`;
}

/**
 * Edits a bank question: its tags, then its text, options, answer and image,
 * in LaTeX as the test editor takes them. Saving writes the shared fields
 * through to every test that shows the question (`updateBankQuestion`).
 */
export function BankQuestionEditor({
  question,
  usedIn,
}: {
  question: EditableBankQuestion;
  /** Tests showing it, copies included. */
  usedIn: number;
}) {
  const [domain, setDomain] = useState<BankDomain | null>(question.domain);
  const [difficulty, setDifficulty] = useState<BankDifficulty | null>(question.difficulty);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ success: boolean; error?: string } | null>(null);
  const fieldId = useId();
  // Version of the saved data: the option fields reset only when the saved
  // options themselves changed (see QuestionOptionsEditor).
  const optionsVersion = useMemo(
    () => `${question.options.length}:${question.options.join('\u0000')}`,
    [question.options],
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setResult(null);
    // The action's own refresh() re-renders the question above with the
    // saved text, so the preview and the form agree.
    const response = await updateBankQuestion(question.id, new FormData(event.currentTarget));
    setResult(response);
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className={cardClass}>
      <CardHeader
        title="Edit"
        description={usedIn > 0
          ? `Saving also changes the question in the ${testCount(usedIn)} that use it.`
          : 'No test uses this question yet.'}
      />

      <CardBody className="space-y-5">
        <input type="hidden" name="domain" value={domain ?? ''} />
        <input type="hidden" name="difficulty" value={difficulty ?? ''} />

        <div className="space-y-1.5">
          <p id={`${fieldId}-domain`} className={labelClass}>Domain</p>
          {/* Chips, not a segmented control: four long College Board names
              have to wrap on a phone, and a segmented control must not. */}
          <div role="radiogroup" aria-labelledby={`${fieldId}-domain`} className={chipGroupClass}>
            {BANK_DOMAINS.map((option) => {
              const active = domain === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setDomain(option.value)}
                  className={chipClass(active)}
                >
                  <ChipCheck active={active} />
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <p className={labelClass}>Difficulty</p>
          <DifficultySegments value={difficulty} onChange={setDifficulty} aria-label="Difficulty" />
        </div>

        <Field label="Question text" htmlFor={`${fieldId}-content`} hint="LaTeX, as in a .tex file: $x^2$ or \(x^2\) for maths.">
          <Textarea id={`${fieldId}-content`} name="content" required defaultValue={question.content} rows={6} />
        </Field>

        <QuestionOptionsEditor key={optionsVersion} initialOptions={question.options} />

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

          <Field label="Image URL" htmlFor={`${fieldId}-image`}>
            <Input
              id={`${fieldId}-image`}
              name="imageUrl"
              defaultValue={question.imageUrl ?? ''}
              placeholder="https://..."
            />
          </Field>
        </div>
      </CardBody>

      <CardFooter>
        {result?.success && (
          <p role="status" className="mr-auto inline-flex items-center gap-1.5 text-sm text-green-800">
            <CheckCircle2 className="h-4 w-4" />
            {usedIn > 0 ? `Saved here and in ${testCount(usedIn)}.` : 'Question saved.'}
          </p>
        )}
        {result && !result.success && (
          <p role="alert" className="mr-auto inline-flex items-center gap-1.5 text-sm text-red-600">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {result.error || 'The question was not saved.'}
          </p>
        )}
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save question
        </Button>
      </CardFooter>
    </form>
  );
}

/**
 * "Delete from bank" with its question. Tests keep their copies, so the
 * dialog says so: a teacher must not fear losing a test they gave.
 */
export function DeleteBankQuestionButton({ questionId, usedIn }: { questionId: string; usedIn: number }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    let response: Awaited<ReturnType<typeof deleteBankQuestion>>;
    try {
      // On success the action redirects to the bank, so only a failure returns.
      response = await deleteBankQuestion(questionId);
    } catch (error) {
      // That redirect rejects this call: the question is gone and the router
      // is opening the bank, so the dialog stays busy until it does.
      unstable_rethrow(error);
      // Deleting again is safe: a question already gone just opens the bank.
      response = { success: false, error: 'The question was not deleted. Check your connection and try again.' };
    }
    setBusy(false);
    if (response && !response.success) {
      setOpen(false);
      setError(response.error);
    }
  };

  return (
    <>
      <Button variant="danger-secondary" onClick={() => setOpen(true)}>
        <Trash2 className="h-4 w-4" />
        Delete from bank
      </Button>
      {error && (
        <p role="alert" className="basis-full text-sm text-red-600">{error}</p>
      )}
      <ConfirmDialog
        open={open}
        busy={busy}
        tone="danger"
        title="Delete this question from the bank?"
        description={
          usedIn > 0
            ? <p>The {testCount(usedIn)} that use it keep their copy: nothing changes for students or their results. It can no longer be picked for a new test.</p>
            : <p>No test uses it. It can no longer be picked for a new test.</p>
        }
        confirmLabel="Delete question"
        onConfirm={confirm}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
