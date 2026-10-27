'use client';

import React, { useState } from 'react';
import { grantAdminRole, revokeAdminRole } from '@/app/admin/admin-user-actions';
import { Loader2, Search, ShieldMinus, ShieldPlus } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useConfirm } from '@/components/ui/Dialog';
import { inputClass } from '@/components/ui/Field';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Feedback';
import { listRowClass } from '@/components/ui/List';

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

/**
 * The owner's card for giving and removing admin access. It used to carry
 * a toggle that showed or hid the user directory below it; the Users page now
 * leads with the directory and puts this card under it.
 */
export default function AdminUsersPanel({ users, ownerEmail }: AdminUsersPanelProps) {
  const [grantResult, setGrantResult] = useState<ActionResult>(null);
  const [busyEmail, setBusyEmail] = useState<string | null>(null);
  const [emailQuery, setEmailQuery] = useState('');
  const { confirm, dialog } = useConfirm();
  const normalizedQuery = emailQuery.trim().toLowerCase();
  const visibleUsers = users.filter((user) => user.role === 'ADMIN' || user.email.toLowerCase() === ownerEmail);
  // Closed once the field holds exactly the address that was picked: the list
  // would otherwise stay open over the button, offering the same one user.
  const isQueryPicked = users.some((user) => user.email.toLowerCase() === normalizedQuery);
  const suggestedUsers = normalizedQuery.length >= 2 && !isQueryPicked
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

  async function handleRevoke(user: AdminUser) {
    const { email } = user;
    const isSure = await confirm({
      title: `Remove admin access for ${user.name || email}?`,
      description: `${email} can no longer open the admin pages. The account and its results stay; you can give admin access again later.`,
      confirmLabel: 'Remove admin',
      tone: 'danger',
    });
    if (!isSure) return;

    const formData = new FormData();
    formData.set('email', email);
    setGrantResult(null);
    setBusyEmail(email);
    const result = await revokeAdminRole(formData);
    setGrantResult(result);
    setBusyEmail(null);
  }

  return (
    <Card as="section">
      <CardHeader
        title="Admin access"
        description="Admins manage courses, tests, users and payments. Only the owner can give or remove admin access."
      />

      <CardBody className="space-y-4">
        <form action={handleGrant} className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              name="email"
              type="email"
              required
              value={emailQuery}
              onChange={(event) => setEmailQuery(event.target.value)}
              placeholder="Search by email or name"
              aria-label="Email of the user to make admin"
              autoComplete="off"
              className={inputClass({ className: 'pl-9' })}
            />

            {suggestedUsers.length > 0 && (
              <div className="absolute inset-x-0 top-full z-20 mt-1 rounded-2xl border border-gray-200 bg-white p-1 shadow-lg">
                {suggestedUsers.map((user) => {
                  const isOwner = user.email.toLowerCase() === ownerEmail;
                  const isAdmin = user.role === 'ADMIN' || isOwner;

                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => setEmailQuery(user.email)}
                      className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-gray-50 focus-visible:bg-gray-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink-600"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-gray-900">{user.name || user.email}</span>
                        <span className="block truncate text-xs text-gray-500">{user.email}</span>
                      </span>
                      {isAdmin && <Badge tone="accent">{isOwner ? 'Owner' : 'Admin'}</Badge>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <Button type="submit" disabled={busyEmail !== null || !emailQuery.trim()}>
            <ShieldPlus className="h-4 w-4" />
            Make admin
          </Button>
        </form>

        {grantResult?.success && <Alert tone="success">Admin access updated.</Alert>}

        {grantResult?.error && <Alert tone="danger">{grantResult.error}</Alert>}
      </CardBody>

      <ul className="divide-y divide-gray-100 border-t border-gray-100">
        {visibleUsers.map((user) => {
          const isOwner = user.email.toLowerCase() === ownerEmail;
          return (
            <li key={user.id} className={listRowClass}>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="min-w-0 truncate text-sm font-medium text-gray-900">{user.name || user.email}</span>
                  {/* Only admins and the owner are listed here. */}
                  <Badge tone="accent">{isOwner ? 'Owner' : 'Admin'}</Badge>
                </div>
                {user.name && <p className="mt-0.5 truncate text-xs text-gray-500">{user.email}</p>}
              </div>

              {/* Outlined like the other row actions, red only on hover and focus. */}
              {user.role === 'ADMIN' && !isOwner && (
                <Button
                  variant="danger-secondary"
                  size="sm"
                  onClick={() => handleRevoke(user)}
                  disabled={busyEmail === user.email}
                  aria-label={`Remove admin access for ${user.name || user.email}`}
                >
                  {busyEmail === user.email
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <ShieldMinus className="h-4 w-4" />}
                  Remove admin
                </Button>
              )}
            </li>
          );
        })}

        {visibleUsers.length === 0 && (
          <li className="px-5 py-6 text-center text-sm text-gray-500">
            No admins yet. Search for a user above to give admin access.
          </li>
        )}
      </ul>
      {dialog}
    </Card>
  );
}
