import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

/**
 * Connections one Vercel instance may hold. The database (Prisma Postgres)
 * lets this role open 45, and Prisma keeps every connection it opened. The
 * `connection_limit=10` in DATABASE_URL was sized for one long-lived process,
 * but on Vercel every warm instance has a pool of its own, and during a deploy
 * the old instances keep theirs while the new ones open more. On 2026-10-27,
 * minutes after a deploy, four or five instances held all 45 and every page
 * that reads the database failed with "too many connections".
 *
 * At 5, nine instances fit. A page that runs more queries at once (the
 * dashboard runs nine) waits a moment for a free connection instead.
 */
const VERCEL_CONNECTION_LIMIT = 5;

function datasourceUrl() {
  const raw = process.env.DATABASE_URL;
  if (!raw || !process.env.VERCEL) return undefined;
  try {
    const url = new URL(raw);
    const current = Number(url.searchParams.get('connection_limit'));
    if (!current || current > VERCEL_CONNECTION_LIMIT) {
      url.searchParams.set('connection_limit', String(VERCEL_CONNECTION_LIMIT));
    }
    return url.toString();
  } catch {
    return undefined;
  }
}

// Server-only module: importing it from a client component is a bug we want to
// surface as a build/runtime error, not mask behind a `null` client.
const vercelUrl = datasourceUrl();
export const prisma =
  globalForPrisma.prisma || new PrismaClient(vercelUrl ? { datasourceUrl: vercelUrl } : undefined);

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
