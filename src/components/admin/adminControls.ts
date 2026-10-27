import { cn } from '@/components/ui/cn';

/**
 * Class strings shared by the admin forms and tables. Field.tsx's `suffix`
 * draws a unit after a value but no prefix (the module timers read "M1 ... min"),
 * and List.tsx has no table row that opens as a whole, so the admin composes
 * both here once instead of in every file.
 */

/**
 * An h-9 control with a unit or prefix inside its border ("35 minutes",
 * "M1"). The border sits on a <label> wrapper, so a click on the unit still
 * focuses the input. It mirrors Field.tsx's control - gray-300 border,
 * gray-400 on hover, h-11 on a coarse pointer, and the accent of
 * `fieldFocusClass` - on `focus-within`, because the focus lands on the input
 * inside, not on the box.
 */
export const affixControlClass =
  'flex h-9 w-full items-center gap-2 rounded-lg border border-gray-400 bg-white px-3 text-sm transition-colors pointer-coarse:h-11 '
  + 'hover:border-gray-500 focus-within:border-ink-600 focus-within:ring-1 focus-within:ring-ink-600 '
  + 'has-disabled:cursor-not-allowed has-disabled:border-gray-200 has-disabled:bg-gray-50 '
  + 'has-aria-invalid:border-red-600 has-aria-invalid:focus-within:ring-red-600';
/*
 * `focus:outline-hidden`, as in Field.tsx: `outline-none` removed the outline
 * outright, and Windows high-contrast mode, which drops the box's ring, then
 * showed no focus at all.
 */
export const affixInputClass = 'w-full min-w-0 flex-1 bg-transparent tabular-nums text-gray-900 focus:outline-hidden';
/** A unit is text the admin reads, so gray-500 like a placeholder, not the 400 of an icon. */
export const affixTextClass = 'shrink-0 text-xs text-gray-500';

/*
 * A table row that opens as a whole, like the student Results table: the
 * name's link stretches over the row through its ::after, which is why the
 * row is `relative`. A name alone was a strip of dark text that only showed
 * it was a link under the pointer. Anything else clickable in such a row sits
 * above the link with `relative z-10`.
 */
export const linkRowClass = 'relative transition-colors hover:bg-gray-50';
export const rowLinkClass = cn(
  'font-medium text-gray-900 after:absolute after:inset-0 hover:text-ink-600 focus-visible:outline-hidden',
  'focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-ink-600'
);
