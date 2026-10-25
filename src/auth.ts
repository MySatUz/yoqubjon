import NextAuth, { CredentialsSignin } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { isBlockedPassword } from "@/lib/password-policy";
import { authConfig } from "@/auth.config";
import { isEmailEnabled } from "@/lib/email";
import { consumeCode, getPendingVerification, secretMatches } from "@/lib/emailCodes";
import { LIMITS, clearAttempts, ipFromHeaders, takeSlots } from "@/lib/authRateLimit";

/** Right password, but the address was never confirmed: the sign-in action sends a code instead. */
class EmailNotVerified extends CredentialsSignin {
  code = "email_not_verified";
}

/** Too many tries for this account or network. */
class RateLimited extends CredentialsSignin {
  code = "rate_limited";
}

/**
 * An emailed code that was not accepted; `code` is the reason: "invalid",
 * "expired", "too-many", or "unbound" - neither this browser's sign-up secret
 * nor the account's password came with it.
 */
class CodeNotAccepted extends CredentialsSignin {
  constructor(reason: string) {
    super();
    this.code = reason;
  }
}

function readCredential(value: unknown) {
  return typeof value === "string" ? value : "";
}

/**
 * The full NextAuth instance: everything from `authConfig` plus the parts that
 * need a database and a password hasher. Only import this from server code that
 * is allowed to touch Prisma — `src/proxy.ts` uses `@/auth.config` instead.
 *
 * Rate limits live inside `authorize`, the one place every sign-in reaches;
 * the HTTP callbacks are also closed (src/app/api/auth/[...nextauth]/route.ts).
 */
export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const email = readCredential(credentials?.email).trim().toLowerCase();
        const password = readCredential(credentials?.password);

        if (!email || !password) {
          return null;
        }

        const limited = isEmailEnabled();
        const ip = ipFromHeaders(request.headers);
        if (
          limited &&
          !(await takeSlots([
            [`login:email-ip:${email}:${ip}`, LIMITS.loginPerEmailIp],
            [`login:email:${email}`, LIMITS.loginPerEmail],
            [`login:ip:${ip}`, LIMITS.loginPerIp],
          ]))
        ) {
          throw new RateLimited();
        }

        if (isBlockedPassword(password)) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user || !user.passwordHash) {
          return null;
        }

        const isPasswordCorrect = await bcrypt.compare(
          password,
          user.passwordHash
        );

        if (!isPasswordCorrect) return null;

        if (limited) {
          // Checked only after the password, so this answer never tells a
          // stranger that an address has an account.
          if (await getPendingVerification(user.id)) throw new EmailNotVerified();
          await clearAttempts(`login:email-ip:${email}:${ip}`);
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
    /**
     * Sign-in by the six-digit code emailed after sign-up. Entering it is what
     * confirms the address, so this is also the moment the account becomes
     * verified and picks up any course access granted to that email.
     *
     * The code alone is not enough. It must come with the secret from the
     * browser that signed up (or that signed in with the password), or with
     * the account's password. Otherwise someone who typed another person's
     * address could have the real owner confirm an account that carries the
     * stranger's password. The real owner of a squatted address recovers it
     * through password reset, which proves the inbox and sets their own
     * password.
     */
    Credentials({
      id: "email-code",
      name: "Email code",
      credentials: {
        email: { label: "Email", type: "email" },
        code: { label: "Code", type: "text" },
        secret: { label: "Secret", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!isEmailEnabled()) return null;

        const email = readCredential(credentials?.email).trim().toLowerCase();
        if (!email) return null;

        const user = await prisma.user.findUnique({
          where: { email },
          select: { id: true, email: true, name: true, role: true, passwordHash: true },
        });
        if (!user) throw new CodeNotAccepted("invalid");

        const pending = await getPendingVerification(user.id);
        // Already confirmed: the password is the way in, not a code.
        if (!pending) throw new CodeNotAccepted("expired");

        const password = readCredential(credentials?.password);
        const bound =
          secretMatches(credentials?.secret, pending.secretHash) ||
          (Boolean(password) && Boolean(user.passwordHash) && (await bcrypt.compare(password, user.passwordHash!)));
        if (!bound) throw new CodeNotAccepted("unbound");

        const result = await consumeCode(user.id, "verify-email", credentials?.code);
        if (result !== "ok") throw new CodeNotAccepted(result);

        await prisma.$transaction([
          prisma.pendingEmailVerification.deleteMany({ where: { userId: user.id } }),
          // Course access granted to this address before the account existed.
          prisma.sectionAccess.updateMany({
            where: { email: user.email, userId: null },
            data: { userId: user.id },
          }),
        ]);

        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
});
