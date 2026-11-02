'use client';

import React, { useId, useState, useTransition } from 'react';
import { CheckCircle2, Flag, Loader2 } from 'lucide-react';
import { reportResultQuestion } from '@/app/dashboard/results/actions';
import { MAX_REPORT_LENGTH } from '@/lib/questionReports';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Alert } from '@/components/ui/Feedback';
import { Field, Textarea } from '@/components/ui/Field';

/**
 * [Report a problem] under a reviewed question, and its dialog. The student
 * says what is wrong - the key, the picture, the words - and the report is
 * kept in the platform for the admins, already naming the test and the
 * question. Once sent, "Report sent" stays beside the button while the page
 * is open; a second send replaces the words of the first.
 */
export function ReportProblemButton({
  resultId,
  questionId,
  place,
  sent,
  onSent,
}: {
  resultId: string;
  questionId: string;
  /** "Module 2, question 14 of SAT Practice 5", for the dialog to say which. */
  place: string;
  sent: boolean;
  onSent: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <Button variant="secondary" size="sm" onClick={() => setIsOpen(true)}>
        <Flag className="h-4 w-4" />
        Report a problem
      </Button>
      {sent && (
        <span role="status" className="inline-flex items-center gap-1 text-xs text-green-800">
          <CheckCircle2 aria-hidden className="h-4 w-4" />
          Report sent
        </span>
      )}
      {isOpen && (
        <ReportProblemDialog
          resultId={resultId}
          questionId={questionId}
          place={place}
          onClose={() => setIsOpen(false)}
          onSent={() => {
            setIsOpen(false);
            onSent();
          }}
        />
      )}
    </div>
  );
}

function ReportProblemDialog({
  resultId,
  questionId,
  place,
  onClose,
  onSent,
}: {
  resultId: string;
  questionId: string;
  place: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const fieldId = useId();
  const [message, setMessage] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSending, startSending] = useTransition();

  const text = message.trim();
  const error = !text
    ? 'Write what is wrong with the question.'
    : text.length > MAX_REPORT_LENGTH ? `Use at most ${MAX_REPORT_LENGTH} characters.` : null;

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setShowErrors(true);
    setServerError(null);
    if (error) return;

    startSending(async () => {
      try {
        const result = await reportResultQuestion(resultId, questionId, text);
        if (result.ok) onSent();
        else setServerError(result.error);
      } catch {
        setServerError('No answer from the server. Check your connection and send it again.');
      }
    });
  };

  const formId = `${fieldId}-form`;

  return (
    <Dialog
      open
      title="Report a problem"
      description={`${place}. An admin reads every report and corrects the question if it is wrong.`}
      busy={isSending}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSending}>Cancel</Button>
          <Button type="submit" form={formId} disabled={isSending}>
            {isSending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSending ? 'Sending report…' : 'Send report'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="space-y-4">
        {serverError && <Alert tone="danger" title="The report was not sent.">{serverError}</Alert>}

        <Field
          label="What is wrong?"
          htmlFor={`${fieldId}-message`}
          error={showErrors ? error : undefined}
          hint={`${text.length} / ${MAX_REPORT_LENGTH}`}
        >
          <Textarea
            id={`${fieldId}-message`}
            rows={4}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            maxLength={MAX_REPORT_LENGTH + 100}
            placeholder="For example: the answer should be C, not B. Or: the picture does not load."
            disabled={isSending}
            data-autofocus
          />
        </Field>
      </form>
    </Dialog>
  );
}
