/**
 * Grid-in answers are typed into local component state and only pushed into the
 * store after a short pause, so anything that reads the answers (submitting the
 * test, handing over to the next module) has to flush the pending draft first -
 * otherwise the last characters typed would never reach the payload.
 *
 * Only one answer input is on screen at a time, so a single slot is enough.
 */
type AnswerFlush = () => void;

let pendingFlush: AnswerFlush | null = null;

export function setPendingAnswerFlush(flush: AnswerFlush) {
  pendingFlush = flush;
}

/** Clears the slot only if it still holds this exact flush. */
export function clearPendingAnswerFlush(flush: AnswerFlush) {
  if (pendingFlush === flush) {
    pendingFlush = null;
  }
}

/** Safe to call at any time: committing an unchanged draft is a no-op. */
export function flushPendingAnswer() {
  pendingFlush?.();
}
