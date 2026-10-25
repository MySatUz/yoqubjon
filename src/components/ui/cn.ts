/**
 * Joins class names and drops falsy entries. Deliberately not tailwind-merge:
 * primitives keep their own visual classes, and a caller's `className` adds
 * layout only (margin, width, grid placement) — never a second colour, radius
 * or padding that would have to win a conflict.
 */
export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}
