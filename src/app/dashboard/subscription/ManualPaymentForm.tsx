'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Copy,
  FileUp,
  Loader2,
  Send,
  XCircle,
} from 'lucide-react';

type ManualRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | string;

type ManualRequest = {
  id: string;
  status: ManualRequestStatus;
  amount: number;
  currency: string;
  receiptFileName: string | null;
  adminNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

type ManualPaymentFormProps = {
  userName: string;
  userEmail: string;
  isPremium: boolean;
  requests: ManualRequest[];
  transfer: {
    cardHolder: string;
    cardNumber: string;
    cardType: string;
    amount: number;
    currency: string;
  };
  amountLabel: string;
};

function statusMeta(status: ManualRequestStatus) {
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
    label: 'Pending review',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  };
}

export function ManualPaymentForm({
  userName,
  userEmail,
  isPremium,
  requests,
  transfer,
  amountLabel,
}: ManualPaymentFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function copyCardNumber() {
    await navigator.clipboard.writeText(transfer.cardNumber.replace(/\s+/g, ''));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  async function submitRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/payments/manual/request', {
        method: 'POST',
        body: new FormData(event.currentTarget),
      });
      const data = await response.json().catch(() => null) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(data?.error || 'Could not submit payment request');
      }

      formRef.current?.reset();
      setSuccess('Request sent. Admin will review your receipt soon.');
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Could not submit payment request'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[0.95fr_1.05fr]">
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.25em] text-blue-600">
              Manual transfer
            </p>
            <h2 className="text-2xl font-black text-slate-900">Pay by card transfer</h2>
            <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500">
              Transfer the monthly subscription amount, upload the receipt, and wait for admin approval.
            </p>
          </div>
          <div className="rounded-2xl bg-slate-900 px-4 py-3 text-right text-white">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Amount</p>
            <p className="text-xl font-black">{amountLabel}</p>
          </div>
        </div>

        <div className="space-y-4 rounded-3xl bg-slate-50 p-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Card number</p>
            <button
              type="button"
              onClick={copyCardNumber}
              className="mt-1 flex w-full items-center justify-between gap-3 rounded-2xl bg-white px-4 py-4 text-left text-2xl font-black tracking-wide text-slate-900 shadow-sm transition hover:text-blue-600"
            >
              <span>{transfer.cardNumber}</span>
              <Copy className="h-5 w-5 shrink-0" />
            </button>
            {copied && (
              <p className="mt-2 text-xs font-bold text-green-600">Card number copied</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Recipient</p>
              <p className="mt-1 text-sm font-black text-slate-900">{transfer.cardHolder}</p>
            </div>
            <div className="rounded-2xl bg-white p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Card type</p>
              <p className="mt-1 text-sm font-black text-slate-900">{transfer.cardType}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6">
          <h2 className="text-2xl font-black text-slate-900">Send receipt</h2>
          <p className="mt-2 text-sm font-medium text-slate-500">
            Status changes will appear below after admin review.
          </p>
        </div>

        {isPremium ? (
          <div className="rounded-3xl border border-green-200 bg-green-50 p-6 text-green-800">
            <CheckCircle2 className="mb-3 h-8 w-8" />
            <h3 className="text-lg font-black">Subscription active</h3>
            <p className="mt-1 text-sm font-bold">You already have premium access.</p>
          </div>
        ) : (
          <form ref={formRef} onSubmit={submitRequest} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs font-black uppercase tracking-widest text-slate-400">Name</span>
                <input
                  name="payerName"
                  defaultValue={userName}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-500"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs font-black uppercase tracking-widest text-slate-400">Email</span>
                <input
                  value={userEmail}
                  disabled
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-500"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs font-black uppercase tracking-widest text-slate-400">Telegram / phone</span>
                <input
                  name="contact"
                  placeholder="@username or +998..."
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-500"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs font-black uppercase tracking-widest text-slate-400">Payment note</span>
                <input
                  name="paymentReference"
                  placeholder="Transaction ID or comment"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-500"
                />
              </label>
            </div>

            <label className="block space-y-2">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">Receipt file</span>
              <div className="flex items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
                <FileUp className="h-5 w-5 text-blue-600" />
                <input
                  name="receipt"
                  type="file"
                  required
                  accept="image/png,image/jpeg,image/webp,application/pdf"
                  className="w-full text-sm font-bold text-slate-600 file:mr-4 file:rounded-xl file:border-0 file:bg-white file:px-4 file:py-2 file:text-xs file:font-black file:text-slate-700"
                />
              </div>
              <span className="text-xs font-bold text-slate-400">PNG, JPG, WebP, or PDF up to 10 MB.</span>
            </label>

            <label className="block space-y-2">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">Message</span>
              <textarea
                name="message"
                rows={3}
                placeholder="Optional message for admin"
                className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-500"
              />
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 text-sm font-black text-white shadow-xl shadow-blue-100 transition hover:bg-blue-500 active:scale-95 disabled:cursor-wait disabled:bg-blue-400"
            >
              {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              {isSubmitting ? 'Sending request' : 'Send payment request'}
            </button>

            {success && (
              <p className="flex items-center gap-2 rounded-2xl bg-green-50 px-4 py-3 text-sm font-bold text-green-700">
                <CheckCircle2 className="h-4 w-4" />
                {success}
              </p>
            )}
            {error && (
              <p className="flex items-center gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                <AlertCircle className="h-4 w-4" />
                {error}
              </p>
            )}
          </form>
        )}

        <div className="mt-8 space-y-3">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">
            Recent requests
          </h3>
          {requests.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-5 text-sm font-bold text-slate-400">
              No payment requests yet.
            </div>
          ) : (
            requests.map((request) => {
              const meta = statusMeta(request.status);
              const Icon = meta.icon;

              return (
                <div key={request.id} className="rounded-2xl border border-slate-200 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-slate-900">
                        {request.amount.toLocaleString('en-US').replace(/,/g, ' ')} {request.currency}
                      </p>
                      <p className="text-xs font-bold text-slate-400">
                        {new Date(request.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-black ${meta.className}`}>
                      <Icon className="h-4 w-4" />
                      {meta.label}
                    </span>
                  </div>
                  {request.receiptFileName && (
                    <p className="mt-3 truncate text-xs font-bold text-slate-500">
                      Receipt: {request.receiptFileName}
                    </p>
                  )}
                  {request.adminNote && (
                    <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">
                      Admin note: {request.adminNote}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
