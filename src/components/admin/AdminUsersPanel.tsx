'use client';

import React, { useState } from 'react';
import { grantAdminRole, revokeAdminRole } from '@/app/admin/admin-user-actions';
import { AlertCircle, CheckCircle2, Search, Shield, ShieldMinus, ShieldPlus } from 'lucide-react';

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: 'USER' | 'ADMIN';
}

interface AdminUsersPanelProps {
  users: AdminUser[];
  ownerEmail: string;
}

type ActionResult = { success?: boolean; error?: string } | null;

export default function AdminUsersPanel({ users, ownerEmail }: AdminUsersPanelProps) {
  const [grantResult, setGrantResult] = useState<ActionResult>(null);
  const [busyEmail, setBusyEmail] = useState<string | null>(null);
  const [emailQuery, setEmailQuery] = useState('');
  const normalizedQuery = emailQuery.trim().toLowerCase();
  const visibleUsers = users.filter((user) => user.role === 'ADMIN' || user.email.toLowerCase() === ownerEmail);
  const suggestedUsers = normalizedQuery.length >= 2
    ? users
        .filter((user) => {
          const email = user.email.toLowerCase();
          const name = user.name?.toLowerCase() || '';
          return email.includes(normalizedQuery) || name.includes(normalizedQuery);
        })
        .slice(0, 8)
    : [];

  async function handleGrant(formData: FormData) {
    setGrantResult(null);
    const email = String(formData.get('email') || '').trim().toLowerCase();
    if (!email) return;

    setBusyEmail(email);
    const result = await grantAdminRole(formData);
    setGrantResult(result);
    setBusyEmail(null);
    if (result.success) setEmailQuery('');
  }

  async function handleRevoke(email: string) {
    if (!confirm(`Remove admin access for ${email}?`)) return;

    const formData = new FormData();
    formData.set('email', email);
    setGrantResult(null);
    setBusyEmail(email);
    const result = await revokeAdminRole(formData);
    setGrantResult(result);
    setBusyEmail(null);
  }

  return (
    <section className="mb-10 rounded-3xl border border-blue-100 bg-white p-8 shadow-xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-blue-600">
            <Shield className="h-4 w-4" />
            Owner controls
          </div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900">Admin access</h2>
        </div>
      </div>

      <form action={handleGrant} className="mb-6 grid gap-3 md:grid-cols-[1fr_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            name="email"
            type="email"
            required
            value={emailQuery}
            onChange={(event) => setEmailQuery(event.target.value)}
            placeholder="Search by email or name"
            autoComplete="off"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-4 pl-12 pr-5 font-bold text-slate-900 transition-all focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
          />

          {suggestedUsers.length > 0 && (
            <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-200">
              {suggestedUsers.map((user) => {
                const isOwner = user.email.toLowerCase() === ownerEmail;
                const isAdmin = user.role === 'ADMIN' || isOwner;

                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => setEmailQuery(user.email)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-blue-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-black text-slate-900">{user.name || user.email}</span>
                      <span className="block truncate text-xs font-bold text-slate-500">{user.email}</span>
                    </span>
                    {isAdmin && (
                      <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-black uppercase text-blue-700">
                        {isOwner ? 'Owner' : 'Admin'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <button
          type="submit"
          disabled={busyEmail !== null || !emailQuery.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-4 font-black text-white shadow-lg shadow-blue-100 transition-all hover:bg-blue-700 disabled:opacity-50"
        >
          <ShieldPlus className="h-5 w-5" />
          Make admin
        </button>
      </form>

      {grantResult?.success && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl border border-green-100 bg-green-50 p-4 font-bold text-green-700">
          <CheckCircle2 className="h-5 w-5" />
          Admin access updated.
        </div>
      )}

      {grantResult?.error && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl border border-red-100 bg-red-50 p-4 font-bold text-red-700">
          <AlertCircle className="h-5 w-5" />
          {grantResult.error}
        </div>
      )}

      <div className="grid gap-3">
        {visibleUsers.map((user) => {
          const isOwner = user.email.toLowerCase() === ownerEmail;
          return (
            <div key={user.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-black text-slate-900">{user.name || user.email}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${user.role === 'ADMIN' || isOwner ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-600'}`}>
                    {isOwner ? 'Owner' : user.role}
                  </span>
                </div>
                <p className="text-sm font-bold text-slate-500">{user.email}</p>
              </div>

              {user.role === 'ADMIN' && !isOwner && (
                <button
                  type="button"
                  onClick={() => handleRevoke(user.email)}
                  disabled={busyEmail === user.email}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-100 bg-white px-4 py-3 text-sm font-black text-red-600 transition-all hover:bg-red-50 disabled:opacity-50"
                >
                  <ShieldMinus className="h-4 w-4" />
                  Remove admin
                </button>
              )}
            </div>
          );
        })}

        {visibleUsers.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm font-bold text-slate-400">
            No admins yet. Search for a registered user above to grant access.
          </div>
        )}
      </div>
    </section>
  );
}
