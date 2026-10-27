'use client';

import React, { useDeferredValue, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { CalendarPlus, Loader2, Search, Trash2, UserPlus, X } from 'lucide-react';
import { giveCourseAccess, revokeSectionAccess } from '@/app/admin/section-access-actions';
import {
  ACCOUNT_STATE_LABELS,
  accessStateToken,
  daysBetweenKeys,
  describeAccessError,
  endsSoon,
  formatDateKey,
  type AccessAccountState,
} from '@/components/admin/courses/accessPlan';
import { GiveAccessButton, type AccessCourse } from '@/components/admin/courses/GiveAccess';
import { Badge } from '@/components/ui/Badge';
import { Button, IconButton, linkClass } from '@/components/ui/Button';
import { useConfirm } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/Feedback';
import { checkboxClass, inputClass } from '@/components/ui/Field';
import { List, tableClass, tableWrapClass, tdClass, thClass } from '@/components/ui/List';
import { ChipCheck, chipClass, chipCountClass, chipGroupClass } from '@/components/ui/Misc';
import { cn } from '@/components/ui/cn';

export type StudentRow = {
  /** The access entry's id. */
  id: string;
  email: string;
  name: string | null;
  userId: string | null;
  account: AccessAccountState;
  /** The access end as the admin chose it (UTC date of `expiresAt`); null for no end date. */
  endKey: string | null;
  active: boolean;
  note: string | null;
  lastResultKey: string | null;
};

export type StudentFilter = 'all' | 'active' | 'ending' | 'ended' | 'waiting';

const FILTER_LABELS: Record<StudentFilter, string> = {
  all: 'All',
  active: 'Active',
  ending: 'Ends in 7 days',
  ended: 'Ended',
  waiting: 'Waiting for sign-up',
};

const EMPTY_FILTER_TITLES: Record<Exclude<StudentFilter, 'all'>, string> = {
  active: 'No one has access right now',
  ending: 'No access ends in the next 7 days',
  ended: 'No access has ended',
  waiting: 'Everyone with access has a confirmed account',
};

function matchesFilter(row: StudentRow, filter: StudentFilter, todayKey: string) {
  switch (filter) {
    case 'active': return row.active;
    case 'ending': return row.active && endsSoon(row.endKey, todayKey);
    case 'ended': return !row.active;
    case 'waiting': return row.active && row.account !== 'confirmed';
    default: return true;
  }
}

/** "14 Dec · 51 days left", a warning badge in the last week, "Ended 1 Oct", "No end date". */
function AccessUntil({ row, todayKey }: { row: StudentRow; todayKey: string }) {
  if (row.endKey === null) return <span>No end date</span>;
  const date = formatDateKey(row.endKey, todayKey);
  if (!row.active) return <span className="text-gray-500">Ended {date}</span>;

  const daysLeft = daysBetweenKeys(todayKey, row.endKey);
  const left = daysLeft <= 0 ? 'ends today' : daysLeft === 1 ? '1 day left' : `${daysLeft} days left`;
  if (endsSoon(row.endKey, todayKey)) return <Badge tone="warning">{date} · {left}</Badge>;

  return (
    <span className="whitespace-nowrap">
      {date} <span className="text-xs text-gray-500">· {left}</span>
    </span>
  );
}

/** Plain text for the norm (a confirmed account); a badge for what still waits. */
function AccountState({ account }: { account: AccessAccountState }) {
  if (account === 'confirmed') return <span className="text-gray-600">{ACCOUNT_STATE_LABELS.confirmed}</span>;
  return <Badge tone={account === 'waiting' ? 'warning' : 'neutral'}>{ACCOUNT_STATE_LABELS[account]}</Badge>;
}

function StudentName({ row }: { row: StudentRow }) {
  const title = row.name || row.email;
  return (
    <div className="min-w-0">
      {row.userId ? (
        <Link href={`/admin/users/${row.userId}`} prefetch={false} className={cn(linkClass, 'block truncate')}>
          {title}
        </Link>
      ) : (
        <p className="truncate font-medium text-gray-900">{title}</p>
      )}
      {row.name && <p className="truncate text-xs text-gray-500">{row.email}</p>}
    </div>
  );
}

/**
 * Who has access to the course and until when: chips with counts, a search
 * over the loaded list, a table (rows on a phone), and per row [Extend 1
 * month] and [Remove access]. Ticked rows go to Give access together.
 */
export default function StudentsTable({
  courseId,
  courseLabel,
  courses,
  rows,
  todayKey,
  initialFilter,
}: {
  courseId: string;
  courseLabel: string;
  courses: AccessCourse[];
  rows: StudentRow[];
  todayKey: string;
  initialFilter: StudentFilter;
}) {
  const [filter, setFilter] = useState<StudentFilter>(initialFilter);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query).trim().toLowerCase();
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Map<string, string>>(() => new Map());
  const [notice, setNotice] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const { confirm, dialog } = useConfirm();

  const counts = useMemo(() => {
    const result = {} as Record<StudentFilter, number>;
    for (const key of Object.keys(FILTER_LABELS) as StudentFilter[]) {
      result[key] = rows.filter((row) => matchesFilter(row, key, todayKey)).length;
    }
    return result;
  }, [rows, todayKey]);

  const visibleRows = useMemo(() => rows.filter((row) => {
    if (!matchesFilter(row, filter, todayKey)) return false;
    if (!deferredQuery) return true;
    return row.email.includes(deferredQuery) || (row.name?.toLowerCase().includes(deferredQuery) ?? false);
  }), [rows, filter, todayKey, deferredQuery]);

  // A removed entry leaves the selection on its own; the bar counts what is still listed.
  const selectedRows = rows.filter((row) => selected.has(row.id));
  const allVisibleSelected = visibleRows.length > 0 && visibleRows.every((row) => selected.has(row.id));

  const toggle = (id: string) => setSelected((previous) => {
    const next = new Set(previous);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const toggleAll = () => setSelected((previous) => {
    const next = new Set(previous);
    for (const row of visibleRows) {
      if (allVisibleSelected) next.delete(row.id);
      else next.add(row.id);
    }
    return next;
  });

  const setRowError = (id: string, message: string | null) => setRowErrors((previous) => {
    const next = new Map(previous);
    if (message) next.set(id, message);
    else next.delete(id);
    return next;
  });

  const extend = (row: StudentRow) => {
    setBusyId(row.id);
    setRowError(row.id, null);
    setNotice(null);
    startTransition(async () => {
      try {
        // The end this row shows goes with the request: a second press before
        // the page has refreshed, or a retry after a lost answer, finds the
        // month already added and does not add another.
        const response = await giveCourseAccess({
          category: courseId,
          emails: [row.email],
          months: 1,
          expected: { [row.email]: accessStateToken({ endKey: row.endKey }) },
        });
        const result = response.success ? response.rows[0] : null;
        if (!response.success) setRowError(row.id, describeAccessError(response.error));
        else if (result?.outcome === 'failed') setRowError(row.id, describeAccessError(result.error));
        else if (result?.outcome === 'changed') setRowError(row.id, 'Not extended: this access was changed elsewhere. Reload the page to see it.');
        else if (result?.outcome === 'given') {
          setNotice(`Access for ${row.email} extended to ${formatDateKey(result.endKey, response.todayKey)}.`);
        }
      } catch {
        setRowError(row.id, 'No answer from the server. Try again: the month is never added twice.');
      }
      setBusyId(null);
    });
  };

  const remove = async (row: StudentRow) => {
    const isSure = await confirm({
      title: `Remove access to ${courseLabel} for ${row.email}?`,
      description: 'This student can no longer open this course’s tests. Their results stay. This cannot be undone.',
      confirmLabel: 'Remove access',
      tone: 'danger',
    });
    if (!isSure) return;

    setBusyId(row.id);
    setRowError(row.id, null);
    setNotice(null);
    startTransition(async () => {
      try {
        const response = await revokeSectionAccess(row.id);
        if (response.success) {
          setNotice(`Access removed for ${row.email}.`);
          setSelected((previous) => {
            const next = new Set(previous);
            next.delete(row.id);
            return next;
          });
        } else {
          setRowError(row.id, 'Access was not removed. Try again.');
        }
      } catch {
        setRowError(row.id, 'No connection. Access was not removed.');
      }
      setBusyId(null);
    });
  };

  const actions = (row: StudentRow, block = false) => (
    <div className={cn('flex items-center gap-2', block ? 'w-full [&>*]:flex-1' : 'justify-end')}>
      {row.endKey !== null && (
        <Button
          variant="quiet"
          size="sm"
          onClick={() => extend(row)}
          disabled={busyId === row.id}
          aria-label={`Extend access for ${row.name || row.email} by 1 month`}
        >
          {busyId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
          {/* The table's column is narrow; the phone row has room for the words. */}
          {block ? 'Extend 1 month' : '+1 month'}
        </Button>
      )}
      {/* In the table the remove action is an outlined icon, named by its
          label and tooltip: spelled out, two buttons per row pushed the
          table past a 1366px laptop's width and hid them behind a scroll. */}
      {block ? (
        <Button
          variant="danger-secondary"
          size="sm"
          onClick={() => remove(row)}
          disabled={busyId === row.id}
          aria-label={`Remove access for ${row.name || row.email}`}
        >
          <Trash2 className="h-4 w-4" />
          Remove access
        </Button>
      ) : (
        <IconButton
          variant="danger-secondary"
          size="sm"
          onClick={() => remove(row)}
          disabled={busyId === row.id}
          aria-label={`Remove access for ${row.name || row.email}`}
          title="Remove access"
        >
          <Trash2 className="h-4 w-4" />
        </IconButton>
      )}
    </div>
  );

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<UserPlus />}
        title="No one has access yet"
        description="Students sign up with the email you give access to."
        action={<GiveAccessButton courses={courses} preset={{ courseId }} />}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div role="group" aria-label="Show" className={chipGroupClass}>
          {(Object.keys(FILTER_LABELS) as StudentFilter[]).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
              className={chipClass(filter === key)}
            >
              <ChipCheck active={filter === key} />
              {FILTER_LABELS[key]}
              <span className={chipCountClass(filter === key)}>{counts[key]}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative sm:w-64">
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find by name or email"
              aria-label="Find by name or email"
              autoComplete="off"
              className={inputClass({ className: 'pl-9' })}
            />
          </div>
          <GiveAccessButton courses={courses} preset={{ courseId }} />
        </div>
      </div>

      {/* On the gray-100 canvas, where gray-500 misses AA. */}
      <p aria-live="polite" className="text-sm text-gray-600 empty:hidden">{notice}</p>

      {selectedRows.length > 0 && (
        <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 rounded-xl bg-ink-50 px-4 py-2.5">
          <span className="text-sm font-medium text-ink-800 tabular-nums">{selectedRows.length} selected</span>
          <GiveAccessButton
            courses={courses}
            preset={{ courseId, emails: selectedRows.map((row) => row.email), months: 1 }}
            variant="secondary"
            size="sm"
            label="Extend in Give access"
            icon={<CalendarPlus className="h-4 w-4" />}
          />
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
            <X className="h-4 w-4" />
            Clear
          </Button>
        </div>
      )}

      {visibleRows.length === 0 ? (
        <EmptyState
          title={deferredQuery ? 'No one here matches this search' : EMPTY_FILTER_TITLES[filter as Exclude<StudentFilter, 'all'>]}
          action={
            <Button variant="secondary" size="sm" onClick={() => { setFilter('all'); setQuery(''); }}>
              Show all
            </Button>
          }
        />
      ) : (
        <>
          <div className={cn(tableWrapClass, 'hidden md:block')}>
            <table className={tableClass}>
              <caption className="sr-only">Students with access to {courseLabel}</caption>
              <thead>
                <tr>
                  <th scope="col" className={cn(thClass, 'w-10 pr-0')}>
                    <input
                      type="checkbox"
                      className={checkboxClass}
                      checked={allVisibleSelected}
                      onChange={toggleAll}
                      aria-label="Select everyone listed"
                    />
                  </th>
                  <th scope="col" className={thClass}>Student</th>
                  <th scope="col" className={thClass}>Account</th>
                  <th scope="col" className={thClass}>Access until</th>
                  {/* On a laptop the note is a line under the student instead
                      of a column: with it, the table outgrew a 1366px screen
                      and hid the row actions behind a sideways scroll. */}
                  <th scope="col" className={cn(thClass, 'hidden 2xl:table-cell')}>Note</th>
                  <th scope="col" className={thClass}>Last result</th>
                  <th scope="col" className={thClass}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="[&>tr:last-child>td]:border-b-0">
                {visibleRows.map((row) => (
                  <tr key={row.id}>
                    <td className={cn(tdClass, 'pr-0')}>
                      <input
                        type="checkbox"
                        className={checkboxClass}
                        checked={selected.has(row.id)}
                        onChange={() => toggle(row.id)}
                        aria-label={`Select ${row.email}`}
                      />
                    </td>
                    <td className={tdClass}>
                      <div className="max-w-60">
                        <StudentName row={row} />
                        {row.note && <p className="truncate text-xs text-gray-500 2xl:hidden" title={row.note}>{row.note}</p>}
                      </div>
                    </td>
                    <td className={tdClass}><AccountState account={row.account} /></td>
                    <td className={cn(tdClass, 'tabular-nums')}><AccessUntil row={row} todayKey={todayKey} /></td>
                    <td className={cn(tdClass, 'hidden 2xl:table-cell')}>
                      {row.note ? <p className="max-w-48 truncate" title={row.note}>{row.note}</p> : <span className="text-gray-500">—</span>}
                    </td>
                    <td className={cn(tdClass, 'whitespace-nowrap tabular-nums')}>
                      {row.lastResultKey ? formatDateKey(row.lastResultKey, todayKey) : <span className="text-gray-500">—</span>}
                    </td>
                    <td className={tdClass}>
                      {actions(row)}
                      {rowErrors.get(row.id) && <p role="alert" className="mt-1 text-right text-xs text-red-600">{rowErrors.get(row.id)}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phones: one row per student, the actions on a line of their own. */}
          <List className="md:hidden">
            {visibleRows.map((row) => (
              <li key={row.id} className="space-y-2 px-4 py-3">
                <div className="flex items-start gap-3">
                  <label className="-m-2 flex h-10 w-10 shrink-0 items-center justify-center">
                    <input
                      type="checkbox"
                      className={checkboxClass}
                      checked={selected.has(row.id)}
                      onChange={() => toggle(row.id)}
                      aria-label={`Select ${row.email}`}
                    />
                  </label>
                  <div className="min-w-0 flex-1 space-y-1 text-sm">
                    <StudentName row={row} />
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                      <AccountState account={row.account} />
                      <span className="text-gray-400" aria-hidden>·</span>
                      <AccessUntil row={row} todayKey={todayKey} />
                    </div>
                    {row.note && <p className="text-xs text-gray-500">{row.note}</p>}
                  </div>
                </div>
                {actions(row, true)}
                {rowErrors.get(row.id) && <p role="alert" className="text-xs text-red-600">{rowErrors.get(row.id)}</p>}
              </li>
            ))}
          </List>
        </>
      )}

      <p className="text-xs text-gray-600">Students must sign up with exactly the email shown here.</p>
      {dialog}
    </div>
  );
}
