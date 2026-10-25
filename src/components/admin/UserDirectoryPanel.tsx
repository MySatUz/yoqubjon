'use client';

import React, { memo, useDeferredValue, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Search, X } from 'lucide-react';
import { formatDate } from '@/lib/formatDate';
import { linkRowClass, rowLinkClass } from '@/components/admin/adminControls';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/Feedback';
import { buttonClass, iconButtonClass } from '@/components/ui/Button';
import { inputClass } from '@/components/ui/Field';
import { rowChevronClass, tableClass, tableWrapClass, tdClass, thClass } from '@/components/ui/List';
import { cn } from '@/components/ui/cn';

type UserDirectoryEntry = {
  id: string;
  email: string;
  name: string | null;
  role: 'USER' | 'ADMIN';
  createdAt: Date | string;
  attempts: number;
  /** Date of the latest attempt; null for someone who never sat a test. */
  lastActiveAt: Date | string | null;
  hasSubscription: boolean;
  /** Courses this email has live access to, given by an admin. */
  sectionAccessCount: number;
};

type UserDirectoryPanelProps = {
  users: UserDirectoryEntry[];
  totalCount: number;
};

const PAGE_SIZE = 50;

const numericThClass = cn(thClass, 'text-right');
const numericTdClass = cn(tdClass, 'text-right tabular-nums');

/**
 * What the user can open, strongest first. Plain "Free" is the norm and stays
 * text, so the pills mark the rows that differ.
 */
function AccessCell({ user }: { user: UserDirectoryEntry }) {
  const pills = [
    user.role === 'ADMIN' && <Badge key="admin" tone="accent">Admin</Badge>,
    user.hasSubscription && <Badge key="premium" tone="success">Premium</Badge>,
    user.sectionAccessCount > 0 && (
      <Badge key="courses">
        {user.sectionAccessCount} {user.sectionAccessCount === 1 ? 'course' : 'courses'}
      </Badge>
    ),
  ].filter(Boolean);

  return pills.length > 0
    ? <div className="flex flex-wrap gap-1">{pills}</div>
    : <span className="text-mist-500">Free</span>;
}

/** The whole row opens the user (see `linkRowClass`), and ends in a chevron that says so. */
const UserRow = memo(function UserRow({ user }: { user: UserDirectoryEntry }) {
  return (
    <tr className={cn(linkRowClass, 'group')}>
      <td className={tdClass}>
        <div className="max-w-64">
          <Link
            href={`/admin/users/${user.id}`}
            prefetch={false}
            className={cn(rowLinkClass, 'block truncate')}
          >
            {user.name || user.email}
          </Link>
          {/* Phones drop the email column, so the address moves under the name. */}
          {user.name && <p className="truncate text-xs text-mist-500 md:hidden">{user.email}</p>}
        </div>
      </td>
      <td className={cn(tdClass, 'hidden md:table-cell')}>
        <span className="block max-w-64 truncate">{user.email}</span>
      </td>
      <td className={cn(tdClass, 'hidden whitespace-nowrap tabular-nums lg:table-cell')}>
        {formatDate(user.createdAt)}
      </td>
      <td className={cn(tdClass, 'whitespace-nowrap tabular-nums')}>
        {user.lastActiveAt ? formatDate(user.lastActiveAt) : (
          <>
            <span aria-hidden className="text-mist-500">&mdash;</span>
            <span className="sr-only">No attempts</span>
          </>
        )}
      </td>
      <td className={cn(numericTdClass, user.attempts === 0 && 'text-mist-500')}>{user.attempts}</td>
      <td className={tdClass}>
        <AccessCell user={user} />
      </td>
      <td className={cn(tdClass, 'w-10')}>
        <ChevronRight aria-hidden className={rowChevronClass} />
      </td>
    </tr>
  );
});

export default function UserDirectoryPanel({ users, totalCount }: UserDirectoryPanelProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = deferredQuery.trim().toLowerCase();
  const filteredUsers = useMemo(() => {
    if (!normalizedQuery) return users;

    return users.filter((user) => {
      const name = user.name?.toLowerCase() || '';
      const email = user.email.toLowerCase();
      const role = user.role.toLowerCase();

      return name.includes(normalizedQuery) ||
        email.includes(normalizedQuery) ||
        role.includes(normalizedQuery);
    });
  }, [normalizedQuery, users]);

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [renderedQuery, setRenderedQuery] = useState(normalizedQuery);
  if (renderedQuery !== normalizedQuery) {
    // A new search starts from the first page again.
    setRenderedQuery(normalizedQuery);
    setVisibleCount(PAGE_SIZE);
  }

  const visibleUsers = useMemo(
    () => filteredUsers.slice(0, visibleCount),
    [filteredUsers, visibleCount]
  );
  const hiddenCount = filteredUsers.length - visibleUsers.length;

  const clearQuery = () => {
    setQuery('');
    // Back in the field, ready for the next search.
    inputRef.current?.focus();
  };

  return (
    <section className="space-y-3" aria-label="User directory">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && query) {
                event.preventDefault();
                setQuery('');
              }
            }}
            placeholder="Search by name or email"
            aria-label="Search users"
            autoComplete="off"
            // Room for the clear button, which grows to h-10 on a coarse pointer.
            className={inputClass({ className: 'pl-9 pr-9 pointer-coarse:pr-11' })}
          />
          {query && (
            <button
              type="button"
              onClick={clearQuery}
              aria-label="Clear search"
              className={iconButtonClass({ size: 'sm', className: 'absolute right-0.5 top-1/2 -translate-y-1/2' })}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {/* On the mist-100 canvas, where mist-500 misses AA. */}
        <p className="text-xs tabular-nums text-mist-600">
          {normalizedQuery
            ? `${filteredUsers.length} of ${users.length} match`
            : `${totalCount} signed up${totalCount > users.length ? `, newest ${users.length} listed` : ''}`}
        </p>
      </div>

      {filteredUsers.length === 0 ? (
        <EmptyState
          title="No users match this search"
          action={
            <button type="button" onClick={clearQuery} className={buttonClass({ variant: 'secondary', size: 'sm' })}>
              Clear search
            </button>
          }
        />
      ) : (
        <>
          <div className={tableWrapClass}>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th scope="col" className={thClass}>Name</th>
                  <th scope="col" className={cn(thClass, 'hidden md:table-cell')}>Email</th>
                  <th scope="col" className={cn(thClass, 'hidden lg:table-cell')}>Joined</th>
                  <th scope="col" className={thClass}>Last active</th>
                  <th scope="col" className={numericThClass}>Attempts</th>
                  <th scope="col" className={thClass}>Access</th>
                  <th scope="col" className={cn(thClass, 'w-10')}><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody className="[&>tr:last-child>td]:border-b-0">
                {visibleUsers.map((user) => (
                  <UserRow key={user.id} user={user} />
                ))}
              </tbody>
            </table>
          </div>

          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setVisibleCount((current) => current + PAGE_SIZE)}
              className={buttonClass({ variant: 'secondary', size: 'sm', block: true })}
            >
              Show {Math.min(PAGE_SIZE, hiddenCount)} more ({hiddenCount} left)
            </button>
          )}
        </>
      )}
    </section>
  );
}
