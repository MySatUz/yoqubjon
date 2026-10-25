'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Copy, Loader2, Receipt, Send } from 'lucide-react';
import { formatDateTime } from '@/lib/formatDate';
import { TELEGRAM_URL } from '@/lib/landing/warmup';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button, focusRingClass, linkClass } from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { Alert, EmptyState } from '@/components/ui/Feedback';
import { KeyValue } from '@/components/ui/Misc';
import { List, RowText, listRowClass } from '@/components/ui/List';
import { SectionHeading } from '@/components/ui/Page';
import { PaymentStatusBadge } from '@/components/ui/PaymentStatusBadge';
import { cn } from '@/components/ui/cn';
import { PREMIUM_PLAN } from '@/lib/plans';

type ManualRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | string;

/** No amount: past requests are listed by date (no price outside the payment details). */
type ManualRequest = {
  id: string;
  status: ManualRequestStatus;
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
    /** The amount as formatManualPaymentAmount spells it: the one price the app shows. */
    amountLabel: string;
  };
};

/**
 * Styles the native file button like a secondary <Button size="sm">: keyed, a
 * mist-400 box whose bottom edge is mist-500, over shadow-xs (Button.tsx).
 * Tailwind's preflight already gives ::file-selector-button a solid zero-width
 * border, so `file:border` is enough to draw it.
 */
const fileInputClass =
  'block w-full rounded-lg text-sm text-mist-600 file:mr-3 file:h-8 file:cursor-pointer file:rounded-lg file:border ' +
  'file:border-mist-400 file:border-b-mist-500 file:bg-white file:px-3 file:text-sm file:font-medium file:text-mist-800 ' +
  'file:shadow-xs file:transition-colors hover:file:border-mist-500 hover:file:bg-mist-50 active:file:shadow-none ' +
  'pointer-coarse:file:h-10 ' +
  focusRingClass;

/**
 * Below MANUAL_RECEIPT_MAX_SIZE in lib/manual-payments.ts (10 MB, and a client
 * file cannot import it: it pulls in Prisma). Vercel refuses a request body
 * over 4.5 MB before the route runs, so "up to 10 MB" was a promise the host
 * broke for every phone photo between the two. 4 MB leaves room for the
 * form's other fields. Checked here so a large photo is refused before it is
 * uploaded, not after.
 */
const RECEIPT_MAX_BYTES = 4 * 1024 * 1024;
const RECEIPT_MAX_LABEL = '4 MB';

/** What the student reads when a request did not go through. */
type SubmitError = {
  text: string;
  /** Offer Telegram: the cause is on our side, not something the student can fix. */
  support: boolean;
};

const GENERIC_ERROR: SubmitError = { text: 'We could not send your request. Try again in a minute.', support: true };

export function ManualPaymentForm({
  userName,
  userEmail,
  isPremium,
  requests,
  transfer,
}: ManualPaymentFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<SubmitError | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const sentRef = useRef<HTMLDivElement>(null);
  // The route takes one request at a time (409 while one waits), and says so
  // only after the receipt is uploaded; the form is not offered meanwhile.
  const pendingRequest = requests.find((request) => request.status === 'PENDING');

  // The confirmation takes the form's place, and the button that was pressed
  // goes with it: focus follows, so it is read out and not dropped on the body.
  useEffect(() => {
    if (success) sentRef.current?.focus();
  }, [success]);

  async function copyCardNumber() {
    try {
      await navigator.clipboard.writeText(transfer.cardNumber.replace(/\s+/g, ''));
    } catch {
      // No clipboard (an insecure context, a denied permission): the number
      // is on screen to type, and "Copied" would be untrue.
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  async function submitRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const formData = new FormData(event.currentTarget);
    const receipt = formData.get('receipt');
    if (receipt instanceof File && receipt.size > RECEIPT_MAX_BYTES) {
      setError({ text: `The receipt file must be ${RECEIPT_MAX_LABEL} or smaller. Try a screenshot or a PDF.`, support: false });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/payments/manual/request', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json().catch(() => null) as { error?: string } | null;

      if (!response.ok) {
        // A 4xx carries a sentence written for the student (already pending,
        // too many requests). 503 is the one 5xx with a meaning: sales were
        // paused while this page was open. Any other 5xx can carry a storage
        // or database message, which stays in the server log. A 413 comes
        // from the host, before the route runs, so it has no sentence of its own.
        setError(
          response.status === 503
            ? { text: 'New Premium subscriptions were paused while this page was open, so the request was not sent.', support: false }
            : response.status === 413
              ? { text: 'The receipt file is too large to upload. Try a smaller photo or a PDF.', support: false }
              : response.status < 500 && data?.error
                ? { text: data.error, support: false }
                : GENERIC_ERROR
        );
        return;
      }

      // One confirmation, whatever happened to the admin's Telegram ping:
      // the request is saved and shows under Recent requests either way, and
      // how the server notifies the admin is not the student's concern.
      formRef.current?.reset();
      setSuccess('Request sent. An admin will check your receipt and switch Premium on.');
      router.refresh();
    } catch {
      // The fetch itself failed (offline, a dropped connection): its message
      // ("Failed to fetch") is the browser's, not a sentence for the student.
      setError(GENERIC_ERROR);
    } finally {
      setIsSubmitting(false);
    }
  }

  // Two columns on desktop: transfer details over the request history on the
  // left, the receipt form on the right spanning both rows. On phones the DOM
  // order applies: details, form, history.
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:grid-rows-[auto_1fr] lg:items-start">
      <Card className="lg:col-start-1 lg:row-start-1">
        <CardHeader
          title="Pay by card transfer"
          description="Transfer the monthly subscription amount, upload the receipt, and wait for admin approval."
        />
        <dl className="grid grid-cols-2 gap-4 p-5">
          <div className="col-span-2 min-w-0">
            <dt className="text-xs text-mist-500">Card number</dt>
            <dd className="mt-1">
              {/* Keyed like a secondary button (Button.tsx), not a grey inset:
                  the whole row copies, and it has to look pressable before it
                  is hovered. Raw classes: buttonClass centres and never wraps,
                  and this row spreads the number and "Copy" apart. */}
              <button
                type="button"
                onClick={copyCardNumber}
                className={cn(
                  'group flex h-10 w-full items-center justify-between gap-3 rounded-lg border border-mist-400 border-b-mist-500 bg-white px-3 text-left shadow-xs',
                  'transition-colors hover:border-mist-500 hover:bg-mist-50 active:bg-mist-100 active:shadow-none pointer-coarse:h-11',
                  focusRingClass,
                )}
              >
                <span className="truncate text-lg font-semibold tabular-nums tracking-wide text-mist-900">
                  {transfer.cardNumber}
                </span>
                <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-mist-700 transition-colors group-hover:text-mist-900">
                  {copied ? <Check className="h-4 w-4 text-lime-700" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copied' : 'Copy'}
                </span>
              </button>
              {/* The label inside a focused button changing is not announced. */}
              <span aria-live="polite" className="sr-only">
                {copied ? 'Card number copied' : ''}
              </span>
            </dd>
          </div>
          <KeyValue className="col-span-2" label="Recipient" value={transfer.cardHolder} />
          <KeyValue label="Card type" value={transfer.cardType} />
          <KeyValue label="Amount" value={<span className="tabular-nums">{transfer.amountLabel}</span>} />
        </dl>
      </Card>

      <Card className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
        <CardHeader
          title="Send receipt"
          description="An admin reviews every receipt. Its status appears under Recent requests."
        />
        <CardBody>
          {isPremium ? (
            <Alert tone="success" title="Subscription active">
              You already have {PREMIUM_PLAN.name}.
            </Alert>
          ) : success ? (
            <div ref={sentRef} tabIndex={-1} className="focus:outline-hidden">
              <Alert tone="success">{success}</Alert>
            </div>
          ) : pendingRequest ? (
            <Alert title="Your request is waiting for review">
              Sent {formatDateTime(pendingRequest.createdAt)}. You can send another one once an admin has checked it.
            </Alert>
          ) : (
            <form ref={formRef} onSubmit={submitRequest} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Name" htmlFor="manual-payment-name">
                  <Input id="manual-payment-name" name="payerName" defaultValue={userName} />
                </Field>
                <Field label="Email" htmlFor="manual-payment-email">
                  <Input id="manual-payment-email" value={userEmail} disabled />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Telegram or phone" htmlFor="manual-payment-contact">
                  <Input id="manual-payment-contact" name="contact" placeholder="@username or +998..." />
                </Field>
                <Field label="Payment note" htmlFor="manual-payment-reference">
                  <Input
                    id="manual-payment-reference"
                    name="paymentReference"
                    placeholder="Transaction ID or comment"
                  />
                </Field>
              </div>

              <Field label="Receipt file" htmlFor="manual-payment-receipt" hint={`PNG, JPG, WebP, or PDF up to ${RECEIPT_MAX_LABEL}.`}>
                <input
                  id="manual-payment-receipt"
                  name="receipt"
                  type="file"
                  required
                  accept="image/png,image/jpeg,image/webp,application/pdf"
                  className={fileInputClass}
                />
              </Field>

              <Field label="Message" htmlFor="manual-payment-message">
                <Textarea
                  id="manual-payment-message"
                  name="message"
                  rows={3}
                  placeholder="Optional message for admin"
                  className="resize-none"
                />
              </Field>

              <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {isSubmitting ? 'Sending request' : 'Send payment request'}
              </Button>

              {error && (
                <Alert tone="danger">
                  {error.text}
                  {error.support && (
                    <>
                      {' '}
                      <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
                        Message us in Telegram
                      </a>{' '}
                      if it keeps happening.
                    </>
                  )}
                </Alert>
              )}
            </form>
          )}
        </CardBody>
      </Card>

      <section className="space-y-3 lg:col-start-1 lg:row-start-2">
        <SectionHeading title="Recent requests" />
        {requests.length === 0 ? (
          <EmptyState icon={<Receipt />} title="No payment requests yet" description="A request you send appears here with its status." />
        ) : (
          <List>
            {requests.map((request) => (
              <li key={request.id} className={listRowClass}>
                <div className="min-w-0 flex-1">
                  <RowText
                    title={<span className="tabular-nums">{formatDateTime(request.createdAt)}</span>}
                    meta={request.receiptFileName ? `Receipt: ${request.receiptFileName}` : undefined}
                  />
                  {request.adminNote && (
                    <p className="mt-1.5 text-xs text-mist-600">Admin note: {request.adminNote}</p>
                  )}
                  {/* A declined receipt is the moment a student needs a person. */}
                  {request.status === 'REJECTED' && (
                    <p className="mt-1 text-xs text-mist-600">
                      Not sure why?{' '}
                      <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
                        Ask in Telegram
                      </a>
                    </p>
                  )}
                </div>
                {/* Level with the amount line, not centred against a long admin note.
                    self-start rather than a second items-* on the row: cn() does
                    not merge, so two align-items classes would fight. */}
                <span className="flex shrink-0 self-start">
                  <PaymentStatusBadge status={request.status} pendingLabel="Pending review" />
                </span>
              </li>
            ))}
          </List>
        )}
      </section>
    </div>
  );
}
