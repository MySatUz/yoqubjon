'use client';

import React, { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Loader2, Mail, Search, UserPlus } from 'lucide-react';
import {
  findStudentsForAccess,
  giveCourseAccess,
  previewCourseAccess,
  type AccessPreviewRow,
  type AccessStudentMatch,
  type GiveAccessRowResult,
} from '@/app/admin/section-access-actions';
import {
  ACCESS_CHANGE_LABELS,
  ACCESS_MONTH_CHOICES,
  ACCOUNT_STATE_LABELS,
  MAX_ACCESS_EMAILS,
  MAX_ACCESS_NOTE_LENGTH,
  accessStateToken,
  describeAccessError,
  formatDateKey,
  parseEmailList,
  planAccess,
  type AccessAccountState,
  type AccessMonths,
} from '@/components/admin/courses/accessPlan';
import { Badge } from '@/components/ui/Badge';
import { Button, type ButtonSize, type ButtonVariant } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Alert, EmptyState, Skeleton } from '@/components/ui/Feedback';
import { Field, Input, Select, Textarea, checkboxClass, hintClass, inputClass, labelClass } from '@/components/ui/Field';
import { tableClass, tdClass, thClass } from '@/components/ui/List';
import { segmentClass, segmentedClass } from '@/components/ui/Misc';
import { cn } from '@/components/ui/cn';

export type AccessCourse = { value: string; label: string; visible: boolean };

/** What the dialog opens with: a course, emails (client state only, never a URL) and a length. */
export type GiveAccessPreset = {
  courseId?: string;
  emails?: string[];
  months?: AccessMonths;
};

type OpenGiveAccess = (courses: AccessCourse[], preset: GiveAccessPreset) => void;

const GiveAccessContext = createContext<OpenGiveAccess | null>(null);

/**
 * Where the dialog lives while it is open: around a page's content, not
 * beside the button that opened it. Saving refreshes the page, and some
 * buttons go away with what they stood for - the empty state's once someone
 * has access, a "Needs attention" row once its access is extended - which
 * took the open dialog, its results and its Retry with them. Each opening
 * mounts a new dialog, so it starts from its preset.
 */
export function GiveAccessHost({ children }: { children: React.ReactNode }) {
  const [opening, setOpening] = useState<{ id: number; courses: AccessCourse[]; preset: GiveAccessPreset } | null>(null);
  const openCount = useRef(0);

  const open = useCallback<OpenGiveAccess>((courses, preset) => {
    openCount.current += 1;
    setOpening({ id: openCount.current, courses, preset });
  }, []);

  return (
    <GiveAccessContext value={open}>
      {children}
      {opening && (
        <GiveAccessDialog
          key={opening.id}
          courses={opening.courses}
          preset={opening.preset}
          onClose={() => setOpening(null)}
        />
      )}
    </GiveAccessContext>
  );
}

/**
 * The one way in to giving access: a button that opens the dialog with a
 * preset. Used from the Courses page, a course's header, its Students and
 * Results tabs and selection bar, and the "Access ends" rows. Inside a
 * `GiveAccessHost` the host holds the dialog; elsewhere it mounts here, on
 * open, so every opening starts from its preset.
 */
export function GiveAccessButton({
  courses,
  preset,
  variant = 'primary',
  size = 'md',
  label = 'Give access',
  icon = <UserPlus className="h-4 w-4" />,
  ariaLabel,
  className,
}: {
  courses: AccessCourse[];
  preset?: GiveAccessPreset;
  variant?: ButtonVariant;
  size?: ButtonSize;
  label?: string;
  icon?: React.ReactNode;
  ariaLabel?: string;
  className?: string;
}) {
  const openInHost = useContext(GiveAccessContext);
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => (openInHost ? openInHost(courses, preset ?? {}) : setIsOpen(true))}
        disabled={courses.length === 0}
        aria-label={ariaLabel}
        className={className}
      >
        {icon}
        {label}
      </Button>
      {!openInHost && isOpen && <GiveAccessDialog courses={courses} preset={preset ?? {}} onClose={() => setIsOpen(false)} />}
    </>
  );
}

type PreviewState =
  | { key: string; status: 'loading' }
  | { key: string; status: 'ready'; todayKey: string; rows: Map<string, AccessPreviewRow> }
  | { key: string; status: 'error'; error: string };

type RunState = {
  status: 'idle' | 'running' | 'done';
  todayKey?: string;
  results: Map<string, GiveAccessRowResult>;
  error?: string;
  /**
   * A send got no answer: some rows may be saved. The list, course and length
   * stay as they were sent, so sending again repeats that run, which the
   * server does not apply twice.
   */
  uncertain?: boolean;
};

const PREVIEW_DELAY_MS = 400;
const SEARCH_DELAY_MS = 300;

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

/** Plain text for the norm (a confirmed account); a badge for what still waits. */
function AccountCell({ name, account }: { name: string | null; account: AccessAccountState }) {
  return (
    <div className="min-w-0">
      {name && <p className="truncate text-sm text-gray-900">{name}</p>}
      {account === 'confirmed' ? (
        <p className="text-xs text-gray-500">{ACCOUNT_STATE_LABELS.confirmed}</p>
      ) : (
        <Badge tone={account === 'waiting' ? 'warning' : 'neutral'}>{ACCOUNT_STATE_LABELS[account]}</Badge>
      )}
    </div>
  );
}

function describeCurrent(current: AccessPreviewRow['current'], todayKey: string) {
  if (!current) return '—';
  if (current.endKey === null) return 'No end date';
  if (current.endKey < todayKey) return `Ended ${formatDateKey(current.endKey, todayKey)}`;
  return `Until ${formatDateKey(current.endKey, todayKey)}`;
}

/**
 * "Find students by name or email": accounts that match, each with a box to
 * tick, and one button that adds the ticked ones to the list. The query goes
 * to a server action, never into the URL.
 */
function StudentSearch({
  listed,
  disabled,
  onAdd,
}: {
  listed: Set<string>;
  disabled: boolean;
  onAdd: (emails: string[]) => void;
}) {
  const fieldId = useId();
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<{ term: string; status: 'loading' | 'ready' | 'error'; users: AccessStudentMatch[] }>({
    term: '',
    status: 'ready',
    users: [],
  });
  const [ticked, setTicked] = useState<Set<string>>(() => new Set());
  const term = query.trim();
  const isSearching = term.length >= 2;

  useEffect(() => {
    if (term.length < 2) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      setFound({ term, status: 'loading', users: [] });
      try {
        const response = await findStudentsForAccess(term);
        if (cancelled) return;
        setFound(response.success
          ? { term, status: 'ready', users: response.users }
          : { term, status: 'error', users: [] });
      } catch {
        if (!cancelled) setFound({ term, status: 'error', users: [] });
      }
    }, SEARCH_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term]);

  // An answer for an older query is not shown under a newer one.
  const current = isSearching && found.term === term ? found : null;
  const tickable = (current?.users ?? []).filter((user) => !listed.has(user.email));
  const tickedHere = tickable.filter((user) => ticked.has(user.email));

  const toggle = (email: string) => setTicked((previous) => {
    const next = new Set(previous);
    if (next.has(email)) next.delete(email);
    else next.add(email);
    return next;
  });

  const add = () => {
    onAdd(tickedHere.map((user) => user.email));
    setTicked(new Set());
  };

  return (
    <div className="space-y-2">
      <label htmlFor={fieldId} className={labelClass}>Find students by name or email</label>
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        {/* Room for the glass, as on the Users search. */}
        <input
          id={fieldId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="At least 2 letters"
          autoComplete="off"
          disabled={disabled}
          className={inputClass({ className: 'pl-9' })}
        />
      </div>

      {isSearching && (
        <div className="rounded-xl border border-gray-200" aria-live="polite">
          {!current || current.status === 'loading' ? (
            <p className="flex items-center gap-2 px-3 py-2.5 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching…
            </p>
          ) : current.status === 'error' ? (
            <p className="px-3 py-2.5 text-sm text-red-600">Could not search accounts. Try again.</p>
          ) : current.users.length === 0 ? (
            <p className="px-3 py-2.5 text-sm text-gray-500">No account matches &ldquo;{term}&rdquo;.</p>
          ) : (
            <>
              <ul className="max-h-48 divide-y divide-gray-100 overflow-y-auto">
                {current.users.map((user) => {
                  const isListed = listed.has(user.email);
                  return (
                    <li key={user.id}>
                      <label className={cn('flex items-center gap-3 px-3 py-2', isListed ? 'text-gray-500' : 'cursor-pointer hover:bg-gray-50')}>
                        <input
                          type="checkbox"
                          className={checkboxClass}
                          checked={isListed || ticked.has(user.email)}
                          disabled={isListed || disabled}
                          onChange={() => toggle(user.email)}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-gray-900">{user.name || user.email}</span>
                          {user.name && <span className="block truncate text-xs text-gray-500">{user.email}</span>}
                        </span>
                        {isListed
                          ? <span className="shrink-0 text-xs text-gray-500">In the list</span>
                          : user.account === 'waiting' && <Badge tone="warning">Waiting for email confirmation</Badge>}
                      </label>
                    </li>
                  );
                })}
              </ul>
              <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-3 py-2">
                <span className="text-xs text-gray-500">
                  {current.users.length === 20 ? 'First 20 matches' : plural(current.users.length, 'match', 'matches')}
                </span>
                <Button variant="quiet" size="sm" onClick={add} disabled={tickedHere.length === 0 || disabled}>
                  {tickedHere.length > 0 ? `Add ${tickedHere.length} to the list` : 'Add to the list'}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Give or extend access for a list of emails in one course, for 1, 2 or 3
 * months, after a preview that saves nothing. Who: a pasted list and accounts
 * found by search, used together. What: a course, a length and a note. The
 * preview reads each email's account and current access; the run is one
 * server action that recomputes every row itself and reports each one.
 */
function GiveAccessDialog({
  courses,
  preset,
  onClose,
}: {
  courses: AccessCourse[];
  preset: GiveAccessPreset;
  onClose: () => void;
}) {
  const fieldId = useId();
  const [text, setText] = useState(() => (preset.emails ?? []).join('\n'));
  const [courseId, setCourseId] = useState(() =>
    courses.some((course) => course.value === preset.courseId) ? preset.courseId ?? '' : ''
  );
  const [months, setMonths] = useState<AccessMonths | null>(preset.months ?? null);
  const [note, setNote] = useState('');
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [previewAttempt, setPreviewAttempt] = useState(0);
  const [run, setRun] = useState<RunState>({ status: 'idle', results: new Map() });
  // Each email's access before this dialog first sent it, by course: every
  // later send carries the same, so a resend is the same run (`giveCourseAccess`).
  const sentFrom = useRef(new Map<string, string>());

  const entries = useMemo(() => parseEmailList(text), [text]);
  const validEmails = useMemo(
    () => entries.filter((entry) => entry.status === 'valid').map((entry) => entry.email),
    [entries]
  );
  const invalidCount = entries.filter((entry) => entry.status === 'invalid').length;
  const duplicateCount = entries.filter((entry) => entry.status === 'duplicate').length;
  const isTooMany = validEmails.length > MAX_ACCESS_EMAILS;
  const course = courses.find((option) => option.value === courseId);
  const isLocked = run.status !== 'idle' || Boolean(run.uncertain);

  // Everything the preview depends on, in one string: a change to any of it
  // makes the shown preview stale until the new read lands.
  const previewKey = courseId && validEmails.length > 0 && !isTooMany
    ? [courseId, ...validEmails].join('\n')
    : '';

  useEffect(() => {
    if (!previewKey) return;

    let cancelled = false;
    const [category, ...emails] = previewKey.split('\n');
    const timer = setTimeout(async () => {
      setPreview({ key: previewKey, status: 'loading' });
      try {
        const response = await previewCourseAccess({ category, emails });
        if (cancelled) return;
        setPreview(response.success
          ? { key: previewKey, status: 'ready', todayKey: response.todayKey, rows: new Map(response.rows.map((row) => [row.email, row])) }
          : { key: previewKey, status: 'error', error: response.error });
      } catch {
        if (!cancelled) setPreview({ key: previewKey, status: 'error', error: 'No connection' });
      }
    }, PREVIEW_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [previewKey, previewAttempt]);

  const shownPreview = preview && preview.key === previewKey ? preview : null;
  const ready = shownPreview?.status === 'ready' ? shownPreview : null;
  const todayKey = run.todayKey ?? ready?.todayKey ?? '';

  const plans = useMemo(() => {
    const map = new Map<string, ReturnType<typeof planAccess>>();
    if (!ready) return map;
    for (const email of validEmails) {
      const row = ready.rows.get(email);
      // The kind of change does not depend on the length; the new end does.
      if (row) map.set(email, planAccess(row.current, ready.todayKey, months ?? 1));
    }
    return map;
  }, [ready, validEmails, months]);

  const sendable = validEmails.filter((email) => {
    const plan = plans.get(email);
    return plan && plan.change !== 'unchanged';
  });

  const failed = [...run.results.values()].filter((row) => row.outcome === 'failed');
  const changed = [...run.results.values()].filter((row) => row.outcome === 'changed');
  const given = [...run.results.values()].filter((row) => row.outcome === 'given');

  const blockedReason = !courseId
    ? 'Choose a course'
    : validEmails.length === 0
      ? 'Add at least one email'
      : isTooMany
        ? `Up to ${MAX_ACCESS_EMAILS} emails at a time`
        : !months
          ? 'Choose how long'
          : !ready
            ? shownPreview?.status === 'error' ? 'The emails could not be checked' : 'Checking the emails…'
            : sendable.length === 0
              ? 'No emails to send'
              : null;

  const addEmails = (emails: string[]) => {
    if (emails.length === 0) return;
    setText((previous) => {
      const trimmed = previous.trimEnd();
      return `${trimmed}${trimmed ? '\n' : ''}${emails.join('\n')}\n`;
    });
  };

  async function send(emails: string[]) {
    if (!months || !courseId) return;

    const expected: Record<string, string> = {};
    for (const email of emails) {
      const key = `${courseId}\n${email}`;
      const row = ready?.rows.get(email);
      const seen = sentFrom.current.get(key) ?? (row ? accessStateToken(row.current) : undefined);
      // Without a preview row the server has nothing to check against and leaves the email alone.
      if (seen === undefined) continue;
      expected[email] = seen;
      sentFrom.current.set(key, seen);
    }

    setRun((previous) => ({ ...previous, status: 'running', error: undefined }));

    try {
      const response = await giveCourseAccess({ category: courseId, emails, months, note, expected });
      if (!response.success) {
        setRun((previous) => ({
          ...previous,
          status: previous.results.size > 0 ? 'done' : 'idle',
          error: describeAccessError(response.error),
        }));
        return;
      }

      setRun((previous) => {
        const results = new Map(previous.results);
        for (const row of response.rows) results.set(row.email, row);
        return { status: 'done', todayKey: response.todayKey, results };
      });
    } catch {
      // The answer was lost, not necessarily the work. Nothing can be edited
      // until a send answers: a resend is this same run, and the server skips
      // rows it already saved instead of adding the months again.
      setRun((previous) => ({
        ...previous,
        status: previous.results.size > 0 ? 'done' : 'idle',
        uncertain: true,
        error: 'No answer from the server. Some emails may already have access. Sending again is safe: no one is given the same months twice.',
      }));
    }
  }

  const counter = entries.length === 0
    ? 'Separate emails with commas, spaces or new lines.'
    : [
        plural(validEmails.length, 'email', 'emails'),
        invalidCount > 0 && `${invalidCount} invalid`,
        duplicateCount > 0 && plural(duplicateCount, 'duplicate', 'duplicates'),
      ].filter(Boolean).join(' · ');

  const footer = run.status === 'done' ? (
    <>
      {failed.length > 0 && (
        <Button variant="secondary" onClick={() => send(failed.map((row) => row.email))}>
          Retry {plural(failed.length, 'email', 'emails')} not saved
        </Button>
      )}
      <Button onClick={onClose}>Done</Button>
    </>
  ) : (
    <>
      {blockedReason && run.status === 'idle' && (
        <p className={cn(hintClass, 'sm:mr-auto')} aria-live="polite">{blockedReason}</p>
      )}
      <Button variant="secondary" onClick={onClose} disabled={run.status === 'running'}>Cancel</Button>
      <Button onClick={() => send(sendable)} disabled={Boolean(blockedReason) || run.status === 'running'}>
        {run.status === 'running' && <Loader2 className="h-4 w-4 animate-spin" />}
        {run.status === 'running'
          ? 'Giving access…'
          : `Give access to ${plural(sendable.length, 'email', 'emails')}`}
      </Button>
    </>
  );

  return (
    <Dialog
      open
      size="xl"
      title="Give access"
      busy={run.status === 'running'}
      onClose={onClose}
      footer={footer}
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="space-y-4">
            <Field
              label="Emails"
              htmlFor={`${fieldId}-emails`}
              error={isTooMany
                ? `This list has ${validEmails.length} emails. Give access to up to ${MAX_ACCESS_EMAILS} at a time: remove ${validEmails.length - MAX_ACCESS_EMAILS} or split the list.`
                : undefined}
              hint={<span aria-live="polite" className="tabular-nums">{counter}</span>}
            >
              <Textarea
                id={`${fieldId}-emails`}
                rows={6}
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="madina.yusupova@gmail.com, jasur.karimov@mail.ru"
                spellCheck={false}
                disabled={isLocked}
                // With emails already chosen, the length is the next decision.
                {...(preset.emails?.length ? {} : { 'data-autofocus': true })}
              />
            </Field>
            <StudentSearch listed={new Set(validEmails)} disabled={isLocked} onAdd={addEmails} />
          </div>

          <div className="space-y-4">
            <Field label="Course" htmlFor={`${fieldId}-course`}>
              <Select
                id={`${fieldId}-course`}
                value={courseId}
                onChange={(event) => setCourseId(event.target.value)}
                disabled={isLocked}
                required
              >
                <option value="" disabled>Choose a course</option>
                {courses.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.visible ? option.label : `${option.label} · hidden`}
                  </option>
                ))}
              </Select>
            </Field>

            <fieldset className="space-y-1.5">
              <legend className={labelClass}>Length</legend>
              <div className={segmentedClass}>
                {ACCESS_MONTH_CHOICES.map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    aria-pressed={months === choice}
                    onClick={() => setMonths(choice)}
                    disabled={isLocked}
                    className={segmentClass(months === choice)}
                    {...(preset.emails?.length && choice === months ? { 'data-autofocus': true } : {})}
                  >
                    {plural(choice, 'month', 'months')}
                  </button>
                ))}
              </div>
            </fieldset>

            <Field
              label="Note (optional)"
              htmlFor={`${fieldId}-note`}
              hint={`Leave empty to keep each student's existing note. ${note.length} / ${MAX_ACCESS_NOTE_LENGTH}`}
            >
              <Input
                id={`${fieldId}-note`}
                value={note}
                maxLength={MAX_ACCESS_NOTE_LENGTH}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Paid at reception, Oct intake"
                disabled={isLocked}
              />
            </Field>

            <div className="space-y-1 text-sm text-gray-600">
              <p>Access is extended from each student&apos;s current end date. Nobody&apos;s access gets shorter.</p>
              <p>Students must sign up with exactly this email.</p>
              {course && !course.visible && <p>Students with access still see a hidden course.</p>}
            </div>
          </div>
        </div>

        <section aria-labelledby={`${fieldId}-preview`} className="space-y-3">
          <h3 id={`${fieldId}-preview`} className="text-sm font-semibold text-gray-900">
            {run.status !== 'idle' ? 'Result' : run.uncertain ? 'Preview' : 'Preview · nothing is saved yet'}
          </h3>

          {run.error && <Alert tone="danger">{run.error}</Alert>}
          {run.status === 'done' && !run.error && (
            failed.length === 0 && changed.length === 0 ? (
              <Alert tone="success">
                {plural(given.length, 'email', 'emails')} given access to {course?.label}. Tell the group in class or in your chat.
              </Alert>
            ) : (
              // Rows not saved are a failure, as their red badges below say: amber is for what is pending.
              <Alert tone="danger" title={`${given.length} given access · ${failed.length + changed.length} not saved`}>
                {failed.length > 0 && (
                  <p>{plural(failed.length, 'email', 'emails')} could not be saved and keep the access they had. Retry them below.</p>
                )}
                {changed.length > 0 && (
                  <p>
                    {plural(changed.length, 'email', 'emails')} changed since the preview and {changed.length === 1 ? 'was' : 'were'} left
                    as {changed.length === 1 ? 'it is' : 'they are'}. Open Give access again to see their access now.
                  </p>
                )}
              </Alert>
            )
          )}

          {entries.length === 0 ? (
            <EmptyState icon={<Mail />} title="Paste emails or find students to see who gets access" />
          ) : !courseId ? (
            <EmptyState icon={<Mail />} title="Choose a course to see current access" />
          ) : isTooMany ? (
            // The field says what to do; a table of 130 rows that will never be checked would not.
            null
          ) : shownPreview?.status === 'error' && run.status === 'idle' ? (
            <Alert
              tone="danger"
              action={
                <Button variant="secondary" size="sm" onClick={() => setPreviewAttempt((attempt) => attempt + 1)}>
                  Try again
                </Button>
              }
            >
              {shownPreview.error === 'No connection'
                ? 'Could not check these emails: no connection.'
                : `Could not check these emails. ${describeAccessError(shownPreview.error).replace(/^Not saved: /, '')}`}
            </Alert>
          ) : (
            <div className="max-h-80 overflow-auto rounded-xl border border-gray-200">
              <table className={tableClass}>
                <caption className="sr-only">Preview of access for {plural(validEmails.length, 'email', 'emails')}</caption>
                <thead className="sticky top-0 z-10">
                  <tr>
                    <th scope="col" className={thClass}>Email</th>
                    <th scope="col" className={cn(thClass, 'hidden sm:table-cell')}>Account</th>
                    <th scope="col" className={cn(thClass, 'hidden sm:table-cell')}>Now</th>
                    <th scope="col" className={cn(thClass, 'hidden sm:table-cell')}>After</th>
                    <th scope="col" className={thClass}>{run.status === 'idle' ? 'Change' : 'Result'}</th>
                  </tr>
                </thead>
                <tbody className="[&>tr:last-child>td]:border-b-0">
                  {entries.map((entry, index) => {
                    const row = ready?.rows.get(entry.email);
                    const plan = entry.status === 'valid' ? plans.get(entry.email) : undefined;
                    const afterKey = months && plan ? plan.afterKey : null;
                    const result = entry.status === 'valid' ? run.results.get(entry.email) : undefined;
                    const isChecking = entry.status === 'valid' && !row;
                    const now = row ? describeCurrent(row.current, todayKey) : '';
                    const after = !plan ? '—' : plan.change === 'unchanged' ? 'No end date' : afterKey ? `Until ${formatDateKey(afterKey, todayKey)}` : '—';

                    return (
                      <tr key={`${entry.email}-${index}`}>
                        <td className={tdClass}>
                          <p className="max-w-64 truncate text-sm text-gray-900">{entry.email}</p>
                          {/* Phones drop the middle columns; the dates move under the email. */}
                          {row && (
                            <p className="text-xs text-gray-500 sm:hidden">
                              {now} → {after}
                            </p>
                          )}
                        </td>
                        <td className={cn(tdClass, 'hidden sm:table-cell')}>
                          {row ? <AccountCell name={row.name} account={row.account} /> : isChecking ? <Skeleton className="h-4 w-28" /> : '—'}
                        </td>
                        <td className={cn(tdClass, 'hidden whitespace-nowrap sm:table-cell')}>
                          {entry.status !== 'valid' ? '—' : isChecking ? <Skeleton className="h-4 w-20" /> : now}
                        </td>
                        <td className={cn(tdClass, 'hidden whitespace-nowrap sm:table-cell')}>
                          {entry.status !== 'valid' || isChecking ? '—' : after}
                        </td>
                        <td className={cn(tdClass, 'whitespace-nowrap')}>
                          {entry.status === 'invalid' ? (
                            <Badge tone="danger">Invalid email</Badge>
                          ) : entry.status === 'duplicate' ? (
                            <span className="text-xs text-gray-500">Duplicate · sent once</span>
                          ) : result?.outcome === 'given' ? (
                            <Badge tone="success">Given · until {formatDateKey(result.endKey, todayKey)}</Badge>
                          ) : result?.outcome === 'failed' ? (
                            <Badge tone="danger" className="max-w-56 truncate">{describeAccessError(result.error)}</Badge>
                          ) : result?.outcome === 'changed' ? (
                            <Badge tone="danger">Changed since the preview</Badge>
                          ) : plan ? (
                            plan.change === 'unchanged'
                              ? <span className="text-xs text-gray-500">Unchanged · not sent</span>
                              : run.status === 'idle' ? <Badge>{ACCESS_CHANGE_LABELS[plan.change]}</Badge> : <span className="text-xs text-gray-500">Not sent</span>
                          ) : (
                            <Skeleton className="h-4 w-16" />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </Dialog>
  );
}
