import { focusRingClass } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';

/*
 * The tool switches in the exam's top bar - calculator, reference sheet,
 * whiteboard - shared with the admin Board, whose strip copies the exam's.
 */

/**
 * Same geometry as `iconButtonClass` (md), grown to a 40px tap target on a
 * coarse pointer, as the primitives grow; spelled out here because the
 * primitive has no pressed state for a toggle. Idle, it is keyed like a
 * `secondary` button (Button.tsx) - a gray-400 box with a gray-500 bottom edge
 * over `shadow-xs` - so it matches the secondary buttons in the same bar:
 * ghost, "Reference" and "Calculator" read as two labels in the header rather
 * than as the student's tools. Pressed is the one "selected" treatment the
 * exam uses everywhere: a board tint and a board hairline, no key edge.
 */
export const toolButtonClass = cn(
  'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors pointer-coarse:h-10 pointer-coarse:w-10',
  // The secondary button's own "not yet" (Button.tsx), never faded.
  'disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-500 disabled:shadow-none',
  focusRingClass
);

/**
 * The student's two tools are named from `xl` up, as in Bluebook, and are
 * icons below it, each still named by its tooltip and label: spelled out,
 * they left no room on a 1024px screen beside the centred clock. The
 * `xl:pointer-coarse` width undoes the tap-target width above on a tablet
 * held sideways, where the label is shown.
 */
export const labelledToolClass = cn(toolButtonClass, 'gap-1.5 text-sm font-medium xl:w-auto xl:px-3 xl:pointer-coarse:w-auto');
export const toolIdleClass =
  'border-gray-400 border-b-gray-500 bg-white text-gray-800 shadow-xs hover:border-gray-500 hover:bg-gray-50 hover:text-gray-900 ' +
  'active:bg-gray-100 active:shadow-none';
export const toolActiveClass = 'border-ink-600 bg-ink-50 text-ink-700';
export const toolIconClass = 'h-4 w-4';
