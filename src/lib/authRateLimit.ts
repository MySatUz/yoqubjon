import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';

/**
 * Sliding-window limits for sign-in, sign-up, codes and resets, counted in the
 * AuthAttempt table: a counter in memory would reset with every new serverless
 * instance. Only used while email codes are on (see src/lib/email.ts), which is
 * also when the table is guaranteed to exist.
 *
 * Per-IP ceilings are sized for a shared network - a learning centre's Wi-Fi
 * or a mobile carrier puts a whole class behind one address - while the tight
 * limits sit on the account (per email, per email and IP, per code).
 */
export const LIMITS = {
  loginPerEmailIp: { max: 5, windowMinutes: 15 },
  loginPerEmail: { max: 30, windowMinutes: 60 },
  loginPerIp: { max: 100, windowMinutes: 15 },
  registerPerIp: { max: 30, windowMinutes: 60 },
  resendPerIp: { max: 10, windowMinutes: 60 },
  resetPerIp: { max: 20, windowMinutes: 60 },
  resetCodePerIp: { max: 20, windowMinutes: 60 },
} as const;

type Limit = { max: number; windowMinutes: number };

/** The client address Vercel puts first in x-forwarded-for. */
export function ipFromHeaders(source: Headers) {
  return source.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

export async function clientIp() {
  return ipFromHeaders(await headers());
}

/**
 * Records the attempt first and counts after, as one step: of N parallel
 * requests the k-th to commit counts at least k rows, so at most `max` of them
 * are allowed. Checking first and recording later let a burst all pass.
 */
export async function takeSlot(key: string, limit: Limit) {
  await prisma.authAttempt.create({ data: { key } });
  const count = await prisma.authAttempt.count({
    where: { key, createdAt: { gt: new Date(Date.now() - limit.windowMinutes * 60 * 1000) } },
  });

  // Rows older than a day can never count again; trimming them now and then
  // keeps the table small without a scheduled job.
  if (Math.random() < 0.02) {
    await prisma.authAttempt
      .deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } })
      .catch(() => undefined);
  }

  return count <= limit.max;
}

/** Takes a slot under every key; false if any of them is over its limit. */
export async function takeSlots(entries: Array<[string, Limit]>) {
  const results = await Promise.all(entries.map(([key, limit]) => takeSlot(key, limit)));
  return results.every(Boolean);
}

export async function clearAttempts(key: string) {
  await prisma.authAttempt.deleteMany({ where: { key } });
}
