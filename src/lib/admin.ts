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
 * Request-scoped memoization: `layout`, `page` and the shell islands all ask for
 * the same flag, and React does not deduplicate Prisma calls the way it does for
 * `fetch`. `cache()` lives for exactly one request, so role changes still take
 * effect on the next page load (reading the role from the JWT instead would
 * delay them until the user signs in again).
 */
export const isAdminUser = cache(async (userId?: string | null) => {
  if (!userId) return false;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, role: true },
  });

  return isAdminSessionUser(user);
});

export const isOwnerAdmin = cache(async (userId?: string | null) => {
  if (!userId) return false;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  return isOwnerEmail(user?.email);
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
