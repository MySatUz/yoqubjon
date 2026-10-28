'use client';

import React, { useId, useState, useTransition } from 'react';
import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import { Loader2, Trash2 } from 'lucide-react';
import { deleteCourse, saveCourseSettings } from '@/app/admin/courses/actions';
import { courseHref } from '@/components/admin/courses/courseLinks';
import { MAX_TEST_MAX_ATTEMPTS, MIN_TEST_MAX_ATTEMPTS } from '@/lib/testAttempts';
import { getCategoryQueryValue } from '@/lib/testCatalog';
import { Button, buttonClass } from '@/components/ui/Button';
import { Card, CardBody, CardFooter } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Alert } from '@/components/ui/Feedback';
import { Field, Input, Textarea, hintClass, labelClass } from '@/components/ui/Field';
import { segmentClass, segmentedClass } from '@/components/ui/Misc';
import { cn } from '@/components/ui/cn';

const MAX_NAME_LENGTH = 80;
const MAX_DESCRIPTION_LENGTH = 180;

type CourseSettings = {
  value: string;
  label: string;
  description: string;
  visible: boolean;
  maxAttempts: number;
  /** False for a built-in course shown while no course is stored. */
  hasRow: boolean;
};

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

/** Server messages in the admin's words; anything else after "Not saved:". */
function describeSaveError(message: string | undefined) {
  if (!message || /no sections to update|update failed/i.test(message)) return 'Changes were not saved. Try again.';
  if (/section name is required/i.test(message)) return 'Enter a name.';
  if (/at most 80/.test(message)) return 'Use at most 80 characters in the name.';
  if (/at most 180/.test(message)) return 'Use at most 180 characters in the description.';
  if (message === 'Forbidden') return 'Not saved: your admin access was removed.';
  return `Not saved: ${message}`;
}

function DeleteCourseDialog({
  course,
  accessEntries,
  onClose,
}: {
  course: CourseSettings;
  accessEntries: number;
  onClose: () => void;
}) {
  const fieldId = useId();
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, startDeleting] = useTransition();
  const needsTyping = accessEntries > 0;
  const canDelete = !needsTyping || typed.trim().toUpperCase() === course.value;

  const remove = () => {
    setError(null);
    startDeleting(async () => {
      try {
        // On success the action goes to Courses; only a failure answers here.
        const result = await deleteCourse(course.value);
        if (result && !result.success) setError(result.error);
      } catch (error) {
        // That redirect arrives as a rejection: passed on, it is the navigation
        // to Courses, not "not deleted", and the button stays busy until then.
        unstable_rethrow(error);
        setError('No answer from the server. The course may be deleted: open Courses to check before trying again.');
      }
    });
  };

  return (
    <Dialog
      open
      title={`Delete ${course.label}?`}
      busy={isDeleting}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isDeleting}>Cancel</Button>
          <Button variant="danger" onClick={remove} disabled={!canDelete || isDeleting} aria-describedby={needsTyping ? `${fieldId}-hint` : undefined}>
            {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isDeleting
              ? 'Deleting…'
              : needsTyping ? `Delete course and ${plural(accessEntries, 'access entry', 'access entries')}` : 'Delete course'}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm text-gray-700">
        {error && <Alert tone="danger">{error}</Alert>}
        <p>
          {needsTyping
            ? `${plural(accessEntries, 'access entry', 'access entries')} will be deleted: those students lose access at once. Results stay. This cannot be undone.`
            : 'Results stay. This cannot be undone.'}
        </p>
        {needsTyping && (
          <Field
            label={<>Type <span className="font-semibold tabular-nums">{course.value}</span> to confirm</>}
            htmlFor={`${fieldId}-confirm`}
          >
            <Input
              id={`${fieldId}-confirm`}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              disabled={isDeleting}
              data-autofocus
            />
          </Field>
        )}
        {needsTyping && !canDelete && <p id={`${fieldId}-hint`} className={hintClass}>Type the course id to delete it.</p>}
      </div>
    </Dialog>
  );
}

/**
 * A course's name, description, visibility and default attempt limit, then
 * deleting it. Saving goes through `updateSectionSettings` with all four
 * fields: a missing `visible_<id>` would hide the course.
 */
export default function CourseSettingsForm({
  course,
  testCount,
  accessEntries,
  olympiads,
  isLastCourse,
}: {
  course: CourseSettings;
  testCount: number;
  accessEntries: number;
  olympiads: Array<{ id: string; title: string; maxAttempts: number }>;
  isLastCourse: boolean;
}) {
  const fieldId = useId();
  const [name, setName] = useState(course.label);
  const [description, setDescription] = useState(course.description);
  const [visible, setVisible] = useState(course.visible);
  const [maxAttempts, setMaxAttempts] = useState(String(course.maxAttempts));
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isSaving, startSaving] = useTransition();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const attempts = Number(maxAttempts);
  const errors = {
    name: !name.trim() ? 'Enter a name.' : name.trim().length > MAX_NAME_LENGTH ? `Use at most ${MAX_NAME_LENGTH} characters.` : null,
    description: description.trim().length > MAX_DESCRIPTION_LENGTH ? `Use at most ${MAX_DESCRIPTION_LENGTH} characters.` : null,
    attempts: Number.isInteger(attempts) && attempts >= MIN_TEST_MAX_ATTEMPTS && attempts <= MAX_TEST_MAX_ATTEMPTS
      ? null
      : 'Enter an attempt limit from 1 to 10,000.',
  };
  const hasErrors = Object.values(errors).some(Boolean);
  // Compared with what is stored, which arrives again after a save: a saved form is not dirty.
  const isDirty = name.trim() !== course.label
    || description.trim() !== course.description
    || visible !== course.visible
    || attempts !== course.maxAttempts;
  const limitChanges = !errors.attempts && attempts !== course.maxAttempts;
  const changedOlympiads = limitChanges ? olympiads.filter((test) => test.maxAttempts !== attempts) : [];

  const discard = () => {
    setName(course.label);
    setDescription(course.description);
    setVisible(course.visible);
    setMaxAttempts(String(course.maxAttempts));
    setResult(null);
  };

  const save = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (hasErrors || !isDirty) return;

    const id = course.value;
    const formData = new FormData();
    formData.set('category', id);
    formData.set(`visible_${id}`, visible ? 'true' : 'false');
    formData.set(`attempts_${id}`, String(attempts));
    formData.set(`label_${id}`, name.trim());
    formData.set(`description_${id}`, description.trim());

    setResult(null);
    startSaving(async () => {
      try {
        const response = await saveCourseSettings(formData);
        setResult(response.success
          ? { success: true, message: 'Course settings saved.' }
          : { success: false, message: describeSaveError(response.error) });
      } catch {
        setResult({ success: false, message: 'No connection. Not saved.' });
      }
    });
  };

  const deleteBlocked = testCount > 0
    ? `This course still holds ${plural(testCount, 'test', 'tests')}. Move each one to another course on its page, or delete it. Then delete the course.`
    : isLastCourse
      ? 'This is the only course. Keep at least one course.'
      : null;

  return (
    <div className="max-w-2xl space-y-6">
      <form onSubmit={save} noValidate>
        <Card>
          <CardBody className="space-y-5">
            <Field label="Name" htmlFor={`${fieldId}-name`} error={errors.name}>
              <Input
                id={`${fieldId}-name`}
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={MAX_NAME_LENGTH + 20}
                disabled={isSaving}
              />
            </Field>

            <Field
              label="Description"
              htmlFor={`${fieldId}-description`}
              error={errors.description}
              hint={`${description.trim().length} / ${MAX_DESCRIPTION_LENGTH}`}
            >
              <Textarea
                id={`${fieldId}-description`}
                rows={3}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                disabled={isSaving}
              />
            </Field>

            <fieldset className="space-y-1.5" aria-describedby={`${fieldId}-visible-hint`}>
              <legend className={labelClass}>Visible</legend>
              <div className={segmentedClass}>
                {[true, false].map((option) => (
                  <button
                    key={String(option)}
                    type="button"
                    aria-pressed={visible === option}
                    onClick={() => setVisible(option)}
                    disabled={isSaving}
                    className={segmentClass(visible === option)}
                  >
                    {option ? 'Visible' : 'Hidden'}
                  </button>
                ))}
              </div>
              <p id={`${fieldId}-visible-hint`} className={hintClass}>
                Hidden from course lists only. It does not lock the tests: a student who has the link and may open a
                test (free, Premium or course access) still can.
              </p>
            </fieldset>

            <Field
              label="Default attempt limit"
              htmlFor={`${fieldId}-attempts`}
              error={errors.attempts}
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
                disabled={isSaving}
                className="max-w-48"
              />
            </Field>

            {/* updateSectionSettings rewrites every test's limit when the course's changes. */}
            {limitChanges && testCount > 0 && (
              <Alert tone="warning">
                Saving sets the attempt limit of all {plural(testCount, 'test', 'tests')} in this course to {attempts}, olympiads included.
                {changedOlympiads.map((test) => (
                  <span key={test.id} className="block">
                    {test.title} will change from {test.maxAttempts} to {attempts}.
                  </span>
                ))}
              </Alert>
            )}

            <div className="space-y-1.5">
              <p className={labelClass}>Link</p>
              <p className="text-sm text-gray-700">
                <span className="font-medium tabular-nums text-gray-900">?set={getCategoryQueryValue(course.value)}</span>
                {' '}· course id {course.value} · cannot be changed
              </p>
            </div>

            {result && <Alert tone={result.success ? 'success' : 'danger'}>{result.message}</Alert>}
          </CardBody>
          <CardFooter>
            {!isDirty && !isSaving && <span className={cn(hintClass, 'mr-auto')}>No changes yet</span>}
            <Button variant="secondary" onClick={discard} disabled={!isDirty || isSaving}>Discard changes</Button>
            <Button type="submit" disabled={!isDirty || hasErrors || isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </CardFooter>
        </Card>
      </form>

      {course.hasRow && (
        <Card as="section" aria-labelledby={`${fieldId}-delete`}>
          <CardBody className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 max-w-md">
              <h2 id={`${fieldId}-delete`} className="text-base font-semibold text-gray-900">Delete this course</h2>
              <p className="mt-0.5 text-sm text-gray-500">
                {deleteBlocked ?? 'Its access entries are deleted with it. Results stay.'}
              </p>
            </div>
            {deleteBlocked ? (
              testCount > 0 && (
                <Link href={courseHref(course.value)} className={buttonClass({ variant: 'secondary', size: 'sm' })}>
                  Open tests
                </Link>
              )
            ) : (
              <Button variant="danger-secondary" size="sm" onClick={() => setIsDeleteOpen(true)}>
                <Trash2 className="h-4 w-4" />
                Delete course
              </Button>
            )}
          </CardBody>
        </Card>
      )}

      {isDeleteOpen && (
        <DeleteCourseDialog course={course} accessEntries={accessEntries} onClose={() => setIsDeleteOpen(false)} />
      )}
    </div>
  );
}
