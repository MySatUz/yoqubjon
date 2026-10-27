"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X } from 'lucide-react';
import { buttonClass, iconButtonClass } from '@/components/ui/Button';

export interface ConfirmOptions {
  title: React.ReactNode;
  description?: React.ReactNode;
  /**
   * Name it after what the press does ("Delete test"). The fallbacks are
   * "Continue" for a question and "Close" for a notice - never "OK", which
   * says nothing about what happens (AGENTS.md, "Words").
   */
  confirmLabel?: React.ReactNode;
  /** Defaults to "Cancel". `null` leaves one button: a notice to acknowledge, not a choice. */
  cancelLabel?: React.ReactNode | null;
  /** `danger` for an action that throws something away. */
  tone?: 'primary' | 'danger';
  /**
   * Which button holds focus when the dialog opens. Defaults to Cancel for a
   * `danger` dialog - Enter pressed out of habit must not discard anything -
   * and to the confirm button otherwise.
   */
  initialFocus?: 'confirm' | 'cancel';
}

interface ConfirmDialogProps extends ConfirmOptions {
  open: boolean;
  /** Both buttons and Escape wait, and the chosen button spins: the answer is being acted on. */
  busy?: boolean;
  /** Which answer is under way while `busy`: the spinner goes on that button. */
  busyButton?: 'confirm' | 'cancel';
  onConfirm: () => void;
  /** Cancel, Escape, and the one button of a notice when there is no Cancel. */
  onCancel: () => void;
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The app's replacement for `window.confirm()` and `alert()`: those block the
 * page's own clock, cannot be styled, and on a phone read as the browser
 * talking rather than the app.
 *
 * An `alertdialog` - it interrupts and wants an answer - so a press on the
 * scrim does nothing; Escape is the same as Cancel. Focus moves in, stays
 * inside while it is open, and goes back to whatever opened it. Rendered into
 * `document.body`, so no parent's `overflow` or stacking can clip it.
 */
export function ConfirmDialog({
  open,
  busy = false,
  busyButton = 'confirm',
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'primary',
  initialFocus,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  // The latest handler and focus target, so the listeners below are set up
  // once per opening rather than on every render of the caller.
  const onCancelRef = useRef(onCancel);
  const busyRef = useRef(busy);
  const focusTargetRef = useRef(initialFocus ?? (tone === 'danger' ? 'cancel' : 'confirm'));
  useEffect(() => {
    onCancelRef.current = onCancel;
    busyRef.current = busy;
    focusTargetRef.current = initialFocus ?? (tone === 'danger' ? 'cancel' : 'confirm');
  }, [busy, initialFocus, onCancel, tone]);

  useEffect(() => {
    if (!open) return;

    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    const first = focusTargetRef.current === 'cancel'
      ? cancelRef.current ?? confirmRef.current
      : confirmRef.current;
    first?.focus();

    const focusables = () => (panel ? [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)] : []);

    // Capture phase, and stopped there: an Escape meant for this dialog must
    // not also close the popover or the tool window underneath it.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        // An answer already under way is not taken back by Escape.
        if (!busyRef.current) onCancelRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const items = focusables();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };
    // Focus that leaves by any other road - a screen reader's cursor, a
    // click on the scrim - is brought back.
    const onFocusIn = (event: FocusEvent) => {
      if (panel && event.target instanceof Node && !panel.contains(event.target)) {
        focusables()[0]?.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('focusin', onFocusIn);
      // Not to an opener that went away with the decision (a screen that was
      // replaced): focus would land on nothing.
      if (opener?.isConnected) opener.focus();
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  const spinner = <Loader2 className="h-4 w-4 animate-spin" />;

  return createPortal(
    // The scrim is the one tint in the app: gray, never blurred - the same
    // light source as every other surface (see AGENTS.md, "Elevation"). It
    // scrolls, so a dialog taller than a phone held sideways is still whole.
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-gray-900/40"
      onMouseDown={(event) => {
        // Keeps focus on the dialog: a press outside it is not an answer.
        if (!panelRef.current?.contains(event.target as Node)) event.preventDefault();
      }}
    >
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          ref={panelRef}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descriptionId : undefined}
          aria-busy={busy || undefined}
          className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
        >
          <h2 id={titleId} className="text-base font-semibold break-words text-gray-900">
            {title}
          </h2>
          {description && (
            <div id={descriptionId} className="mt-2 space-y-2 text-sm break-words text-gray-600">
              {description}
            </div>
          )}

          {/* Stacked on a phone, with the answer on top where the thumb is. */}
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {cancelLabel !== null && (
              <button
                ref={cancelRef}
                type="button"
                onClick={onCancel}
                disabled={busy}
                className={buttonClass({ variant: 'secondary', className: 'max-sm:w-full' })}
              >
                {busy && busyButton === 'cancel' && spinner}
                {cancelLabel}
              </button>
            )}
            <button
              ref={confirmRef}
              type="button"
              onClick={cancelLabel === null ? onCancel : onConfirm}
              disabled={busy}
              className={buttonClass({
                variant: tone === 'danger' ? 'danger' : 'primary',
                className: 'max-sm:w-full',
              })}
            >
              {busy && (busyButton === 'confirm' || cancelLabel === null) && spinner}
              {confirmLabel ?? (cancelLabel === null ? 'Close' : 'Continue')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

const dialogWidths = { md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' } as const;

/**
 * A modal for a form or a task that takes more than one answer: New course,
 * Give access, choosing questions. Same construction as ConfirmDialog - in
 * `document.body`, focus moved in, kept in, and given back to the opener -
 * but a `dialog`, not an `alertdialog`: it is work the admin chose to open.
 *
 * Escape and the close button call `onClose` unless `busy` (an action is
 * under way and must not be abandoned half-sent); a press on the scrim does
 * nothing, so a long form is never lost to a stray click. `footer` holds the
 * actions, primary last; on a phone they stack with the primary on top.
 * `initialFocus` names an element inside by `data-autofocus`; without it the
 * first field or button takes focus.
 */
export function Dialog({
  open,
  title,
  description,
  size = 'md',
  busy = false,
  onClose,
  footer,
  children,
}: {
  open: boolean;
  title: React.ReactNode;
  description?: React.ReactNode;
  size?: keyof typeof dialogWidths;
  busy?: boolean;
  onClose: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const busyRef = useRef(busy);
  useEffect(() => {
    onCloseRef.current = onClose;
    busyRef.current = busy;
  }, [busy, onClose]);

  useEffect(() => {
    if (!open) return;

    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    const focusables = () => (panel ? [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)] : []);
    const preferred = panel?.querySelector<HTMLElement>('[data-autofocus]');
    (preferred ?? focusables().find((item) => item.dataset.dialogClose === undefined) ?? panel)?.focus();

    // A ConfirmDialog asked from inside this dialog ("Remove this question?")
    // is a second modal over it, in its own portal. Its keys and its focus are
    // its own: without this, Escape there closed the form underneath, and the
    // two focus traps pulled focus back and forth.
    const inOtherModal = (target: EventTarget | null) =>
      target instanceof Element && !panel?.contains(target) && target.closest('[aria-modal="true"]') !== null;

    const onKeyDown = (event: KeyboardEvent) => {
      if (inOtherModal(event.target)) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (!busyRef.current) onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const items = focusables();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };
    const onFocusIn = (event: FocusEvent) => {
      if (inOtherModal(event.target)) return;
      if (panel && event.target instanceof Node && !panel.contains(event.target)) {
        focusables()[0]?.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('focusin', onFocusIn);
      if (opener?.isConnected) opener.focus();
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-gray-900/40"
      onMouseDown={(event) => {
        if (!panelRef.current?.contains(event.target as Node)) event.preventDefault();
      }}
    >
      <div className="flex min-h-full items-start justify-center p-4 sm:items-center">
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descriptionId : undefined}
          aria-busy={busy || undefined}
          tabIndex={-1}
          className={`w-full ${dialogWidths[size]} rounded-2xl bg-white shadow-2xl focus:outline-hidden`}
        >
          <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4">
            <div className="min-w-0">
              <h2 id={titleId} className="text-base font-semibold break-words text-gray-900">
                {title}
              </h2>
              {description && (
                <p id={descriptionId} className="mt-0.5 text-sm break-words text-gray-600">
                  {description}
                </p>
              )}
            </div>
            <button
              type="button"
              data-dialog-close
              onClick={onClose}
              disabled={busy}
              aria-label="Close"
              className={iconButtonClass({ variant: 'secondary', size: 'sm' })}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="px-5 py-4">{children}</div>
          {footer && (
            <div className="flex flex-col-reverse gap-2 border-t border-gray-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-end">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * `await confirm({...})` instead of `window.confirm(...)`: resolves `true` on
 * the confirm button and `false` on Cancel or Escape. The caller renders
 * `dialog` once, anywhere in its tree.
 *
 * Asking again while a question is open answers the first one `false`, and so
 * does the caller going away: nothing waits on a dialog that is gone. A
 * question asked after the caller has gone - a send that answers late, once
 * the student has left the exam - is answered `false` at once, rather than
 * left waiting on a dialog nobody will ever see.
 */
export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const pendingRef = useRef<((ok: boolean) => void) | null>(null);
  const isMountedRef = useRef(false);

  const settle = useCallback((ok: boolean) => {
    const resolve = pendingRef.current;
    pendingRef.current = null;
    setOptions(null);
    resolve?.(ok);
  }, []);

  const confirm = useCallback((next: ConfirmOptions) => {
    pendingRef.current?.(false);
    pendingRef.current = null;
    if (!isMountedRef.current) return Promise.resolve(false);
    return new Promise<boolean>((resolve) => {
      pendingRef.current = resolve;
      setOptions(next);
    });
  }, []);

  /** Closes an open question as if it had been cancelled. */
  const dismiss = useCallback(() => settle(false), [settle]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      pendingRef.current?.(false);
      pendingRef.current = null;
    };
  }, []);

  const dialog = (
    <ConfirmDialog
      open={options !== null}
      {...(options ?? { title: '' })}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  );

  return { confirm, dismiss, dialog };
}
