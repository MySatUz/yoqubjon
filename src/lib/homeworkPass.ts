import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * A signed note from the exam page to `checkHomeworkAnswer`: "this student may
 * do this homework", good for a few hours.
 *
 * The page runs every gate before it shows a homework (visible, free or paid
 * for, test code entered - `/exam/[id]`), and each answer used to run them all
 * again: four database reads per answer, which Prisma Postgres bills. With a
 * valid pass the action skips them; without one - an old page, a pass that
 * ran out, no secret configured - it runs `canDoHomework` as before. So access
 * taken away while a homework is open ends at the latest when its pass does,
 * and at once on the next page load.
 *
 * Signed with the auth secret under its own label, so it is no use as
 * anything else, and it names the user and the test it was issued for.
 */
const PASS_LIFETIME_MS = 6 * 60 * 60 * 1000;

function readSecret() {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || null;
}

function sign(secret: string, userId: string, testId: string, expiresAt: number) {
  return createHmac('sha256', secret).update(`homework-pass\n${userId}\n${testId}\n${expiresAt}`).digest();
}

/** The pass for this student and homework, or null when there is no secret to sign with. */
export function issueHomeworkPass(userId: string, testId: string, now = Date.now()): string | null {
  const secret = readSecret();
  if (!secret) return null;

  const expiresAt = now + PASS_LIFETIME_MS;
  return `${expiresAt}.${sign(secret, userId, testId, expiresAt).toString('base64url')}`;
}

export function isValidHomeworkPass(pass: unknown, userId: string, testId: string, now = Date.now()): boolean {
  if (typeof pass !== 'string' || pass.length > 128) return false;

  const secret = readSecret();
  const [expiresText, signature] = pass.split('.');
  const expiresAt = Number(expiresText);
  if (!secret || !signature || !Number.isSafeInteger(expiresAt) || expiresAt <= now) return false;

  const expected = sign(secret, userId, testId, expiresAt);
  const given = Buffer.from(signature, 'base64url');
  return given.length === expected.length && timingSafeEqual(given, expected);
}
