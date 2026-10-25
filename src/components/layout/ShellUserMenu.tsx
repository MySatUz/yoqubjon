'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { FocusEvent, KeyboardEvent } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, CircleHelp, Eye, LogOut, Undo2, User } from 'lucide-react';
import { enterStudentView, exitStudentView } from '@/app/admin/student-view-actions';
import { signOutAction } from '@/lib/shell-actions';
import { clearLocalExamData } from '@/components/exam/clearLocalExamData';
import { TELEGRAM_URL } from '@/lib/landing/warmup';
import { cn } from '@/components/ui/cn';
import { focusRingClass } from '@/components/ui/Button';
import { SidebarNotch } from '@/components/layout/ShellNav';
import { RailTooltip, sidebarFocusClass } from '@/components/layout/RailTooltip';

type ShellUserMenuProps = {
  name: string;
  email?: string | null;
  initial: string;
  /** Admins get "See the site as a student" — or "Exit student view" while in it. */
  isAdmin: boolean;
  inStudentView: boolean;
  variant: 'desktop' | 'mobile';
};

/* h-10: the items are tapped on phones as often as clicked. Icons take the
   item's own colour (AGENTS.md, "Icons": an icon in a button has no colour of
   its own). The focus outline is inset, so it is not clipped by the panel. */
const itemBase =
  'flex h-10 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm transition-colors ' +
  'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-board-600';
const itemClass = cn(itemBase, 'font-medium text-mist-700 hover:bg-mist-100 hover:text-mist-900');
const subItemClass = cn(itemBase, 'text-mist-700 hover:bg-mist-100 hover:text-mist-900');
const signOutClass = cn(itemBase, 'font-medium text-red-600 hover:bg-red-50 hover:text-red-700');

/** The panel's items in tab order, the ones the arrow keys move between. */
function panelItems(panel: HTMLElement | null) {
  return Array.from(panel?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? []);
}

/**
 * The user's own row (desktop sidebar) or avatar (mobile header). It opens a
 * small panel — Profile, Help, See the site as a student (admins), Sign out —
 * instead of a permanent Sign out row, the way most product UIs keep account
 * actions behind the account itself.
 *
 * A disclosure, not an ARIA menu: the panel holds links, forms and a nested
 * expander, which role="menu" cannot describe, and it promised arrow keys that
 * did nothing. The keyboard still gets what a menu button gives: opening moves
 * focus to the first item (ArrowUp on the trigger: the last), ArrowUp/ArrowDown
 * and Home/End move between items, Escape closes and returns to the trigger,
 * and Tab past the last item closes it. A click outside or on an item closes
 * it too.
 */
export default function ShellUserMenu({ name, email, initial, isAdmin, inStudentView, variant }: ShellUserMenuProps) {
  const [open, setOpen] = useState(false);
  const [studentChoices, setStudentChoices] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const focusOnOpen = useRef<'first' | 'last'>('first');
  const panelId = useId();
  const pathname = usePathname();
  const onProfile = pathname === '/dashboard/profile' || pathname.startsWith('/dashboard/profile/');

  useEffect(() => {
    if (!open) return;

    // After a click this focus shows no ring (the trigger was not
    // focus-visible), so mouse users see nothing move.
    const items = panelItems(panelRef.current);
    (focusOnOpen.current === 'last' ? items[items.length - 1] : items[0])?.focus();

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const openAt = (which: 'first' | 'last') => {
    focusOnOpen.current = which;
    setOpen(true);
    setStudentChoices(false);
  };

  const toggle = () => {
    if (open) setOpen(false);
    else openAt('first');
  };

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const which = event.key === 'ArrowUp' ? 'last' : 'first';
    if (!open) {
      openAt(which);
      return;
    }
    const items = panelItems(panelRef.current);
    (which === 'last' ? items[items.length - 1] : items[0])?.focus();
  };

  const onPanelKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = panelItems(panelRef.current);
    if (items.length === 0) return;

    const index = items.indexOf(document.activeElement as HTMLElement);
    const last = items.length - 1;
    let next: number;
    if (event.key === 'ArrowDown') next = index < 0 || index === last ? 0 : index + 1;
    else if (event.key === 'ArrowUp') next = index <= 0 ? last : index - 1;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = last;
    else return;

    event.preventDefault();
    items[next].focus();
  };

  // Only a move to another focusable element (Tab) closes the panel here. A
  // click is the pointerdown handler's job: Safari does not focus a clicked
  // button, so relatedTarget is null while a click is on its way to an item,
  // and closing on that blur would unmount the item and swallow the click.
  const onRootBlur = (event: FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget as Node | null;
    if (open && next && !rootRef.current?.contains(next)) setOpen(false);
  };

  const close = () => setOpen(false);

  const panel = open && (
    <div
      ref={panelRef}
      id={panelId}
      role="group"
      aria-label="Account"
      onKeyDown={onPanelKeyDown}
      className={cn(
        'absolute z-50 w-64 rounded-2xl border border-mist-200 bg-white p-1.5 shadow-lg',
        variant === 'desktop' ? 'bottom-full left-0 mb-2' : 'right-0 top-full mt-2',
      )}
    >
      <div className="px-2.5 pb-2 pt-1.5">
        <p className="truncate text-sm font-semibold text-mist-900">{name}</p>
        <p className="truncate text-xs text-mist-500">{email}</p>
      </div>
      <div className="border-t border-mist-100 pt-1.5">
        <Link href="/dashboard/profile" onClick={close} className={itemClass}>
          <User className="h-4 w-4" />
          Profile
        </Link>

        {/* Support is a person in Telegram; the visible "Telegram" says where
            the link goes before it is tapped, the sr-only text says the same. */}
        <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" onClick={close} className={itemClass}>
          <CircleHelp className="h-4 w-4" />
          <span className="flex-1">Help</span>
          <span aria-hidden className="text-xs font-normal text-mist-500">
            Telegram
          </span>
          <span className="sr-only"> (opens Telegram)</span>
        </a>

        {isAdmin && !inStudentView && (
          <>
            <button
              type="button"
              aria-expanded={studentChoices}
              onClick={() => setStudentChoices((value) => !value)}
              className={itemClass}
            >
              <Eye className="h-4 w-4" />
              <span className="flex-1">See the site as a student</span>
              <ChevronDown className={cn('h-4 w-4 transition-transform', studentChoices && 'rotate-180')} />
            </button>
            {studentChoices && (
              // The same two forms the admin hub used to carry: each posts its
              // mode to the action, which sets the cookie and opens Practice.
              <div className="grid gap-0.5 pb-1 pl-7">
                <form action={enterStudentView}>
                  <input type="hidden" name="mode" value="free" />
                  <button className={subItemClass}>Without subscription</button>
                </form>
                <form action={enterStudentView}>
                  <input type="hidden" name="mode" value="subscribed" />
                  <button className={subItemClass}>With subscription</button>
                </form>
              </div>
            )}
          </>
        )}

        {isAdmin && inStudentView && (
          <form action={exitStudentView}>
            <button className={itemClass}>
              <Undo2 className="h-4 w-4" />
              Exit student view
            </button>
          </form>
        )}
      </div>
      <div className="mt-1.5 border-t border-mist-100 pt-1.5">
        <form action={signOutAction} onSubmit={clearLocalExamData}>
          <button className={signOutClass}>
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </form>
      </div>
    </div>
  );

  if (variant === 'mobile') {
    // A 40px target around the 32px avatar; -mr-1 keeps the circle itself on
    // the header's right gutter.
    return (
      <div ref={rootRef} onBlur={onRootBlur} className="relative">
        <button
          ref={triggerRef}
          type="button"
          onClick={toggle}
          onKeyDown={onTriggerKeyDown}
          aria-label="Account menu"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          className={cn('group -mr-1 flex h-10 w-10 items-center justify-center rounded-full', focusRingClass)}
        >
          <span
            aria-hidden
            className="flex h-8 w-8 items-center justify-center rounded-full bg-mist-200 text-xs font-medium uppercase text-mist-700 transition-colors group-hover:bg-mist-300"
          >
            {initial}
          </span>
        </button>
        {panel}
      </div>
    );
  }

  // Same row geometry as a sidebar nav link, so the avatar lines up with the
  // nav icons and survives the collapsed rail; on /dashboard/profile it wears
  // the active tab like any other page. The initial is aria-hidden and the
  // name only goes sr-only when collapsed, so the button is named after the
  // user, not after one letter; the sr-only tail says what it opens, which a
  // bare name does not.
  return (
    <div ref={rootRef} onBlur={onRootBlur} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        onKeyDown={onTriggerKeyDown}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className={cn(
          'group relative flex h-12 w-full items-center gap-3 rounded-l-full pl-1 pr-3 text-left text-sm font-medium transition-colors',
          sidebarFocusClass,
          onProfile ? 'bg-mist-100 text-board-600' : 'text-board-100 hover:bg-board-900 hover:text-white',
        )}
      >
        {onProfile && <SidebarNotch />}
        <span
          aria-hidden
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-medium uppercase',
            onProfile ? 'bg-board-600 text-white' : 'bg-board-700 text-white',
          )}
        >
          {initial}
        </span>
        {/* Name only: the email is in the panel header. */}
        <span className="min-w-0 flex-1 truncate collapsed:sr-only">{name}</span>
        <span className="sr-only">, account menu</span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 transition-transform collapsed:hidden',
            onProfile ? 'text-mist-500' : 'text-board-200',
            open ? 'rotate-0' : 'rotate-180',
          )}
        />
        {!open && <RailTooltip>{name}</RailTooltip>}
      </button>
      {panel}
    </div>
  );
}
