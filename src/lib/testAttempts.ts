export const DEFAULT_TEST_MAX_ATTEMPTS = 10;
export const MIN_TEST_MAX_ATTEMPTS = 1;
export const MAX_TEST_MAX_ATTEMPTS = 10_000;

export function normalizeTestMaxAttempts(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return DEFAULT_TEST_MAX_ATTEMPTS;
  }

  const attempts = typeof value === 'number' ? value : Number(value);
  if (
    !Number.isFinite(attempts) ||
    !Number.isInteger(attempts) ||
    attempts < MIN_TEST_MAX_ATTEMPTS ||
    attempts > MAX_TEST_MAX_ATTEMPTS
  ) {
    throw new Error(
      `Attempt limit must be between ${MIN_TEST_MAX_ATTEMPTS} and ${MAX_TEST_MAX_ATTEMPTS}`
    );
  }

  return attempts;
}
