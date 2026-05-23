'use server';

import { prisma } from '@/lib/prisma';
import { OWNER_ADMIN_EMAIL, requireOwnerAdmin } from '@/lib/admin';
import { revalidatePath } from 'next/cache';

function readEmail(formData: FormData) {
  const value = formData.get('email');
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export async function grantAdminRole(formData: FormData) {
  try {
    await requireOwnerAdmin();

    const email = readEmail(formData);
    if (!email) throw new Error('Email is required');

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (!user) {
      throw new Error('User was not found. The user must register first.');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { role: 'ADMIN' },
    });

    revalidatePath('/admin');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to grant admin role',
    };
  }
}

export async function revokeAdminRole(formData: FormData) {
  try {
    await requireOwnerAdmin();

    const email = readEmail(formData);
    if (!email) throw new Error('Email is required');
    if (email === OWNER_ADMIN_EMAIL) {
      throw new Error('The owner admin role cannot be revoked.');
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (!user) {
      throw new Error('User was not found.');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { role: 'USER' },
    });

    revalidatePath('/admin');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to revoke admin role',
    };
  }
}
