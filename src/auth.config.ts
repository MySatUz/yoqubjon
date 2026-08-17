import type { NextAuthConfig } from "next-auth";

/**
 * The half of the NextAuth configuration that is safe to load anywhere,
 * including inside `src/proxy.ts`.
 *
 * Deliberately free of the Prisma adapter, the Credentials provider and
 * `bcryptjs`: proxy only ever reads `req.auth` (is there a session?), and the
 * session strategy is `jwt`, so the cookie is all it needs. Importing the full
 * `@/auth` there would drag `PrismaClient` + `bcryptjs` into the proxy bundle,
 * which is instantiated on every matched request.
 *
 * The callbacks below touch only the token and the session object — no
 * database access — so they can stay shared between both halves.
 */
export const authConfig = {
  providers: [],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.role) {
        token.role = user.role;
      }

      return token;
    },
    async session({ session, token }) {
      if (token.sub && session.user) {
        session.user.id = token.sub;
        session.user.role = token.role === "ADMIN" ? "ADMIN" : "USER";
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
