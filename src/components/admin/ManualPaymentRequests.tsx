'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, Clock3, ExternalLink, FileText, UserRound, XCircle } from 'lucide-react';
import {
  approveManualPaymentRequest,
  rejectManualPaymentRequest,
} from '@/app/admin/manual-payment-actions';

type DateValue = Date | string;

type ManualPaymentRequestItem = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  payerName: string | null;
  contact: string | null;
  paymentReference: string | null;
  receiptFileName: string | null;
  message: string | null;
  adminNote: string | null;
  reviewedAt: DateValue | null;
  createdAt: DateValue;
  user: {
    email: string;
    name: string | null;
  };
  receiptSignedUrl: string | null;
};

type ManualPaymentRequestsProps = {
  requests: ManualPaymentRequestItem[];
};

function toDate(value: DateValue) {
  return value instanceof Date ? value : new Date(value);
}

function statusMeta(status: string) {
  if (status === 'APPROVED') {
    return {
      icon: CheckCircle2,
      label: 'Approved',
      className: 'bg-green-50 text-green-700 border-green-200',
    };
  }

  if (status === 'REJECTED') {
    return {
      icon: XCircle,
      label: 'Rejected',
      className: 'bg-red-50 text-red-700 border-red-200',
    };
  }

  return {
    icon: Clock3,
    label: 'Pending',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  };
}

function formatAmount(amount: number, currency: string) {
  return `${amount.toLocaleString('en-US').replace(/,/g, ' ')} ${currency}`;
}

function monthKey(value: DateValue) {
  const date = toDate(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(value: DateValue) {
  return toDate(value).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

export default function ManualPaymentRequests({ requests }: ManualPaymentRequestsProps) {
  const groups = useMemo(() => {
    const grouped = new Map<string, { label: string; requests: ManualPaymentRequestItem[] }>();

    for (const request of requests) {
      const key = monthKey(request.createdAt);
      if (!grouped.has(key)) {
        grouped.set(key, { label: monthLabel(request.createdAt), requests: [] });
      }
      grouped.get(key)?.requests.push(request);
    }

    return Array.from(grouped.entries()).map(([key, value]) => ({ key, ...value }));
  }, [requests]);

  const [activeMonth, setActiveMonth] = useState(groups[0]?.key || '');
  const activeGroup = groups.find((group) => group.key === activeMonth) || groups[0];
  const [selectedId, setSelectedId] = useState<string | null>(activeGroup?.requests[0]?.id || null);
  const selectedRequest =
    activeGroup?.requests.find((request) => request.id === selectedId) ||
    activeGroup?.requests[0] ||
    null;

  function chooseMonth(key: string) {
    const group = groups.find((item) => item.key === key);
    setActiveMonth(key);
    setSelectedId(group?.requests[0]?.id || null);
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.25em] text-blue-600">
            Payments
          </p>
          <h2 className="text-2xl font-black text-slate-900">Manual payment requests</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Choose a month, scan request status, then open a user for receipt details.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">
          {requests.length}
        </span>
      </div>

      {requests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm font-bold text-slate-400">
          No manual payment requests yet.
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {groups.map((group) => {
              const pending = group.requests.filter((request) => request.status === 'PENDING').length;
              const isActive = group.key === activeGroup?.key;

              return (
                <button
                  key={group.key}
                  type="button"
                  onClick={() => chooseMonth(group.key)}
                  className={`shrink-0 rounded-2xl border px-4 py-3 text-left transition ${
                    isActive
                      ? 'border-slate-900 bg-slate-900 text-white shadow-lg shadow-slate-200'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-200 hover:bg-white'
                  }`}
                >
                  <span className="block text-sm font-black">{group.label}</span>
                  <span className={`mt-1 block text-xs font-bold ${isActive ? 'text-slate-300' : 'text-slate-400'}`}>
                    {group.requests.length} requests{pending ? `, ${pending} pending` : ''}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="grid gap-5 lg:grid-cols-[0.86fr_1.14fr]">
            <div className="space-y-3">
              {activeGroup?.requests.map((request) => {
                const meta = statusMeta(request.status);
                const Icon = meta.icon;
                const isSelected = selectedRequest?.id === request.id;

                return (
                  <button
                    key={request.id}
                    type="button"
                    onClick={() => setSelectedId(request.id)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      isSelected
                        ? 'border-blue-300 bg-blue-50 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-black ${meta.className}`}>
                        <Icon className="h-4 w-4" />
                        {meta.label}
                      </span>
                      <span className="text-xs font-bold text-slate-400">
                        {toDate(request.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <h3 className="truncate text-lg font-black text-slate-900">
                      {request.user.name || request.payerName || 'User'} · {formatAmount(request.amount, request.currency)}
                    </h3>
                    <p className="truncate text-sm font-bold text-slate-500">{request.user.email}</p>
                  </button>
                );
              })}
            </div>

            {selectedRequest && (
              <article className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-500 shadow-sm">
                      <UserRound className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="text-xl font-black text-slate-900">
                        {selectedRequest.user.name || selectedRequest.payerName || 'User'}
                      </h3>
                      <p className="text-sm font-bold text-slate-500">{selectedRequest.user.email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Amount</p>
                    <p className="text-xl font-black text-slate-900">
                      {formatAmount(selectedRequest.amount, selectedRequest.currency)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  <div className="rounded-2xl bg-white p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Contact</p>
                    <p className="mt-1 font-bold text-slate-700">{selectedRequest.contact || 'Not provided'}</p>
                  </div>
                  <div className="rounded-2xl bg-white p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Payment note</p>
                    <p className="mt-1 font-bold text-slate-700">{selectedRequest.paymentReference || 'Not provided'}</p>
                  </div>
                </div>

                {selectedRequest.message && (
                  <p className="mt-3 rounded-2xl bg-white p-4 text-sm font-bold text-slate-600">
                    {selectedRequest.message}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {selectedRequest.receiptSignedUrl ? (
                    <a
                      href={selectedRequest.receiptSignedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white transition hover:bg-blue-600"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open receipt
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-black text-slate-400">
                      <FileText className="h-4 w-4" />
                      Receipt unavailable
                    </span>
                  )}
                  {selectedRequest.receiptFileName && (
                    <span className="max-w-full truncate text-xs font-bold text-slate-400">
                      {selectedRequest.receiptFileName}
                    </span>
                  )}
                </div>

                {selectedRequest.adminNote && (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-600">
                    Admin note: {selectedRequest.adminNote}
                  </div>
                )}

                {selectedRequest.status === 'PENDING' && (
                  <div className="mt-5 grid grid-cols-1 gap-3 xl:grid-cols-2">
                    <form action={approveManualPaymentRequest} className="space-y-3 rounded-2xl bg-green-50 p-4">
                      <input type="hidden" name="requestId" value={selectedRequest.id} />
                      <textarea
                        name="adminNote"
                        rows={2}
                        placeholder="Optional note"
                        className="w-full resize-none rounded-xl border border-green-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-green-500"
                      />
                      <button className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-sm font-black text-white transition hover:bg-green-500">
                        <CheckCircle2 className="h-4 w-4" />
                        Approve and activate
                      </button>
                    </form>

                    <form action={rejectManualPaymentRequest} className="space-y-3 rounded-2xl bg-red-50 p-4">
                      <input type="hidden" name="requestId" value={selectedRequest.id} />
                      <textarea
                        name="adminNote"
                        rows={2}
                        placeholder="Reason for rejection"
                        className="w-full resize-none rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-red-500"
                      />
                      <button className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-black text-white transition hover:bg-red-500">
                        <XCircle className="h-4 w-4" />
                        Reject
                      </button>
                    </form>
                  </div>
                )}
              </article>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
