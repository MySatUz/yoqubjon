import React from 'react';
import StudentAppShell from '@/components/layout/StudentAppShell';

/**
 * An olympiad is opened from a Practice collection, so it sits in the same
 * shell as Practice: sidebar on desktop, tab bar on a phone. It used to be a
 * bare page whose only way out was its back link.
 *
 * Synchronous, like dashboard/layout.tsx: the session lives in the shell's
 * <Suspense> islands. A guest is sent to sign in by src/proxy.ts before
 * anything renders; the page's own check stays as the second line.
 */
export default function OlympiadLayout({ children }: { children: React.ReactNode }) {
  return <StudentAppShell>{children}</StudentAppShell>;
}
