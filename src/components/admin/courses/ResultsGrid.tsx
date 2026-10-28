'use client';

import React, { useId, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, ClipboardCopy, Download, FileText, Laptop, Users } from 'lucide-react';
import { ACCOUNT_STATE_LABELS, formatDateKey, type AccessAccountState } from '@/components/admin/courses/accessPlan';
import { courseHref } from '@/components/admin/courses/courseLinks';
import { GiveAccessButton, type AccessCourse } from '@/components/admin/courses/GiveAccess';
import { Badge } from '@/components/ui/Badge';
import { Button, buttonClass, linkClass } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Feedback';
import { Select, labelClass, textareaClass } from '@/components/ui/Field';
import { List, rowChevronClass, tableClass, tableWrapClass, tdClass, thClass } from '@/components/ui/List';
import { ChipCheck, chipClass } from '@/components/ui/Misc';
import { cn } from '@/components/ui/cn';

export type ResultsGridRow = {
  key: string;
  name: string | null;
  email: string;
  userId: string | null;
  account: AccessAccountState;
  /** Has access now · access ended in the last 60 days · a result here but no access entry. */
  group: 'active' | 'ended' | 'other';
  endedKey: string | null;
  isAdmin: boolean;
  /** Latest stored result per test id: the score, or "7 of 9" under 10 questions. */
  cells: Record<string, { value: string; attempts: number }>;
};

type Column = { id: string; title: string; questionCount: number };

type CopyState = { status: 'idle' } | { status: 'copied'; count: number } | { status: 'blocked'; text: string };

function displayName(row: ResultsGridRow) {
  return row.name || row.email;
}

/** A cell: the latest result, "×2" when there were more attempts, a link to the student's results. */
function Cell({ row, column }: { row: ResultsGridRow; column: Column }) {
  const cell = row.cells[column.id];
  if (!cell || !row.userId) {
    return (
      <>
        <span aria-hidden className="text-gray-500">—</span>
        <span className="sr-only">No result</span>
      </>
    );
  }

  return (
    <Link
      href={`/admin/users/${row.userId}`}
      prefetch={false}
      className={cn(linkClass, 'whitespace-nowrap tabular-nums')}
      aria-label={`${displayName(row)}, ${column.title}, ${cell.value}${cell.attempts > 1 ? `, ${cell.attempts} attempts` : ''}, open their results`}
    >
      {cell.value}
      {cell.attempts > 1 && <span className="ml-1 text-xs text-gray-500">×{cell.attempts}</span>}
    </Link>
  );
}

/** "Others with results (12)": a folded group, closed while there are students with access to look at first. */
function OthersToggle({
  isOpen,
  onToggle,
  total,
  shown,
  className,
}: {
  isOpen: boolean;
  onToggle: () => void;
  total: number;
  shown: number;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={isOpen}
      className={cn(
        'inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-600',
        className,
      )}
    >
      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      Others with results ({total})
      {total > shown && isOpen && <span className="font-normal text-gray-500">, first {shown} by name</span>}
    </button>
  );
}

/** A phone row: the student and their result on the chosen test, opening their results when there is one. */
function PhoneRow({ row, test, todayKey }: { row: ResultsGridRow; test: Column | undefined; todayKey: string }) {
  const cell = test ? row.cells[test.id] : undefined;
  const content = (
    <>
      <div className="min-w-0 flex-1"><RowHeader row={row} todayKey={todayKey} /></div>
      <span className="shrink-0 text-sm tabular-nums text-gray-900">
        {cell ? cell.value : <span className="text-gray-500">—</span>}
        {cell && cell.attempts > 1 && <span className="ml-1 text-xs text-gray-500">×{cell.attempts}</span>}
      </span>
    </>
  );

  return (
    <li>
      {cell && row.userId ? (
        <Link href={`/admin/users/${row.userId}`} prefetch={false} className="group flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink-600">
          {content}
          <ChevronRight aria-hidden className={rowChevronClass} />
        </Link>
      ) : (
        <div className="flex min-h-14 items-center gap-3 px-4 py-3">{content}</div>
      )}
    </li>
  );
}

function RowHeader({ row, todayKey }: { row: ResultsGridRow; todayKey: string }) {
  return (
    <div className="min-w-0">
      <p className={cn('truncate font-medium', row.group === 'ended' ? 'text-gray-500' : 'text-gray-900')}>{displayName(row)}</p>
      <div className="flex flex-wrap items-center gap-1">
        {row.group === 'ended' && row.endedKey && (
          <span className="text-xs text-gray-500">Access ended {formatDateKey(row.endedKey, todayKey)}</span>
        )}
        {row.group !== 'ended' && row.account !== 'confirmed' && (
          <Badge tone={row.account === 'waiting' ? 'warning' : 'neutral'}>{ACCOUNT_STATE_LABELS[row.account]}</Badge>
        )}
        {row.isAdmin && <Badge tone="accent">Admin</Badge>}
      </div>
    </div>
  );
}

/**
 * Before class: who did which test. Students with access, then those whose
 * access ended in the last 60 days (greyed), then a folded group of everyone
 * else with a result here. Columns are the visible tests in course order.
 * "No result yet for …" leaves the rows still to do, and [Copy names] copies
 * them. On a phone the grid becomes one test at a time.
 */
export default function ResultsGrid({
  courseId,
  courses,
  todayKey,
  columns,
  hasAnyTest,
  rows,
  otherRows,
  otherTotal,
}: {
  courseId: string;
  courses: AccessCourse[];
  todayKey: string;
  columns: Column[];
  hasAnyTest: boolean;
  rows: ResultsGridRow[];
  otherRows: ResultsGridRow[];
  otherTotal: number;
}) {
  const fieldId = useId();
  const [missingTestId, setMissingTestId] = useState('');
  // With no one given access the others are all there is, so they start open.
  const [isOthersOpen, setIsOthersOpen] = useState(() => rows.length === 0);
  const [copy, setCopy] = useState<CopyState>({ status: 'idle' });
  const [phoneTestId, setPhoneTestId] = useState(() => columns.at(-1)?.id ?? '');
  const [phoneMissingOnly, setPhoneMissingOnly] = useState(false);

  // "No result yet" asks who in the group still has a test to do: the
  // others are not the group, so the filters leave them out.
  const missingTest = columns.find((column) => column.id === missingTestId);
  const shownRows = missingTest ? rows.filter((row) => !row.cells[missingTest.id]) : rows;
  const shownOthers = missingTest ? [] : otherRows;
  const phoneTest = columns.find((column) => column.id === phoneTestId) ?? columns.at(-1);
  const phoneRows = phoneTest && phoneMissingOnly ? rows.filter((row) => !row.cells[phoneTest.id]) : rows;
  const phoneOthers = phoneMissingOnly ? [] : otherRows;
  const toggleOthers = () => setIsOthersOpen((open) => !open);

  // A filter that leaves no one: everyone in the group has the result, or there is no group yet.
  const filteredEmpty = (test: Column, clear?: React.ReactNode) => (rows.length > 0 ? (
    <EmptyState title={`Everyone has a result for ${test.title}`} action={clear} />
  ) : (
    <EmptyState
      icon={<Users />}
      title="No one has access yet"
      description="This filter looks only at students with access."
      action={clear}
    />
  ));

  const copyNames = async (list: ResultsGridRow[]) => {
    const text = list.map(displayName).join(', ');
    try {
      await navigator.clipboard.writeText(text);
      setCopy({ status: 'copied', count: list.length });
    } catch {
      // Blocked (an http page, a refused permission): the names go where they can be selected.
      setCopy({ status: 'blocked', text });
    }
  };

  if (rows.length === 0 && otherRows.length === 0) {
    return (
      <EmptyState
        icon={<Users />}
        title="No one has access yet"
        description="Students appear here once they have access."
        action={<GiveAccessButton courses={courses} preset={{ courseId }} />}
      />
    );
  }

  if (columns.length === 0) {
    return (
      <EmptyState
        icon={<FileText />}
        title={hasAnyTest ? 'No visible tests in this course' : 'No tests in this course yet'}
        action={
          <Link href={courseHref(courseId)} className={buttonClass({ variant: 'secondary', size: 'sm' })}>
            Open tests
          </Link>
        }
      />
    );
  }

  // The same grid as a file: these rows and columns, the same cells.
  const csvHref = `/api/admin/results/sections/export?course=${encodeURIComponent(courseId)}`;
  const countLine = missingTest
    ? `${shownRows.length} of ${rows.length} have no result for ${missingTest.title}`
    : `${rows.length} ${rows.length === 1 ? 'student' : 'students'}`;

  return (
    <div className="space-y-4">
      {/* Desktop toolbar. */}
      <div className="hidden flex-wrap items-end justify-between gap-3 md:flex">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-72 space-y-1.5">
            <label htmlFor={`${fieldId}-missing`} className={labelClass}>No result yet for</label>
            <Select id={`${fieldId}-missing`} value={missingTestId} onChange={(event) => setMissingTestId(event.target.value)}>
              <option value="">Any test (show everyone)</option>
              {columns.map((column) => (
                <option key={column.id} value={column.id}>{column.title}</option>
              ))}
            </Select>
          </div>
          {/* On the gray-100 canvas, where gray-500 misses AA. */}
          <p aria-live="polite" className="pb-2 text-sm tabular-nums text-gray-600">{countLine}</p>
        </div>
        <div className="flex items-center gap-2">
          <a href={csvHref} className={buttonClass({ variant: 'secondary' })}>
            <Download className="h-4 w-4" />
            Download CSV
          </a>
          <Button onClick={() => copyNames(shownRows)} disabled={shownRows.length === 0}>
            <ClipboardCopy className="h-4 w-4" />
            Copy names
          </Button>
        </div>
      </div>

      <p className="flex items-center gap-2 text-xs text-gray-600">
        <Laptop aria-hidden className="h-4 w-4 shrink-0" />
        Tests in progress on a student&apos;s device are not visible until they are submitted.
      </p>

      <div aria-live="polite">
        {copy.status === 'copied' && (
          <p className="text-sm text-gray-600">{copy.count === 1 ? '1 name copied' : `${copy.count} names copied`}</p>
        )}
        {copy.status === 'blocked' && (
          <div className="space-y-1.5">
            <p className="text-sm text-gray-600">Copying is blocked in this browser. Select the names below and copy them.</p>
            <textarea readOnly value={copy.text} rows={3} className={textareaClass()} aria-label="Names to copy" />
          </div>
        )}
      </div>

      {/* Desktop: the grid. */}
      {missingTest && shownRows.length === 0 ? (
        <div className="hidden md:block">
          {filteredEmpty(
            missingTest,
            <Button variant="secondary" size="sm" onClick={() => setMissingTestId('')}>Clear filter</Button>,
          )}
        </div>
      ) : (
        <div className={cn(tableWrapClass, 'hidden md:block')}>
          <table className={tableClass}>
            <caption className="sr-only">Latest result of each student on each test</caption>
            <thead>
              <tr>
                <th scope="col" className={cn(thClass, 'sticky left-0 z-10 min-w-56')}>Student</th>
                {columns.map((column) => (
                  <th key={column.id} scope="col" className={cn(thClass, 'min-w-28 text-right align-bottom')}>
                    <Link
                      href={`/admin/tests/${column.id}/stats`}
                      prefetch={false}
                      title={column.title}
                      className={cn(linkClass, 'line-clamp-2 max-w-36 whitespace-normal font-medium')}
                    >
                      {column.title}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="[&>tr:last-child>*]:border-b-0">
              {shownRows.map((row) => (
                <tr key={row.key}>
                  <th scope="row" className={cn(tdClass, 'sticky left-0 z-10 bg-white text-left font-normal')}>
                    <div className="max-w-56"><RowHeader row={row} todayKey={todayKey} /></div>
                  </th>
                  {columns.map((column) => (
                    <td key={column.id} className={cn(tdClass, 'text-right')}>
                      <Cell row={row} column={column} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {shownOthers.length > 0 && (
              <tbody className="[&>tr:last-child>*]:border-b-0">
                <tr>
                  <td colSpan={columns.length + 1} className={cn(tdClass, 'bg-gray-50 py-2')}>
                    <OthersToggle
                      isOpen={isOthersOpen}
                      onToggle={toggleOthers}
                      total={otherTotal}
                      shown={shownOthers.length}
                      className="sticky left-4"
                    />
                  </td>
                </tr>
                {isOthersOpen && shownOthers.map((row) => (
                  <tr key={row.key}>
                    <th scope="row" className={cn(tdClass, 'sticky left-0 z-10 bg-white text-left font-normal')}>
                      <div className="max-w-56"><RowHeader row={row} todayKey={todayKey} /></div>
                    </th>
                    {columns.map((column) => (
                      <td key={column.id} className={cn(tdClass, 'text-right')}>
                        <Cell row={row} column={column} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </div>
      )}

      {/* Phones: one test at a time. */}
      <div className="space-y-3 md:hidden">
        <div className="space-y-1.5">
          <label htmlFor={`${fieldId}-phone-test`} className={labelClass}>Test</label>
          <Select id={`${fieldId}-phone-test`} value={phoneTest?.id ?? ''} onChange={(event) => setPhoneTestId(event.target.value)}>
            {columns.map((column) => (
              <option key={column.id} value={column.id}>{column.title}</option>
            ))}
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-pressed={phoneMissingOnly}
            onClick={() => setPhoneMissingOnly((value) => !value)}
            className={chipClass(phoneMissingOnly)}
          >
            <ChipCheck active={phoneMissingOnly} />
            No result yet
          </button>
          <Button variant="secondary" size="sm" onClick={() => copyNames(phoneRows)} disabled={phoneRows.length === 0}>
            <ClipboardCopy className="h-4 w-4" />
            Copy names
          </Button>
        </div>
        {phoneTest && phoneMissingOnly && phoneRows.length === 0 ? (
          filteredEmpty(phoneTest)
        ) : phoneRows.length > 0 && (
          <List>
            {phoneRows.map((row) => <PhoneRow key={row.key} row={row} test={phoneTest} todayKey={todayKey} />)}
          </List>
        )}
        {/* The same folded group as on desktop: Premium students, admins, anyone with a result here but no access entry. */}
        {phoneOthers.length > 0 && (
          <div className="space-y-2">
            <OthersToggle isOpen={isOthersOpen} onToggle={toggleOthers} total={otherTotal} shown={phoneOthers.length} />
            {isOthersOpen && (
              <List>
                {phoneOthers.map((row) => <PhoneRow key={row.key} row={row} test={phoneTest} todayKey={todayKey} />)}
              </List>
            )}
          </div>
        )}
        <a href={csvHref} className={buttonClass({ variant: 'secondary', block: true })}>
          <Download className="h-4 w-4" />
          Download CSV
        </a>
      </div>
    </div>
  );
}
