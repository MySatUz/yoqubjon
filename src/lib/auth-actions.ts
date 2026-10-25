"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { AuthError, CredentialsSignin } from "next-auth";
import { Prisma } from "@prisma/client";
import { getPasswordPolicyError } from "@/lib/password-policy";
import { isEmailEnabled } from "@/lib/email";
import { consumeCode, getPendingVerification, issueCode, newPendingSecret, type IssueResult } from "@/lib/emailCodes";
import { LIMITS, clientIp, takeSlot, clearAttempts } from "@/lib/authRateLimit";
import { safeCallbackUrl } from "@/lib/safeRedirect";
import { clearPendingEmail, readPendingEmail, rememberPendingEmail } from "@/lib/pendingEmail";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NAME_LENGTH = 60;

/**
 * What a sign-in, sign-up, confirmation or reset form shows after a submit:
 * the message, the field it belongs to (so the form can put it under that
 * field and mark it), a neutral notice, and the values to keep in the fields -
 * React resets a form after its action runs, so they come back from here.
 */
export type AuthFormState = {
  error?: string;
  field?: "name" | "email" | "password" | "code";
  /** The email already has an account: offer "Sign in" and "Reset password". */
  accountExists?: boolean;
  notice?: string;
  /** For the reset form: the code has been sent, show the second step. */
  step?: "code";
  values?: { name?: string; email?: string };
} | null;

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

const SEND_FAILED = "We couldn't send the email right now. Try again in a minute, or write to us in Telegram.";

/** Treats a code that is still live (cooldown) as sent: the student has it. */
function wasSent(result: IssueResult) {
  return result.ok || result.reason === "cooldown";
}

const CODE_ERRORS: Record<string, string> = {
  invalid: "That code isn't right. Check the latest email and try again.",
  expired: "This code has expired. Send a new one.",
  "too-many": "Too many wrong tries. Send a new code.",
  unbound: "Enter the password you chose when you signed up, then the code.",
  rate_limited: "Too many attempts. Wait 15 minutes and try again.",
};

/**
 * Starts (or restarts) confirmation for a pending account from this browser:
 * a fresh secret on the pending row and in the cookie, and a code by email.
 */
async function startConfirmation(userId: string, email: string, callbackUrl: string) {
  const { secret, secretHash } = newPendingSecret();
  await prisma.pendingEmailVerification.update({ where: { userId }, data: { secretHash } });
  const sent = await issueCode(userId, email, "verify-email");
  await rememberPendingEmail(email, callbackUrl, secret);
  return sent;
}

/* ----------------------------------------------------------------- sign in */

export async function login(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = getFormString(formData, "email").toLowerCase();
  const password = getFormString(formData, "password");
  const callbackUrl = safeCallbackUrl(formData.get("callbackUrl"));
  const values = { email };

  if (!email) return { error: "Enter your email.", field: "email", values };
  if (!password) return { error: "Enter your password.", field: "password", values };

  // The limits themselves live in the provider's authorize (src/auth.ts), so
  // every way in counts against them.
  try {
    await signIn("credentials", { email, password, redirectTo: callbackUrl });
  } catch (error) {
    if (error instanceof CredentialsSignin && error.code === "email_not_verified") {
      // The password was right, so this browser may confirm the address.
      const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (!user) return { error: "We couldn't sign you in. Try again in a minute.", values };
      if (!wasSent(await startConfirmation(user.id, email, callbackUrl))) return { error: SEND_FAILED, values };
      redirect("/verify-email");
    }

    if (error instanceof CredentialsSignin && error.code === "rate_limited") {
      return { error: "Too many attempts. Wait 15 minutes, or reset your password.", values };
    }

    if (error instanceof AuthError) {
      if (error.type === "CredentialsSignin") {
        return { error: "That email and password don't match.", field: "password", values };
      }
      return { error: "We couldn't sign you in. Try again in a minute.", values };
    }

    // Success: signIn's redirect, rethrown for Next to follow.
    throw error;
  }

  return null;
}

/* ----------------------------------------------------------------- sign up */

export async function register(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = getFormString(formData, "email").toLowerCase();
  const password = getFormString(formData, "password");
  const name = getFormString(formData, "name").slice(0, MAX_NAME_LENGTH);
  const callbackUrl = safeCallbackUrl(formData.get("callbackUrl"));
  const values = { name, email };

  if (!name) {
    return { error: "Enter your name — it appears on olympiad rankings.", field: "name", values };
  }
  if (!email || !EMAIL_PATTERN.test(email)) {
    return { error: "Enter a valid email address, like name@example.com.", field: "email", values };
  }

  const passwordPolicyError = getPasswordPolicyError(password);
  if (passwordPolicyError) {
    return { error: passwordPolicyError, field: "password", values };
  }

  const verify = isEmailEnabled();
  if (verify && !(await takeSlot(`register:ip:${await clientIp()}`, LIMITS.registerPerIp))) {
    return { error: "Too many sign-ups from this network. Try again in an hour.", values };
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  // An existing account - confirmed or not - is never changed from here. Its
  // owner signs in, or proves the inbox through password reset, which also
  // takes back an address someone else signed up with.
  if (existingUser) {
    return { error: "An account with this email already exists.", field: "email", accountExists: true, values };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const pendingSecret = verify ? newPendingSecret() : null;

  let userId: string;
  try {
    userId = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email, passwordHash, name },
        select: { id: true },
      });

      if (pendingSecret) {
        await tx.pendingEmailVerification.create({ data: { userId: user.id, secretHash: pendingSecret.secretHash } });
      } else {
        // Without email confirmation the address is taken on trust, as before.
        await tx.sectionAccess.updateMany({
          where: { email, userId: null },
          data: { userId: user.id },
        });
      }

      return user.id;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "An account with this email already exists.", field: "email", accountExists: true, values };
    }
    throw error;
  }

  if (pendingSecret) {
    const sent = await issueCode(userId, email, "verify-email");
    if (!wasSent(sent)) {
      // The account exists and waits; signing in later sends a new code.
      return {
        error: "Your account is created, but we couldn't send the email. Sign in in a minute and we'll send the code again.",
        values,
      };
    }
    await rememberPendingEmail(email, callbackUrl, pendingSecret.secret);
    redirect("/verify-email");
  }

  try {
    await signIn("credentials", { email, password, redirectTo: callbackUrl });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Your account is ready, but signing in failed. Sign in with your new password.", values };
    }
    throw error;
  }
  return null;
}

/* ----------------------------------------------------- email confirmation */

export async function verifyEmail(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = getFormString(formData, "email").toLowerCase();
  const code = getFormString(formData, "code");
  const password = getFormString(formData, "password");
  const pending = await readPendingEmail();
  const fromThisBrowser = pending?.email === email;
  const callbackUrl = fromThisBrowser ? pending.callbackUrl : "/dashboard";
  const values = { email };

  if (!email) return { error: "Enter the email you signed up with.", field: "email", values };
  if (!code) return { error: "Enter the 6\u2011digit code from the email.", field: "code", values };

  let next: string;
  try {
    next = await signIn("email-code", {
      email,
      code,
      secret: fromThisBrowser ? pending.secret : "",
      password,
      redirectTo: callbackUrl,
      redirect: false,
    });
  } catch (error) {
    if (error instanceof CredentialsSignin) {
      return {
        error: CODE_ERRORS[error.code] ?? CODE_ERRORS.invalid,
        field: error.code === "unbound" ? "password" : "code",
        values,
      };
    }
    if (error instanceof AuthError) {
      return { error: "We couldn't confirm the code. Try again in a minute.", values };
    }
    throw error;
  }

  await clearPendingEmail();
  redirect(next);
}

export async function resendVerification(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = getFormString(formData, "email").toLowerCase();
  const values = { email };
  if (!email) return { error: "Enter the email you signed up with.", field: "email", values };

  // One answer for every case - unknown, confirmed, waiting, limited - so this
  // button cannot be used to learn which addresses have a pending account.
  const notice = `If ${email} is waiting for a code, we sent a new one. You can ask again in a minute.`;
  if (!isEmailEnabled()) return { notice, values };
  if (!(await takeSlot(`resend:ip:${await clientIp()}`, LIMITS.resendPerIp))) return { notice, values };

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (user && (await getPendingVerification(user.id))) {
    const result = await issueCode(user.id, email, "verify-email");
    if (!result.ok && result.reason === "send") console.error("Verification code was not sent for a pending account");
  }
  return { notice, values };
}

/* ---------------------------------------------------------- password reset */

export async function requestPasswordReset(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = getFormString(formData, "email").toLowerCase();
  // "Send a new code" on the code step posts here too, and stays on that step.
  const step = formData.get("step") === "code" ? ("code" as const) : undefined;
  const values = { email };

  if (!email || !EMAIL_PATTERN.test(email)) {
    return { step, error: "Enter the email you signed up with.", field: "email", values };
  }
  if (!isEmailEnabled()) {
    return { step, error: "Password reset by email is not switched on yet. Write to us in Telegram.", values };
  }

  if (!(await takeSlot(`reset:ip:${await clientIp()}`, LIMITS.resetPerIp))) {
    return { step, error: "Too many reset requests. Try again in an hour.", values };
  }

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (user) {
    const result = await issueCode(user.id, email, "reset-password");
    // Logged, never shown: the answer must not depend on whether the address
    // has an account.
    if (!result.ok && result.reason === "send") console.error("Password reset code was not sent");
  }

  return {
    step: "code",
    notice: `If ${email} has an account, we sent it a 6\u2011digit code. It can take a minute to arrive.`,
    values,
  };
}

export async function resetPassword(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = getFormString(formData, "email").toLowerCase();
  const code = getFormString(formData, "code");
  const password = getFormString(formData, "password");
  const values = { email };

  if (!isEmailEnabled()) {
    return { error: "Password reset by email is not switched on yet. Write to us in Telegram.", values };
  }
  if (!code) return { step: "code", error: "Enter the 6\u2011digit code from the email.", field: "code", values };

  const passwordPolicyError = getPasswordPolicyError(password);
  if (passwordPolicyError) return { step: "code", error: passwordPolicyError, field: "password", values };

  if (!(await takeSlot(`reset-code:ip:${await clientIp()}`, LIMITS.resetCodePerIp))) {
    return { step: "code", error: CODE_ERRORS.rate_limited, values };
  }

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true } });
  if (!user) return { step: "code", error: CODE_ERRORS.invalid, field: "code", values };

  const result = await consumeCode(user.id, "reset-password", code);
  if (result !== "ok") return { step: "code", error: CODE_ERRORS[result], field: "code", values };

  // The code came to this inbox, so the address is proven as well.
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(password, 10) } }),
    prisma.pendingEmailVerification.deleteMany({ where: { userId: user.id } }),
    prisma.sectionAccess.updateMany({ where: { email: user.email, userId: null }, data: { userId: user.id } }),
  ]);
  await clearAttempts(`login:email:${email}`);
  await clearPendingEmail();

  try {
    await signIn("credentials", { email, password, redirectTo: "/dashboard" });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Your password is changed. Sign in with it.", values };
    }
    throw error;
  }
  return null;
}
