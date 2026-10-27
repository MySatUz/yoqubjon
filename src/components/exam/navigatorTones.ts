/*
 * The question chips' states, for the navigator, its legend, "Check your work"
 * and the landing's exam demo (RunnerTour), so the demo cannot drift from the
 * real thing. Status and "you are here" are drawn independently: answered is
 * solid ink blue, not answered is a dashed outline (a second cue besides colour,
 * 4.77:1), and the current question gets a dark ring on top of whichever of
 * the two it is. The old answered tint was 1.09:1 against white, and "current"
 * painted over the status entirely.
 *
 * A module of its own, with no imports: `QuestionNavigator` pulls in the exam
 * store, which reads localStorage the moment it loads, and the landing has no
 * business doing that. Import from here, not from the navigator.
 */
export const ANSWERED_TONE = 'border-ink-600 bg-ink-600 text-white';
export const UNANSWERED_TONE = 'border-dashed border-gray-500 bg-white text-gray-700';
export const CURRENT_RING = 'ring-2 ring-gray-900 ring-offset-2';

/**
 * Flagged: the question's own bookmark, filled amber - the system's colour
 * for "flagged" - and, on a chip, set in a white socket on
 * the chip's corner so it reads on the solid answered tone too.
 */
export const MARKED_ICON_CLASS = 'fill-amber-600 text-amber-600';
export const MARKED_SOCKET_CLASS = 'absolute flex items-center justify-center rounded-full bg-white';
