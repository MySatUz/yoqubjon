export const EXAM_DURATION_SECONDS = 2 * 60 * 60;
export const EXAM_TIME_GRACE_SECONDS = 60;
export const MIN_EXAM_DURATION_SECONDS = 60;
export const MAX_EXAM_DURATION_SECONDS = 6 * 60 * 60;
/**
 * The most time a test with no time limit records. Only time with the page
 * awake counts (useExamStore), so this is a bound for a sanity check, never
 * a limit a student meets.
 */
export const MAX_UNTIMED_TIME_SPENT_SECONDS = 7 * 24 * 60 * 60;
