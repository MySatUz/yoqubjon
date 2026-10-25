import type { NextRequest } from "next/server";
import { handlers } from "@/auth";

export const { GET } = handlers;

/**
 * Sign-in goes through the app's own server actions (src/lib/auth-actions.ts),
 * which call Auth.js in-process. The HTTP callbacks for the Credentials and
 * email-code providers are never used by the app, and left open they let a
 * script try passwords or codes with nothing but a CSRF token - so they are
 * closed. Sign-out and the session endpoints stay.
 */
export function POST(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/api/auth/callback/")) {
    return new Response(null, { status: 404 });
  }
  return handlers.POST(req);
}
