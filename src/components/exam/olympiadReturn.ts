/**
 * The exam page opens an olympiad only while a full attempt can still finish
 * before it closes (`canStartOlympiadAttempt`). That gate is for starting. A
 * student already in - waiting on the start screen, or halfway through - who
 * reloads after the last start time was sent to the olympiad page instead,
 * and the attempt in this browser could never be finished or sent.
 *
 * So the exam screen leaves this mark while it holds the student's attempt,
 * and the page lets its owner back in until the window closes. The value is
 * the account, so the next student at a shared computer is not let in on it.
 * Set by hand it buys nothing: a start this late only means less time, and
 * the start screen says how much (`ModuleTransition`).
 *
 * Free of imports: the server page and the client screen both use it.
 */

/** Ids are uuids; anything else is left out of a cookie name. */
export function olympiadReturnCookie(testId: string) {
  return `mysat-olympiad-${testId.replace(/[^A-Za-z0-9-]/g, '')}`;
}

/** Only the test's own page, which is the one place that reads it. */
function cookiePath(testId: string) {
  return `/exam/${encodeURIComponent(testId)}`;
}

/**
 * Leaves the mark for `userId` until the window closes, or takes it away with
 * null - once the attempt is sent there is nothing to come back to.
 */
export function rememberOlympiadReturn(testId: string, userId: string | null, endsAtMs: number) {
  if (typeof document === 'undefined') return;

  const seconds = Math.floor((endsAtMs - Date.now()) / 1000);
  // A uuid needs no encoding, so the server reads back exactly what was set.
  const keep = userId !== null && /^[A-Za-z0-9-]+$/.test(userId) && seconds > 0;
  const secure = window.location.protocol === 'https:' ? '; secure' : '';

  document.cookie =
    `${olympiadReturnCookie(testId)}=${keep ? userId : ''}; path=${cookiePath(testId)}; ` +
    `max-age=${keep ? seconds : 0}; samesite=lax${secure}`;
}
