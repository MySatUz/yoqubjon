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

export async function isAdminUser(userId?: string | null) {
  if (!userId) return false;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, role: true },
  });

  return isAdminSessionUser(user);
}

export async function isOwnerAdmin(userId?: string | null) {
  if (!userId) return false;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  return isOwnerEmail(user?.email);
}

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
