import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Deliberately built from the light config: proxy runs on every matched
// request and only needs to know whether a session cookie is present.
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { nextUrl } = req;

  const isAuthRoute =
    nextUrl.pathname.startsWith("/login") ||
    nextUrl.pathname.startsWith("/register") ||
    nextUrl.pathname.startsWith("/verify-email") ||
    nextUrl.pathname.startsWith("/reset-password");
  const isProtectedRoute =
    nextUrl.pathname.startsWith("/admin") ||
    nextUrl.pathname.startsWith("/dashboard") ||
    nextUrl.pathname.startsWith("/exam") ||
    nextUrl.pathname.startsWith("/olympiad") ||
    nextUrl.pathname.startsWith("/payment/mock");

  if (isAuthRoute) {
    if (isLoggedIn) {
      return Response.redirect(new URL("/dashboard", nextUrl));
    }
    return;
  }

  if (isProtectedRoute && !isLoggedIn) {
    // Remember the page, so signing in comes back to it instead of the
    // catalog: links from Telegram open a result or an olympiad, not Practice.
    // The login action only follows a path on this site (safeCallbackUrl).
    const login = new URL("/login", nextUrl);
    if (nextUrl.pathname !== "/dashboard") {
      login.searchParams.set("callbackUrl", nextUrl.pathname + nextUrl.search);
    }
    return Response.redirect(login);
  }
});

/**
 * Only the routes this proxy actually has an opinion about. The previous
 * catch-all (`/((?!api|_next/static|_next/image|favicon.ico).*)`) also ran on
 * the marketing page, `public/` assets, `robots.txt` and `sitemap.xml`, where
 * the handler above does nothing.
 *
 * `:path*` is zero-or-more, so `/dashboard/:path*` covers `/dashboard` itself
 * as well as everything nested under it (verified against Next's bundled
 * path-to-regexp).
 *
 * Server Functions are POSTs to the route that renders them, so every route
 * hosting one must stay listed here: `login`/`register` (`src/lib/auth-actions`),
 * `/dashboard/*` and `/admin/*` (sign-out, admin and subscription actions),
 * and `/olympiad/*`, which wears the student shell and so carries its
 * sign-out and student-view actions.
 * Authorization is still enforced inside the actions themselves — see
 * `requireAdmin()` in `src/lib/admin.ts` — this matcher is the optimistic
 * first line only.
 */
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/exam/:path*",
    "/olympiad/:path*",
    "/payment/:path*",
    "/login",
    "/register",
    "/verify-email",
    "/reset-password",
  ],
};
