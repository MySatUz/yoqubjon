import { auth } from "@/auth";
import { notFound } from "next/navigation";

function getAdminEmails() {
  const configured = process.env.ADMIN_EMAILS;
  const fallback = process.env.NODE_ENV === "production" ? "" : "admin@mysat.uz";

  return (configured || fallback)
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email?: string | null) {
  if (!email) return false;
  return getAdminEmails().includes(email.toLowerCase());
}

export async function requireAdmin() {
  const session = await auth();

  if (!isAdminEmail(session?.user?.email)) {
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
