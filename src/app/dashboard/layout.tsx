import React from 'react';
import { auth } from "@/auth";
import { isAdminSessionUser } from '@/lib/admin';
import AppShell from '@/components/layout/AppShell';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const canManageTests = isAdminSessionUser(session?.user);

  return (
    <AppShell session={session} canManageTests={canManageTests}>
      {children}
    </AppShell>
  );
}
