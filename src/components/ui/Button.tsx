import React from 'react';
import { cn } from '@/components/ui/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'ghost' | 'danger' | 'danger-ghost' | 'danger-secondary';
export type ButtonSize = 'sm' | 'md' | 'lg';

/** The one keyboard focus ring for buttons and links that look like them. */
export const focusRingClass = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-600';

// The radius is added per call: rounded-lg, or rounded-full for `pill` (the
// landing's floating header, where a square key would sit oddly in the pill).
const base =
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors ' +
  focusRingClass + ' disabled:pointer-events-none aria-disabled:pointer-events-none';

/*
 * Buttons are drawn like keys, so they read as pressable before the pointer
 * reaches them - on a phone there is no hover to find out. The solid ones
 * carry a darker inner edge along the bottom; the outlined ones a gray-400
 * box whose bottom edge is a step darker, over a hairline shadow. Pressing
 * takes the edge away, as a key going down would. These two are the only
 * shadows a control has (AGENTS.md, "Elevation").
 */
const solidEdge = 'shadow-[inset_0_-1px_0_rgb(0_0_0/0.2)] active:shadow-none';
const keyEdge = 'border border-gray-400 border-b-gray-500 shadow-xs active:shadow-none';

/*
 * Each variant draws its own "not yet" state from the palette - never
 * `opacity-50`, which turned the accent into a pastel in no family. Variant
 * utilities come after the base ones in Tailwind v4, so these win over
 * `bg-ink-600` without tailwind-merge.
 */
const solidDisabled =
  'disabled:bg-gray-200 disabled:text-gray-500 disabled:shadow-none aria-disabled:bg-gray-200 aria-disabled:text-gray-500 aria-disabled:shadow-none';
const outlinedDisabled =
  'disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-500 disabled:shadow-none ' +
  'aria-disabled:border-gray-200 aria-disabled:bg-gray-100 aria-disabled:text-gray-500 aria-disabled:shadow-none';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-ink-600 text-white hover:bg-ink-700 active:bg-ink-800 ' + solidEdge + ' ' + solidDisabled,
  secondary:
    keyEdge + ' bg-white text-gray-800 hover:border-gray-500 hover:bg-gray-50 hover:text-gray-900 active:bg-gray-100 ' +
    outlinedDisabled,
  // A low-priority action that repeats in rows and toolbars ("Extend 1 month",
  // "Copy email"): a light box with an accent label, so a row of them does not
  // shout like a row of secondary buttons and still looks like something to press.
  quiet:
    'border border-gray-300 bg-white text-ink-700 hover:border-ink-600 hover:bg-ink-50 active:bg-ink-100 ' +
    outlinedDisabled,
  ghost: 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 disabled:text-gray-400 aria-disabled:text-gray-400',
  danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 ' + solidEdge + ' ' + solidDisabled,
  'danger-ghost': 'text-red-600 hover:bg-red-50 disabled:text-gray-400 aria-disabled:text-gray-400',
  // A destructive action that repeats down a list (delete in every row): it
  // looks like its secondary neighbours and turns red only on hover or focus,
  // so the list is not a column of red bins.
  'danger-secondary':
    keyEdge + ' bg-white text-gray-700 hover:border-red-300 hover:bg-red-50 hover:text-red-700 ' +
    'focus-visible:text-red-700 ' + outlinedDisabled,
};

/**
 * A link inside running text or a meta line: accent and always underlined, so
 * it is told from plain text without colour and without hover. Hover thickens
 * the underline. For a link that should look like a button use `buttonClass`.
 */
export const linkClass =
  'font-medium text-ink-700 underline decoration-1 underline-offset-2 transition-colors hover:text-ink-800 hover:decoration-2 ' +
  'focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-600';

/*
 * A finger needs about 40-44px, a mouse pointer far less. On a coarse pointer
 * (phones, tablets) every size steps up to h-10 / h-11; with a mouse the
 * compact h-8 / h-9 / h-10 stay. Inputs step up the same way (Field.tsx), so a
 * field and its button stay level on both.
 */
const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm pointer-coarse:h-10',
  md: 'h-9 px-4 text-sm pointer-coarse:h-11',
  lg: 'h-10 px-5 text-sm pointer-coarse:h-11',
};

const iconSizes: Record<ButtonSize, string> = {
  sm: 'h-8 w-8 pointer-coarse:h-10 pointer-coarse:w-10',
  md: 'h-9 w-9 pointer-coarse:h-11 pointer-coarse:w-11',
  lg: 'h-10 w-10 pointer-coarse:h-11 pointer-coarse:w-11',
};

/** Classes for anything that should look like a button — a <Link>, an <a>, a <label>. */
export function buttonClass({
  variant = 'primary',
  size = 'md',
  block = false,
  pill = false,
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; block?: boolean; pill?: boolean; className?: string } = {}) {
  return cn(base, pill ? 'rounded-full' : 'rounded-lg', variants[variant], sizes[size], block && 'w-full', className);
}

/**
 * Square, icon-only button. Always pass an `aria-label`. Ghost by default, for
 * the places where the chrome around it already says "controls": a toolbar, a
 * panel's close button, a button inside a field (the password's eye). An icon
 * action in a row or on a card is `secondary`, outlined, so it looks pressable
 * before it is hovered; a destructive one there is `danger-secondary`.
 */
export function iconButtonClass({
  variant = 'ghost',
  size = 'md',
  pill = false,
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; pill?: boolean; className?: string } = {}) {
  return cn(base, pill ? 'rounded-full' : 'rounded-lg', variants[variant], iconSizes[size], className);
}

/* ComponentProps<'button'> includes `ref`: React 19 passes it to a function
   component as a plain prop, so the spread below hands it to the <button>
   (a dialog returning focus to its trigger, a menu focusing its first item). */
type ButtonProps = React.ComponentProps<'button'> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
};

export function Button({ variant, size, block, className, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={buttonClass({ variant, size, block, className })} {...props} />;
}

type IconButtonProps = React.ComponentProps<'button'> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  'aria-label': string;
};

export function IconButton({ variant, size, className, type = 'button', ...props }: IconButtonProps) {
  return <button type={type} className={iconButtonClass({ variant, size, className })} {...props} />;
}
