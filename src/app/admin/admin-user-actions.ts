'use server';

import { prisma } from '@/lib/prisma';
import { OWNER_ADMIN_EMAIL, requireOwnerAdmin } from '@/lib/admin';
import { refresh } from 'next/cache';

function readEmail(formData: FormData) {
  const value = formData.get('email');
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export async function grantAdminRole(formData: FormData) {
  try {
    await requireOwnerAdmin();

    const email = readEmail(formData);
    if (!email) throw new Error('Enter an email.');

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (!user) {
      throw new Error('No account with this email. They must sign up first.');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { role: 'ADMIN' },
    });

    // The panel lives on `/admin/users`, which `revalidatePath('/admin')` never
    // covered, so the role list only updated after a manual reload.
    refresh();
    return { success: true };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Admin access was not given. Try again.',
    };
  }
}

export async function revokeAdminRole(formData: FormData) {
  try {
    await requireOwnerAdmin();

    const email = readEmail(formData);
    if (!email) throw new Error('Enter an email.');
    if (email === OWNER_ADMIN_EMAIL) {
      throw new Error("The owner's admin role cannot be removed.");
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (!user) {
      throw new Error('No account with this email.');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { role: 'USER' },
    });

    refresh();
    return { success: true };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Admin access was not removed. Try again.',
    };
  }
}
