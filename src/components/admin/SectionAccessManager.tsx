'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
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
};

type ActionResult = { success?: boolean; error?: string; message?: string } | null;

function formatDate(value: DateValue) {
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function todayInputValue() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

export default function SectionAccessManager({ collections, grants }: SectionAccessManagerProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<ActionResult>(null);
  const [isGranting, setIsGranting] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const collectionMap = useMemo(() => new Map(
    collections.map((collection) => [collection.value, collection])
  ), [collections]);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredGrants = useMemo(() => {
    if (!normalizedQuery) return grants;

    return grants.filter((grant) => {
      const collection = collectionMap.get(grant.category);
      const userName = grant.user?.name?.toLowerCase() || '';
      return grant.email.toLowerCase().includes(normalizedQuery) ||
        userName.includes(normalizedQuery) ||
        grant.category.toLowerCase().includes(normalizedQuery) ||
        collection?.label.toLowerCase().includes(normalizedQuery);
    });
  }, [collectionMap, grants, normalizedQuery]);
  const activeGrantCount = grants.filter((grant) => (
    !grant.expiresAt || new Date(grant.expiresAt) > new Date()
  )).length;

  async function handleGrant(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsGranting(true);
    setResult(null);

    const form = event.currentTarget;
    const response = await grantSectionAccess(new FormData(form));
    setResult(response.success ? { ...response, message: 'Section access saved.' } : response);
    setIsGranting(false);

    if (response.success) {
      form.reset();
      router.refresh();
    }
  }

  async function handleRevoke(grant: SectionAccessGrant) {
    const collection = collectionMap.get(grant.category);
    if (!confirm(`Remove access for ${grant.email} to ${collection?.label || grant.category}?`)) return;

    setRevokingId(grant.id);
    setResult(null);
    const response = await revokeSectionAccess(grant.id);
    setResult(response.success ? { ...response, message: 'Section access removed.' } : response);
    setRevokingId(null);

    if (response.success) {
      router.refresh();
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-emerald-600">
            <KeyRound className="h-4 w-4" />
            Course access
          </div>
          <h3 className="text-2xl font-black tracking-tight text-slate-900">Section access by email</h3>
          <p className="mt-2 max-w-2xl text-sm font-bold leading-relaxed text-slate-500">
            Grant a student access to every paid test in a section. New tests added to that section are included automatically.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-black uppercase tracking-widest text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
          {activeGrantCount} active
        </span>
      </div>

      <form onSubmit={handleGrant} className="mb-8 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 xl:grid-cols-[1fr_0.8fr_0.6fr_1fr_auto]">
        <input
          name="email"
          type="email"
          required
          placeholder="student@email.com"
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
        />
        <select
          name="category"
          required
          defaultValue={collections[0]?.value || ''}
          disabled={collections.length === 0}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
        >
          {collections.map((collection) => (
            <option key={collection.value} value={collection.value}>
              {collection.label}
            </option>
          ))}
        </select>
        <input
          name="expiresAt"
          type="date"
          min={todayInputValue()}
          title="Optional expiration date"
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
        />
        <input
          name="note"
          maxLength={300}
          placeholder="Note, e.g. paid cash"
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
        />
        <button
          type="submit"
          disabled={isGranting || collections.length === 0}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-100 transition hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60"
        >
          {isGranting ? <Loader2 className="h-5 w-5 animate-spin" /> : <KeyRound className="h-5 w-5" />}
          Grant
        </button>
      </form>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="text-xs font-black uppercase tracking-widest text-slate-400">
          {filteredGrants.length} shown / {grants.length} total
        </div>
        <div className="relative w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search access"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-bold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
          />
        </div>
      </div>

      <div className="max-h-[30rem] space-y-3 overflow-y-auto pr-2">
        {filteredGrants.map((grant) => {
          const collection = collectionMap.get(grant.category);
          const isExpired = Boolean(grant.expiresAt && new Date(grant.expiresAt) <= new Date());

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
                    <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-700">
                      {collection?.label || grant.category}
                    </span>
                    <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${
                      isExpired ? 'bg-slate-200 text-slate-500' : 'bg-emerald-600 text-white'
                    }`}>
                      {isExpired ? 'Expired' : 'Active'}
                    </span>
                  </div>
                  <p className="flex min-w-0 items-center gap-2 text-sm font-black text-slate-900">
                    <Mail className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="truncate">{grant.email}</span>
                  </p>
                  <p className="mt-1 flex min-w-0 items-center gap-2 text-xs font-bold text-slate-500">
                    <UserRound className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="truncate">
                      {grant.user?.name || grant.user?.email || 'Not registered yet'}
                    </span>
                  </p>
                </div>

                <div className="grid gap-2 text-xs font-bold text-slate-500 sm:grid-cols-2 xl:min-w-[28rem]">
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
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-100 bg-white px-4 py-3 text-xs font-black text-red-600 transition hover:bg-red-50 disabled:cursor-wait disabled:opacity-50"
                >
                  {revokingId === grant.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Revoke
                </button>
              </div>
            </article>
          );
        })}

        {filteredGrants.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm font-bold text-slate-400">
            No section access records yet.
          </div>
        )}
      </div>

      {result?.success && (
        <div className="mt-5 flex items-center gap-2 rounded-2xl border border-green-100 bg-green-50 p-4 text-sm font-bold text-green-700">
          <CheckCircle2 className="h-5 w-5" />
          {result.message || 'Section access updated.'}
        </div>
      )}

      {result?.error && (
        <div className="mt-5 flex items-center gap-2 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">
          <AlertCircle className="h-5 w-5" />
          {result.error}
        </div>
      )}
    </section>
  );
}
