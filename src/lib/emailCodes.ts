import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { codeEmail, sendEmail } from '@/lib/email';

/**
 * Six-digit one-time codes sent by email: to confirm an address after sign-up
 * ("verify-email") and to set a new password ("reset-password").
 *
 * A code is good for 15 minutes and five guesses; a new one can be asked for
 * once a minute, five times an hour and ten times a day. Only an HMAC keyed
 * with AUTH_SECRET is stored, so a database read does not hand out working
 * codes. The newest code is the only live one.
 */
export type CodePurpose = 'verify-email' | 'reset-password';

const CODE_TTL_MINUTES = 15;
const MAX_GUESSES = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_CODES_PER_HOUR = 5;
const MAX_CODES_PER_DAY = 10;
const HOUR_MS = 60 * 60 * 1000;

function codeSecret() {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET is not set');
  return secret;
}

function hashCode(userId: string, purpose: CodePurpose, code: string) {
  return createHmac('sha256', codeSecret()).update(`${purpose}:${userId}:${code}`).digest('hex');
}

/** Whatever the student typed, as the six digits it should be: spaces and dashes dropped. */
export function normalizeCode(value: unknown) {
  return typeof value === 'string' ? value.replace(/[\s-]/g, '') : '';
}

/** A fresh secret for the signing-up browser, and the hash the server keeps. */
export function newPendingSecret() {
  const secret = randomBytes(24).toString('base64url');
  return { secret, secretHash: hashSecret(secret) };
}

export function hashSecret(secret: string) {
  return createHash('sha256').update(secret).digest('hex');
}

export function secretMatches(secret: unknown, secretHash: string | null) {
  if (typeof secret !== 'string' || !secret || !secretHash) return false;
  const expected = Buffer.from(secretHash, 'hex');
  const actual = Buffer.from(hashSecret(secret), 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export type IssueResult =
  | { ok: true }
  | { ok: false; reason: 'cooldown'; retryAfterSeconds: number }
  | { ok: false; reason: 'limit' | 'send' };

const EMAIL_TEXT: Record<CodePurpose, { subject: (code: string) => string; intro: string }> = {
  'verify-email': {
    subject: (code) => `${code} is your MYSATuz code`,
    intro: 'Enter this code to confirm your email and open your MYSATuz account.',
  },
  'reset-password': {
    subject: (code) => `${code} is your MYSATuz password reset code`,
    intro: 'Enter this code to set a new password for your MYSATuz account.',
  },
};

export async function issueCode(userId: string, email: string, purpose: CodePurpose): Promise<IssueResult> {
  const code = randomInt(0, 1_000_000).toString().padStart(6, '0');

  // One issuer at a time per account and purpose: the checks and the insert
  // run under a transaction-scoped advisory lock, so a burst of parallel
  // requests cannot all pass the cooldown and send a flood of emails. The
  // email itself goes out after the commit, never while holding the lock.
  const issued = await prisma.$transaction(async (tx): Promise<IssueResult | { ok: true; id: string }> => {
    await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtext(${`${purpose}:${userId}`}))) AS l`;

    const now = Date.now();
    const recent = await tx.emailCode.findMany({
      where: { userId, purpose, createdAt: { gt: new Date(now - 24 * HOUR_MS) } },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    const last = recent[0];
    if (last && now - last.createdAt.getTime() < RESEND_COOLDOWN_MS) {
      return {
        ok: false,
        reason: 'cooldown',
        retryAfterSeconds: Math.ceil((RESEND_COOLDOWN_MS - (now - last.createdAt.getTime())) / 1000),
      };
    }
    const lastHour = recent.filter((row) => now - row.createdAt.getTime() < HOUR_MS).length;
    if (lastHour >= MAX_CODES_PER_HOUR || recent.length >= MAX_CODES_PER_DAY) {
      return { ok: false, reason: 'limit' };
    }

    const row = await tx.emailCode.create({
      data: {
        userId,
        purpose,
        codeHash: hashCode(userId, purpose, code),
        expiresAt: new Date(now + CODE_TTL_MINUTES * 60 * 1000),
      },
      select: { id: true },
    });
    return { ok: true, id: row.id };
  });

  if (!issued.ok) return issued;

  const { text, html } = codeEmail({ intro: EMAIL_TEXT[purpose].intro, code, minutes: CODE_TTL_MINUTES });
  const sent = await sendEmail({ to: email, subject: EMAIL_TEXT[purpose].subject(code), text, html });

  if (!sent) {
    // A code nobody received must not count against the limits.
    if ('id' in issued) await prisma.emailCode.delete({ where: { id: issued.id } }).catch(() => undefined);
    return { ok: false, reason: 'send' };
  }

  return { ok: true };
}

export type ConsumeResult = 'ok' | 'invalid' | 'expired' | 'too-many';

/** Checks a code and, when it matches, retires every code of that purpose. */
export async function consumeCode(userId: string, purpose: CodePurpose, rawCode: unknown): Promise<ConsumeResult> {
  const code = normalizeCode(rawCode);
  const live = await prisma.emailCode.findFirst({
    where: { userId, purpose },
    orderBy: { createdAt: 'desc' },
    select: { id: true, codeHash: true, attempts: true, expiresAt: true },
  });

  if (!live || live.expiresAt.getTime() <= Date.now()) return 'expired';
  if (live.attempts >= MAX_GUESSES) return 'too-many';
  if (!/^\d{6}$/.test(code)) return 'invalid';

  // Reserve the guess before comparing. Postgres re-checks the WHERE under the
  // row lock, so however many requests arrive at once, at most MAX_GUESSES of
  // them get as far as the comparison.
  const reserved = await prisma.emailCode.updateMany({
    where: { id: live.id, attempts: { lt: MAX_GUESSES }, expiresAt: { gt: new Date() } },
    data: { attempts: { increment: 1 } },
  });
  if (reserved.count === 0) return 'too-many';

  const expected = Buffer.from(live.codeHash, 'hex');
  const actual = Buffer.from(hashCode(userId, purpose, code), 'hex');
  const matches = expected.length === actual.length && timingSafeEqual(expected, actual);
  if (!matches) return live.attempts + 1 >= MAX_GUESSES ? 'too-many' : 'invalid';

  // deleteMany on the exact row first: if two requests carry the right code at
  // once, only the one that actually deletes it wins.
  const claimed = await prisma.emailCode.deleteMany({ where: { id: live.id } });
  if (claimed.count === 0) return 'expired';
  await prisma.emailCode.deleteMany({ where: { userId, purpose } });
  return 'ok';
}

export async function getPendingVerification(userId: string) {
  return prisma.pendingEmailVerification.findUnique({ where: { userId }, select: { secretHash: true } });
}

export async function isVerificationPending(userId: string) {
  return Boolean(await getPendingVerification(userId));
}
