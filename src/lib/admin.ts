import { cache } from "react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

export const OWNER_ADMIN_EMAIL = 'abdunazarovmardon@gmail.com';

function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase() || '';
}

function isOwnerEmail(email?: string | null) {
  return normalizeEmail(email) === OWNER_ADMIN_EMAIL;
}

export function isAdminSessionUser(user?: { email?: string | null; role?: string | null } | null) {
  return user?.role === "ADMIN" || isOwnerEmail(user?.email);
}

export function isOwnerSessionUser(user?: { email?: string | null } | null) {
  return isOwnerEmail(user?.email);
}

/**
 * The signed-in user's row, read once per request for everything that needs
 * it: the admin flag, the owner check and the name in the sidebar
 * (`getShellUser`). Each used to read the same row with its own select, and
 * Prisma Postgres bills every read. `cache()` lives for exactly one request,
 * so role and name changes still take effect on the next page load (reading
 * them from the JWT instead would delay them until the user signs in again).
 */
export const getUserRow = cache(async (userId: string) =>
  prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, role: true },
  })
);

/**
 * Request-scoped memoization: `layout`, `page` and the shell islands all ask for
 * the same flag, and React does not deduplicate Prisma calls the way it does for
 * `fetch`.
 */
export const isAdminUser = cache(async (userId?: string | null) => {
  if (!userId) return false;
  return isAdminSessionUser(await getUserRow(userId));
});

export const isOwnerAdmin = cache(async (userId?: string | null) => {
  if (!userId) return false;
  return isOwnerEmail((await getUserRow(userId))?.email);
});

export async function requireAdmin() {
  const session = await auth();

  if (!await isAdminUser(session?.user?.id)) {
    throw new Error("Forbidden");
  }

  return session;
}

export async function requireOwnerAdmin() {
  const session = await auth();

  if (!await isOwnerAdmin(session?.user?.id)) {
    throw new Error("Forbidden");
  }

  return session;
}

export async function requireAdminPage() {
  try {
    return await requireAdmin();
  } catch {
    notFound();
  }
}
