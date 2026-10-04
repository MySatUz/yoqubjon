// Shared by the server check and the client forms, so it must stay free of
// server-only imports such as Prisma.

export const ACCESS_CODE_LENGTH = 6;

export const ACCESS_CODE_PATTERN = /^\d{6}$/;

/** A random six-digit code, leading zeros included. */
export function generateAccessCode() {
  const [value] = crypto.getRandomValues(new Uint32Array(1));
  return String(value % 10 ** ACCESS_CODE_LENGTH).padStart(ACCESS_CODE_LENGTH, '0');
}
