'use client';

import React, { useId, useState, useTransition } from 'react';
import { unstable_rethrow } from 'next/navigation';
import { Loader2, Plus } from 'lucide-react';
import { createCourse } from '@/app/admin/courses/actions';
import { DEFAULT_TEST_MAX_ATTEMPTS, MAX_TEST_MAX_ATTEMPTS, MIN_TEST_MAX_ATTEMPTS } from '@/lib/testAttempts';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Alert } from '@/components/ui/Feedback';
import { Field, Input, Textarea } from '@/components/ui/Field';

const MAX_NAME_LENGTH = 80;
const MAX_DESCRIPTION_LENGTH = 180;
const LINK_NAME_PATTERN = /^[A-Za-z0-9_-]{3,40}$/;

/** A link name from the course name: its Latin letters and digits, joined by dashes. */
function suggestLinkName(name: string) {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 40)
    .replace(/-+$/, '');
}

/** The id the server will store: dashes as underscores, upper case, `_2` when taken. */
function predictCourseId(linkName: string, takenIds: Set<string>) {
  const base = linkName.replace(/-/g, '_').toUpperCase();
  let id = base;
  for (let suffix = 2; takenIds.has(id); suffix += 1) id = `${base}_${suffix}`;
  return id;
}

/**
 * [New course] and its dialog: a name, a permanent link name, a description
 * and the default attempt limit. On success the action opens the new course.
 */
export function NewCourseButton({ takenIds }: { takenIds: string[] }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        <Plus className="h-4 w-4" />
        New course
      </Button>
      {isOpen && <NewCourseDialog takenIds={takenIds} onClose={() => setIsOpen(false)} />}
    </>
  );
}

function NewCourseDialog({ takenIds, onClose }: { takenIds: string[]; onClose: () => void }) {
  const fieldId = useId();
  const [name, setName] = useState('');
  const [linkName, setLinkName] = useState('');
  const [isLinkEdited, setIsLinkEdited] = useState(false);
  const [description, setDescription] = useState('');
  const [maxAttempts, setMaxAttempts] = useState(String(DEFAULT_TEST_MAX_ATTEMPTS));
  const [showErrors, setShowErrors] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isCreating, startCreating] = useTransition();

  const link = isLinkEdited ? linkName.trim() : suggestLinkName(name);
  const attempts = Number(maxAttempts);
  const errors = {
    name: !name.trim() ? 'Enter a name.' : name.trim().length > MAX_NAME_LENGTH ? `Use at most ${MAX_NAME_LENGTH} characters.` : null,
    link: LINK_NAME_PATTERN.test(link) ? null : 'Use 3–40 Latin letters, digits and dashes.',
    description: description.trim().length > MAX_DESCRIPTION_LENGTH ? `Use at most ${MAX_DESCRIPTION_LENGTH} characters.` : null,
    attempts: Number.isInteger(attempts) && attempts >= MIN_TEST_MAX_ATTEMPTS && attempts <= MAX_TEST_MAX_ATTEMPTS
      ? null
      : 'Enter an attempt limit from 1 to 10,000.',
  };
  const hasErrors = Object.values(errors).some(Boolean);
  const taken = new Set(takenIds);
  const predictedId = errors.link ? null : predictCourseId(link, taken);
  const baseId = errors.link ? null : link.replace(/-/g, '_').toUpperCase();

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setShowErrors(true);
    setServerError(null);
    if (hasErrors) return;

    const formData = new FormData();
    formData.set('name', name.trim());
    formData.set('linkName', link);
    formData.set('description', description.trim());
    formData.set('maxAttempts', String(attempts));

    startCreating(async () => {
      try {
        // On success the action redirects to the new course; only a failure answers here.
        const result = await createCourse(formData);
        if (result && !result.success) setServerError(result.error);
      } catch (error) {
        // The redirect arrives as a rejection and must go on to open the course.
        unstable_rethrow(error);
        setServerError('No answer from the server. The course may have been created: check Courses before trying again.');
      }
    });
  };

  const formId = `${fieldId}-form`;

  return (
    <Dialog
      open
      title="New course"
      busy={isCreating}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isCreating}>Cancel</Button>
          <Button type="submit" form={formId} disabled={isCreating}>
            {isCreating && <Loader2 className="h-4 w-4 animate-spin" />}
            {isCreating ? 'Creating course…' : 'Create course'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="space-y-4">
        {serverError && <Alert tone="danger" title="The course was not created.">{serverError}</Alert>}

        <Field label="Name" htmlFor={`${fieldId}-name`} error={showErrors ? errors.name : undefined}>
          <Input
            id={`${fieldId}-name`}
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={MAX_NAME_LENGTH + 20}
            placeholder="SAT Math — Weekend intensive, Chilonzor"
            disabled={isCreating}
            data-autofocus
          />
        </Field>

        <Field
          label="Link name"
          htmlFor={`${fieldId}-link`}
          error={showErrors || isLinkEdited ? errors.link : undefined}
          hint={
            <span aria-live="polite">
              {predictedId
                ? <>
                    Students&apos; link ends in <span className="font-medium tabular-nums text-mist-700">?set={predictedId.toLowerCase()}</span>
                    {predictedId !== baseId && ` (${baseId?.toLowerCase()} is taken)`} · cannot be changed later
                  </>
                : 'Latin letters, digits and dashes. It cannot be changed later.'}
            </span>
          }
        >
          <Input
            id={`${fieldId}-link`}
            value={link}
            onChange={(event) => {
              setIsLinkEdited(true);
              setLinkName(event.target.value);
            }}
            placeholder="sat-weekend-chilonzor"
            spellCheck={false}
            autoCapitalize="off"
            disabled={isCreating}
          />
        </Field>

        <Field
          label="Description (optional)"
          htmlFor={`${fieldId}-description`}
          error={showErrors ? errors.description : undefined}
          hint={`${description.trim().length} / ${MAX_DESCRIPTION_LENGTH}`}
        >
          <Textarea
            id={`${fieldId}-description`}
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            disabled={isCreating}
          />
        </Field>

        <Field
          label="Default attempt limit"
          htmlFor={`${fieldId}-attempts`}
          error={showErrors ? errors.attempts : undefined}
          hint="Each new test in this course starts with this limit."
        >
          <Input
            id={`${fieldId}-attempts`}
            type="number"
            inputMode="numeric"
            min={MIN_TEST_MAX_ATTEMPTS}
            max={MAX_TEST_MAX_ATTEMPTS}
            value={maxAttempts}
            onChange={(event) => setMaxAttempts(event.target.value)}
            suffix="attempts"
            disabled={isCreating}
            className="max-w-48"
          />
        </Field>

        <p className="text-sm text-mist-600">
          The course is created visible. Add students with Give access once it exists.
        </p>
      </form>
    </Dialog>
  );
}
