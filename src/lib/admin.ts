import { auth } from "@/auth";
import { notFound } from "next/navigation";

const DEFAULT_ADMIN_EMAILS = ["abdunazarovmardon@gmail.com"];

function getAdminEmails() {
  const configured = process.env.ADMIN_EMAILS
    ? process.env.ADMIN_EMAILS.split(",")
    : [];

  return [...DEFAULT_ADMIN_EMAILS, ...configured]
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
