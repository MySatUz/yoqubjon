import type { Prisma } from '@prisma/client';
import { CheckCircle2, Clock3, ExternalLink, FileText, XCircle } from 'lucide-react';
import {
  approveManualPaymentRequest,
  rejectManualPaymentRequest,
} from '@/app/admin/manual-payment-actions';

type ManualPaymentRequestItem = Prisma.ManualPaymentRequestGetPayload<{
  include: {
    user: {
      select: {
        email: true;
        name: true;
      };
    };
  };
}> & {
  receiptSignedUrl: string | null;
};

type ManualPaymentRequestsProps = {
  requests: ManualPaymentRequestItem[];
};

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

export default function ManualPaymentRequests({ requests }: ManualPaymentRequestsProps) {
  return (
    <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.25em] text-blue-600">
            Payments
          </p>
          <h2 className="text-2xl font-black text-slate-900">Manual payment requests</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Review receipts, approve access, or reject incorrect transfers.
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
        <div className="space-y-4">
          {requests.map((request) => {
            const meta = statusMeta(request.status);
            const Icon = meta.icon;
            const isPending = request.status === 'PENDING';

            return (
              <article key={request.id} className="rounded-2xl border border-slate-200 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-black ${meta.className}`}>
                        <Icon className="h-4 w-4" />
                        {meta.label}
                      </span>
                      <span className="text-xs font-bold text-slate-400">
                        {new Date(request.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <h3 className="text-lg font-black text-slate-900">
                      {request.user.name || 'User'} · {formatAmount(request.amount, request.currency)}
                    </h3>
                    <p className="text-sm font-bold text-slate-500">{request.user.email}</p>
                  </div>

                  <div className="text-right text-xs font-bold text-slate-400">
                    <p>ID</p>
                    <p className="max-w-[180px] truncate text-slate-600">{request.id}</p>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Contact</p>
                    <p className="mt-1 font-bold text-slate-700">{request.contact || 'Not provided'}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Payment note</p>
                    <p className="mt-1 font-bold text-slate-700">{request.paymentReference || 'Not provided'}</p>
                  </div>
                </div>

                {request.message && (
                  <p className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-600">
                    {request.message}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {request.receiptSignedUrl ? (
                    <a
                      href={request.receiptSignedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white transition hover:bg-blue-600"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open receipt
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-400">
                      <FileText className="h-4 w-4" />
                      Receipt unavailable
                    </span>
                  )}
                  {request.receiptFileName && (
                    <span className="max-w-full truncate text-xs font-bold text-slate-400">
                      {request.receiptFileName}
                    </span>
                  )}
                </div>

                {request.adminNote && (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-600">
                    Admin note: {request.adminNote}
                  </div>
                )}

                {isPending && (
                  <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2">
                    <form action={approveManualPaymentRequest} className="space-y-3 rounded-2xl bg-green-50 p-4">
                      <input type="hidden" name="requestId" value={request.id} />
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
                      <input type="hidden" name="requestId" value={request.id} />
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
            );
          })}
        </div>
      )}
    </section>
  );
}
