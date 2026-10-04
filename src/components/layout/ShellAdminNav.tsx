import { getShellCanManageTests, getShellStudentView } from '@/components/layout/shell-data';
import { ShellAdminNavLink } from '@/components/layout/ShellNav';

type ShellAdminNavProps = {
  variant: 'desktop' | 'mobile';
  /**
   * Set by the student-facing shell: an admin in student view should see the
   * nav a student sees. The admin shell leaves it off, so the panel never
   * loses its own entry; <StudentViewBanner> is the way back from either.
   */
  hideInStudentView?: boolean;
};

/**
 * Streamed island: hits the database (`isAdminUser`) to decide whether the
 * "Admin Panel" entry belongs in the nav. Rendered with a `null` fallback on
 * purpose — most users are not admins, so reserving a slot would show a
 * placeholder that then disappears for the majority.
 */
export default async function ShellAdminNav({ variant, hideInStudentView = false }: ShellAdminNavProps) {
  const [canManageTests, studentView] = await Promise.all([
    getShellCanManageTests(),
    hideInStudentView ? getShellStudentView() : null,
  ]);

  if (!canManageTests || studentView) return null;

  return <ShellAdminNavLink variant={variant} />;
}
