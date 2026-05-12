import { auth } from "@/auth";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { nextUrl } = req;

  const isAuthRoute = nextUrl.pathname.startsWith("/login") || nextUrl.pathname.startsWith("/register");
  const isProtectedRoute =
    nextUrl.pathname.startsWith("/admin") ||
    nextUrl.pathname.startsWith("/dashboard") ||
    nextUrl.pathname.startsWith("/exam") ||
    nextUrl.pathname.startsWith("/payment/mock");

  if (isAuthRoute) {
    if (isLoggedIn) {
      return Response.redirect(new URL("/dashboard", nextUrl));
    }
    return;
  }

  if (isProtectedRoute && !isLoggedIn) {
    return Response.redirect(new URL("/login", nextUrl));
  }
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
