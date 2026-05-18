import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

export async function isAdminUser(userId?: string | null) {
  if (!userId) return false;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  return user?.role === "ADMIN";
}

export async function requireAdmin() {
  const session = await auth();

  if (!await isAdminUser(session?.user?.id)) {
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
