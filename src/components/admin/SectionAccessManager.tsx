'use client';

import React, { memo, useCallback, useDeferredValue, useMemo, useState } from 'react';
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  FolderKanban,
  History,
  KeyRound,
  Loader2,
  Mail,
  Search,
  Trash2,
  UserRound,
} from 'lucide-react';
import {
  grantSectionAccess,
  revokeSectionAccess,
} from '@/app/admin/section-access-actions';
import type { TestCollectionOption } from '@/lib/testCatalog';

type DateValue = Date | string;

type SectionAccessGrant = {
  id: string;
  email: string;
  category: string;
  expiresAt: DateValue | null;
  note: string | null;
  createdAt: DateValue;
  user: {
    email: string;
    name: string | null;
  } | null;
};

type SectionAccessManagerProps = {
  collections: TestCollectionOption[];
  grants: SectionAccessGrant[];
  users: GrantUser[];
  // Stamped on the server so expiry checks stay idempotent across re-renders.
  nowMs: number;
};

type GrantUser = {
  id: string;
  email: string;
  name: string | null;
};

type ActionResult = { success?: boolean; error?: string; message?: string } | null;

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

function formatDate(value: DateValue) {
  return dateFormatter.format(new Date(value));
}

function todayInputValue() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function isGrantActive(grant: SectionAccessGrant, now: number) {
  return !grant.expiresAt || new Date(grant.expiresAt).getTime() > now;
}

type SectionPickerProps = {
  collections: TestCollectionOption[];
  activeCountByCategory: Map<string, number>;
  selectedCategory: string | null;
  onSelect: (category: string) => void;
};

const SectionPicker = memo(function SectionPicker({
  collections,
  activeCountByCategory,
  selectedCategory,
  onSelect,
}: SectionPickerProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {collections.map((collection) => {
        const sectionActiveCount = activeCountByCategory.get(collection.value) ?? 0;
        const isSelected = selectedCategory === collection.value;

        return (
          <button
            key={collection.value}
            type="button"
            onClick={() => onSelect(collection.value)}
            aria-pressed={isSelected}
            className={`group flex min-h-28 items-center justify-between gap-4 rounded-2xl border p-5 text-left transition ${
              isSelected
                ? 'border-emerald-500 bg-emerald-600 text-white shadow-lg'
                : 'border-slate-200 bg-slate-50 text-slate-900 hover:border-emerald-200 hover:bg-white'
            }`}
          >
            <span className="min-w-0">
              <span className={`block text-[10px] font-medium uppercase tracking-widest ${
                isSelected ? 'text-emerald-100' : 'text-emerald-600'
              }`}>
                {sectionActiveCount} active access
              </span>
              <span className="mt-2 block truncate text-base font-semibold">{collection.label}</span>
              <span className={`mt-1 block line-clamp-2 text-xs font-medium leading-relaxed ${
                isSelected ? 'text-emerald-100' : 'text-slate-400'
              }`}>
                {collection.description}
              </span>
            </span>
            <ChevronRight className={`h-5 w-5 shrink-0 transition ${
              isSelected ? 'translate-x-1 text-white' : 'text-slate-300 group-hover:translate-x-1 group-hover:text-emerald-500'
            }`} />
          </button>
        );
      })}
    </div>
  );
});

type GrantFormProps = {
  category: string;
  collectionLabel: string;
  users: GrantUser[];
  activeGrantEmails: Set<string>;
  activeCount: number;
  onGrant: (formData: FormData) => Promise<boolean>;
};

const GrantForm = memo(function GrantForm({
  category,
  collectionLabel,
  users,
  activeGrantEmails,
  activeCount,
  onGrant,
}: GrantFormProps) {
  const [emailQuery, setEmailQuery] = useState('');
  const [isEmailSearchOpen, setIsEmailSearchOpen] = useState(false);
  const [highlightedUserIndex, setHighlightedUserIndex] = useState(0);
  const [isGranting, setIsGranting] = useState(false);
  const deferredEmailQuery = useDeferredValue(emailQuery);
  const normalizedEmailQuery = deferredEmailQuery.trim().toLowerCase();
  const suggestedUsers = useMemo(() => {
    if (normalizedEmailQuery.length < 2) return [];

    return users
      .filter((user) => {
        const name = user.name?.toLowerCase() || '';
        return user.email.toLowerCase().includes(normalizedEmailQuery) ||
          name.includes(normalizedEmailQuery);
      })
      .sort((left, right) => {
        const leftEmail = left.email.toLowerCase();
        const rightEmail = right.email.toLowerCase();
        const leftName = left.name?.toLowerCase() || '';
        const rightName = right.name?.toLowerCase() || '';
        const leftStarts = leftEmail.startsWith(normalizedEmailQuery) || leftName.startsWith(normalizedEmailQuery);
        const rightStarts = rightEmail.startsWith(normalizedEmailQuery) || rightName.startsWith(normalizedEmailQuery);

        if (leftStarts !== rightStarts) return leftStarts ? -1 : 1;
        return leftEmail.localeCompare(rightEmail);
      })
      .slice(0, 8);
  }, [normalizedEmailQuery, users]);
  const isSuggestionListOpen = isEmailSearchOpen && normalizedEmailQuery.length >= 2;

  function selectUser(user: GrantUser) {
    setEmailQuery(user.email);
    setIsEmailSearchOpen(false);
    setHighlightedUserIndex(0);
  }

  function handleEmailKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!isEmailSearchOpen || suggestedUsers.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedUserIndex((current) => (current + 1) % suggestedUsers.length);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedUserIndex((current) => (
        current === 0 ? suggestedUsers.length - 1 : current - 1
      ));
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      selectUser(suggestedUsers[highlightedUserIndex] || suggestedUsers[0]);
      return;
    }

    if (event.key === 'Escape') {
      setIsEmailSearchOpen(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsGranting(true);

    const form = event.currentTarget;
    const granted = await onGrant(new FormData(form));
    setIsGranting(false);

    if (granted) {
      form.reset();
      setEmailQuery('');
      setIsEmailSearchOpen(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-8 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5">
      <input type="hidden" name="category" value={category} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-xs font-medium text-white">
            2
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-900">Grant access to {collectionLabel}</p>
            <p className="text-xs font-medium text-slate-400">Only this section will be granted.</p>
          </div>
        </div>
        <span className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-emerald-700 shadow-sm">
          {activeCount} active
        </span>
      </div>

      <div className="grid gap-3 xl:grid-cols-[1fr_0.65fr_1fr_auto]">
        <div className="relative z-30">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            id="section-access-email"
            name="email"
            type="email"
            required
            value={emailQuery}
            onChange={(event) => {
              setEmailQuery(event.target.value);
              setIsEmailSearchOpen(true);
              setHighlightedUserIndex(0);
            }}
            onFocus={() => {
              if (emailQuery.trim().length >= 2) setIsEmailSearchOpen(true);
            }}
            onBlur={() => setIsEmailSearchOpen(false)}
            onKeyDown={handleEmailKeyDown}
            placeholder="Search by name or email"
            autoComplete="off"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={isSuggestionListOpen}
            aria-controls="section-access-user-results"
            aria-activedescendant={
              isEmailSearchOpen && suggestedUsers[highlightedUserIndex]
                ? `section-access-user-${suggestedUsers[highlightedUserIndex].id}`
                : undefined
            }
            className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
          />

          {isSuggestionListOpen && (
            <div
              id="section-access-user-results"
              role="listbox"
              className="absolute left-0 right-0 top-[calc(100%+0.5rem)] max-h-80 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl"
            >
              {suggestedUsers.map((user, index) => {
                const alreadyHasAccess = activeGrantEmails.has(user.email.toLowerCase());
                const isHighlighted = index === highlightedUserIndex;

                return (
                  <button
                    key={user.id}
                    id={`section-access-user-${user.id}`}
                    type="button"
                    role="option"
                    aria-selected={isHighlighted}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      selectUser(user);
                    }}
                    onMouseEnter={() => setHighlightedUserIndex(index)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left transition ${
                      isHighlighted ? 'bg-emerald-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                        isHighlighted ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'
                      }`}>
                        <UserRound className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-slate-900">
                          {user.name || user.email}
                        </span>
                        <span className="block truncate text-xs font-medium text-slate-500">{user.email}</span>
                      </span>
                    </span>
                    {alreadyHasAccess && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-medium uppercase text-emerald-700">
                        <CheckCircle2 className="h-3 w-3" />
                        Has access
                      </span>
                    )}
                  </button>
                );
              })}

              {suggestedUsers.length === 0 && (
                <div className="px-4 py-5 text-center">
                  <p className="text-sm font-semibold text-slate-600">No registered user found</p>
                  <p className="mt-1 text-xs font-medium text-slate-400">
                    You can still grant access to the email you entered.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
        <input
          name="expiresAt"
          type="date"
          min={todayInputValue()}
          title="Optional expiration date"
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
        />
        <input
          name="note"
          maxLength={300}
          placeholder="Note, e.g. paid cash"
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
        />
        <button
          type="submit"
          disabled={isGranting}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60"
        >
          {isGranting ? <Loader2 className="h-5 w-5 animate-spin" /> : <KeyRound className="h-5 w-5" />}
          Grant
        </button>
      </div>
    </form>
  );
});

type GrantListProps = {
  collectionLabel: string;
  activeGrants: SectionAccessGrant[];
  expiredGrants: SectionAccessGrant[];
  onRevoke: (grant: SectionAccessGrant) => Promise<void>;
  nowMs: number;
};

const GrantList = memo(function GrantList({
  collectionLabel,
  activeGrants,
  expiredGrants,
  onRevoke,
  nowMs,
}: GrantListProps) {
  const [query, setQuery] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = deferredQuery.trim().toLowerCase();
  const filteredGrants = useMemo(() => {
    const visibleGrants = showHistory ? expiredGrants : activeGrants;
    if (!normalizedQuery) return visibleGrants;

    return visibleGrants.filter((grant) => {
      const userName = grant.user?.name?.toLowerCase() || '';
      return grant.email.toLowerCase().includes(normalizedQuery) ||
        userName.includes(normalizedQuery);
    });
  }, [activeGrants, expiredGrants, normalizedQuery, showHistory]);

  async function handleRevoke(grant: SectionAccessGrant) {
    if (!confirm(`Remove access for ${grant.email} to ${collectionLabel}?`)) return;

    setRevokingId(grant.id);
    await onRevoke(grant);
    setRevokingId(null);
  }

  const now = nowMs;

  return (
    <>
      <div className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-emerald-600">
            {collectionLabel}
          </p>
          <h4 className="mt-1 text-xl font-semibold text-slate-900">Access list</h4>
          <p className="mt-1 text-xs font-medium text-slate-400">
            {filteredGrants.length} shown / {showHistory ? expiredGrants.length : activeGrants.length} in this view
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 sm:flex-row xl:w-auto">
          <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => setShowHistory(false)}
              className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-medium transition ${
                !showHistory ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <CheckCircle2 className="h-4 w-4" />
              Active {activeGrants.length}
            </button>
            <button
              type="button"
              onClick={() => setShowHistory(true)}
              className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-medium transition ${
                showHistory ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <History className="h-4 w-4" />
              History {expiredGrants.length}
            </button>
          </div>

          <div className="relative w-full sm:min-w-72">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search in ${collectionLabel}`}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
            />
          </div>
        </div>
      </div>

      <div className="max-h-[30rem] space-y-3 overflow-y-auto pr-2">
        {filteredGrants.map((grant) => {
          const isExpired = !isGrantActive(grant, now);

          return (
            <article
              key={grant.id}
              className={`rounded-2xl border p-4 transition ${
                isExpired
                  ? 'border-slate-200 bg-slate-50 opacity-75'
                  : 'border-emerald-100 bg-emerald-50/50 hover:border-emerald-200'
              }`}
            >
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white px-3 py-1 text-[10px] font-medium uppercase tracking-widest text-emerald-700">
                      {collectionLabel}
                    </span>
                    <span className={`rounded-full px-3 py-1 text-[10px] font-medium uppercase tracking-widest ${
                      isExpired ? 'bg-slate-200 text-slate-500' : 'bg-emerald-600 text-white'
                    }`}>
                      {isExpired ? 'Expired' : 'Active'}
                    </span>
                  </div>
                  <p className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-900">
                    <Mail className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="truncate">{grant.email}</span>
                  </p>
                  <p className="mt-1 flex min-w-0 items-center gap-2 text-xs font-medium text-slate-500">
                    <UserRound className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="truncate">
                      {grant.user?.name || grant.user?.email || 'Not registered yet'}
                    </span>
                  </p>
                </div>

                <div className="grid gap-2 text-xs font-medium text-slate-500 sm:grid-cols-2 xl:min-w-[28rem]">
                  <span className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2">
                    <CalendarClock className="h-4 w-4 text-slate-400" />
                    {grant.expiresAt ? `Until ${formatDate(grant.expiresAt)}` : 'No expiration'}
                  </span>
                  <span className="rounded-xl bg-white px-3 py-2">
                    Granted {formatDate(grant.createdAt)}
                  </span>
                  <span className="rounded-xl bg-white px-3 py-2 sm:col-span-2">
                    {grant.note || 'No note'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleRevoke(grant)}
                  disabled={revokingId === grant.id}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-100 bg-white px-4 py-3 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-wait disabled:opacity-50"
                >
                  {revokingId === grant.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Revoke
                </button>
              </div>
            </article>
          );
        })}

        {filteredGrants.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm font-semibold text-slate-400">
            {normalizedQuery
              ? 'No access records match this search.'
              : showHistory
                ? 'No expired access records in this section.'
                : 'No active access records in this section yet.'}
          </div>
        )}
      </div>
    </>
  );
});

export default function SectionAccessManager({ collections, grants, users, nowMs }: SectionAccessManagerProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [result, setResult] = useState<ActionResult>(null);
  const collectionMap = useMemo(() => new Map(
    collections.map((collection) => [collection.value, collection])
  ), [collections]);
  const selectedCollection = selectedCategory
    ? collectionMap.get(selectedCategory) ?? null
    : null;
  const activeCountByCategory = useMemo(() => {
    const now = nowMs;
    const counts = new Map<string, number>();

    for (const grant of grants) {
      if (isGrantActive(grant, now)) {
        counts.set(grant.category, (counts.get(grant.category) ?? 0) + 1);
      }
    }

    return counts;
  }, [grants, nowMs]);
  const [activeSelectedGrants, expiredSelectedGrants] = useMemo(() => {
    const now = nowMs;
    const active: SectionAccessGrant[] = [];
    const expired: SectionAccessGrant[] = [];

    if (selectedCategory) {
      for (const grant of grants) {
        if (grant.category !== selectedCategory) continue;
        if (isGrantActive(grant, now)) active.push(grant);
        else expired.push(grant);
      }
    }

    return [active, expired] as const;
  }, [grants, selectedCategory, nowMs]);
  const activeGrantEmails = useMemo(
    () => new Set(activeSelectedGrants.map((grant) => grant.email.toLowerCase())),
    [activeSelectedGrants]
  );

  const selectCategory = useCallback((category: string) => {
    // The grant form and the access list reset themselves through `key`.
    setSelectedCategory(category);
    setResult(null);
  }, []);

  const handleGrant = useCallback(async (formData: FormData) => {
    setResult(null);

    // `grantSectionAccess` calls `refresh()` on the server: the rebuilt grant
    // list is part of this response, so no second request is needed.
    const response = await grantSectionAccess(formData);
    setResult(response.success ? { ...response, message: 'Section access saved.' } : response);

    return Boolean(response.success);
  }, []);

  const handleRevoke = useCallback(async (grant: SectionAccessGrant) => {
    setResult(null);

    const response = await revokeSectionAccess(grant.id);
    setResult(response.success ? { ...response, message: 'Section access removed.' } : response);
  }, []);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-emerald-600">
            <KeyRound className="h-4 w-4" />
            Course access
          </div>
          <h3 className="text-2xl font-semibold tracking-tight text-slate-900">Section access by email</h3>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-relaxed text-slate-500">
            Grant a student access to every paid test in a section. New tests added to that section are included automatically.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-medium uppercase tracking-widest text-emerald-700">
          <FolderKanban className="h-4 w-4" />
          {collections.length} sections
        </span>
      </div>

      <div className="mb-8">
        <div className="mb-4 flex items-center gap-3">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-medium text-white">
            1
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-900">Choose a section</p>
            <p className="text-xs font-medium text-slate-400">The grant form and access list will open for that section only.</p>
          </div>
        </div>

        <SectionPicker
          collections={collections}
          activeCountByCategory={activeCountByCategory}
          selectedCategory={selectedCategory}
          onSelect={selectCategory}
        />
      </div>

      {selectedCategory && selectedCollection && (
        <GrantForm
          key={selectedCategory}
          category={selectedCategory}
          collectionLabel={selectedCollection.label}
          users={users}
          activeGrantEmails={activeGrantEmails}
          activeCount={activeSelectedGrants.length}
          onGrant={handleGrant}
        />
      )}

      {selectedCategory && selectedCollection ? (
        <>
          <GrantList
            key={selectedCategory}
            collectionLabel={selectedCollection.label}
            activeGrants={activeSelectedGrants}
            expiredGrants={expiredSelectedGrants}
            onRevoke={handleRevoke}
            nowMs={nowMs}
          />

          {result?.success && (
            <div className="mt-5 flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
              {result.message || 'Section access updated.'}
            </div>
          )}

          {result?.error && (
            <div className="mt-5 flex items-center gap-2 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
              <AlertCircle className="h-5 w-5" />
              {result.error}
            </div>
          )}
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
          <FolderKanban className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm font-semibold text-slate-600">Choose a section to manage access</p>
          <p className="mt-1 text-xs font-medium text-slate-400">Access records from different sections will no longer be mixed.</p>
        </div>
      )}
    </section>
  );
}
