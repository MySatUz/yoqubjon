/**
 * Forgets everything an exam leaves in this browser: the saved attempt and the
 * per-tab window and whiteboard state. Run on sign-out, so the next person at a
 * shared computer starts clean. The attempt is also bound to its account
 * (useExamStore `ownerId`), so this is the second lock, not the only one.
 */
import { useExamStore } from '@/store/useExamStore';

const PREFIXES = ['mysat-exam-window:', 'mysat-board:'];

export function clearLocalExamData() {
  try {
    // Through the store, not localStorage directly: sign-out is an in-app
    // navigation, so the attempt would live on in memory and be written back
    // by the next change. Resetting the store and clearing its storage keeps
    // the two in step.
    useExamStore.setState(useExamStore.getInitialState(), true);
    void useExamStore.persist.clearStorage();
    for (const storage of [window.localStorage, window.sessionStorage]) {
      for (let i = storage.length - 1; i >= 0; i -= 1) {
        const key = storage.key(i);
        if (key && PREFIXES.some((prefix) => key.startsWith(prefix))) storage.removeItem(key);
      }
    }
  } catch {
    // Storage blocked (private mode, settings): nothing was saved there either.
  }
}
