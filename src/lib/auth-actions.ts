"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { Prisma } from "@prisma/client";
import { getPasswordPolicyError } from "@/lib/password-policy";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function register(formData: FormData) {
  const email = getFormString(formData, "email").toLowerCase();
  const password = getFormString(formData, "password");
  const name = getFormString(formData, "name");

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  if (!EMAIL_PATTERN.test(email)) {
    return { error: "Enter a valid email address" };
  }

  const passwordPolicyError = getPasswordPolicyError(password);
  if (passwordPolicyError) {
    return { error: passwordPolicyError };
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    return { error: "User already exists" };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          name,
        },
      });

      await tx.sectionAccess.updateMany({
        where: {
          email,
          userId: null,
        },
        data: { userId: user.id },
      });
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { error: "User already exists" };
    }

    throw error;
  }

  return await login(formData);
}

export async function login(formData: FormData) {
  const email = getFormString(formData, "email").toLowerCase();
  const password = getFormString(formData, "password");

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return { error: "Invalid credentials" };
        default:
          return { error: "Something went wrong" };
      }
    }
    throw error;
  }
}
