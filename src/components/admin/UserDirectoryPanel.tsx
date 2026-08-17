'use client';

import React, { memo, useDeferredValue, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, BarChart3, CalendarDays, ListPlus, Mail, Search, ShieldCheck, UserRound } from 'lucide-react';

type UserDirectoryEntry = {
  id: string;
  email: string;
  name: string | null;
  role: 'USER' | 'ADMIN';
  createdAt: Date | string;
  _count: {
    results: number;
    subscriptions: number;
    payments: number;
    manualPaymentRequests: number;
  };
};

type UserDirectoryPanelProps = {
  users: UserDirectoryEntry[];
  totalCount: number;
};

const PAGE_SIZE = 50;

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

function formatDate(value: Date | string) {
  return dateFormatter.format(new Date(value));
}

const UserRow = memo(function UserRow({ user }: { user: UserDirectoryEntry }) {
  const displayName = user.name || user.email;
  const isAdmin = user.role === 'ADMIN';

  return (
    <Link
      href={`/admin/users/${user.id}`}
      prefetch={false}
      className="group block rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-blue-200 hover:bg-white"
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold text-slate-900">{displayName}</h3>
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium uppercase ${
              isAdmin ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-600'
            }`}>
              <ShieldCheck className="h-3 w-3" />
              {user.role}
            </span>
          </div>
          <p className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-500">
            <Mail className="h-4 w-4 shrink-0" />
            <span className="truncate">{user.email}</span>
          </p>
        </div>

        <div className="grid gap-2 text-xs font-medium text-slate-500 sm:grid-cols-2 xl:min-w-[26rem]">
          <span className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2">
            <CalendarDays className="h-4 w-4 text-slate-400" />
            Joined {formatDate(user.createdAt)}
          </span>
          <span className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2">
            <BarChart3 className="h-4 w-4 text-slate-400" />
            {user._count.results} results
          </span>
          <span className="rounded-xl bg-white px-3 py-2">
            {user._count.subscriptions} active subscription{user._count.subscriptions === 1 ? '' : 's'}
          </span>
          <span className="rounded-xl bg-white px-3 py-2">
            {user._count.payments + user._count.manualPaymentRequests} payment records
          </span>
        </div>

        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm transition group-hover:text-blue-600 xl:ml-2">
          <ArrowUpRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
});

export default function UserDirectoryPanel({ users, totalCount }: UserDirectoryPanelProps) {
  const [query, setQuery] = useState('');
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

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-blue-600">
            <UserRound className="h-4 w-4" />
            User directory
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Users</h2>
          <p className="mt-2 text-sm font-semibold text-slate-500">
            {totalCount} registered users
            {totalCount > users.length ? `, showing latest ${users.length}` : ''}
          </p>
        </div>

        <div className="relative w-full lg:max-w-md">
          <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search users"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-4 pl-12 pr-5 font-semibold text-slate-900 transition-all focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
          />
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-widest text-slate-400">
        <span>{visibleUsers.length} of {filteredUsers.length} shown</span>
        <span className="h-1 w-1 rounded-full bg-slate-300" />
        <span>Scrollable list</span>
      </div>

      <div className="max-h-[34rem] space-y-3 overflow-y-auto pr-2">
        {visibleUsers.map((user) => (
          <UserRow key={user.id} user={user} />
        ))}

        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setVisibleCount((current) => current + PAGE_SIZE)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-medium uppercase tracking-widest text-slate-500 transition hover:border-blue-200 hover:bg-white hover:text-blue-600"
          >
            <ListPlus className="h-4 w-4" />
            Show more ({hiddenCount} left)
          </button>
        )}

        {filteredUsers.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm font-semibold text-slate-400">
            No users match this search.
          </div>
        )}
      </div>
    </section>
  );
}
