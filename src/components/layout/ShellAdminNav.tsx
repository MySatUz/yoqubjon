import { getShellCanManageTests } from '@/components/layout/shell-data';
import { ShellAdminNavLink } from '@/components/layout/ShellNav';

/**
 * Streamed island: hits the database (`isAdminUser`) to decide whether the
 * "Admin Panel" entry belongs in the nav. Rendered with a `null` fallback on
 * purpose — most users are not admins, so reserving a slot would show a
 * placeholder that then disappears for the majority.
 */
export default async function ShellAdminNav({ variant }: { variant: 'desktop' | 'mobile' }) {
  const canManageTests = await getShellCanManageTests();

  if (!canManageTests) return null;

  return <ShellAdminNavLink variant={variant} />;
}
