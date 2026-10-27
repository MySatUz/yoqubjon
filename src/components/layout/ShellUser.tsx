import { getShellCanManageTests, getShellStudentView, getShellUser } from '@/components/layout/shell-data';
import ShellUserMenu from '@/components/layout/ShellUserMenu';

type ShellUser = { name?: string | null; email?: string | null };

function userInitialOf(user: ShellUser) {
  return user.name?.trim()?.[0] || user.email?.[0] || 'U';
}

/**
 * What the account menu needs from the server: who the user is, and whether
 * they are an admin (and in student view right now) — for the "See the site as
 * a student" / "Exit student view" item. All three reads are request-cached. The
 * name comes from the database (getShellUser), so a rename in Profile shows
 * here as soon as the page refreshes.
 */
async function readMenuProps() {
  const [user, isAdmin, studentView] = await Promise.all([
    getShellUser(),
    getShellCanManageTests(),
    getShellStudentView(),
  ]);

  return {
    name: user.name?.trim() || 'User',
    email: user.email,
    initial: userInitialOf(user),
    isAdmin,
    inStudentView: Boolean(studentView),
  };
}

/* ---------- mobile header avatar: opens the account menu ---------- */

export function ShellUserAvatarSkeleton() {
  return <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200" />;
}

export async function ShellUserAvatar() {
  return <ShellUserMenu variant="mobile" {...await readMenuProps()} />;
}

/* ---------- desktop sidebar user row: opens the account menu ---------- */

export function ShellUserCardSkeleton() {
  // Same row height and avatar slot as the menu's row, so the swap causes no
  // layout shift.
  return (
    <div className="flex h-12 items-center gap-3 pl-1 pr-3">
      <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-ink-900" />
      <div className="h-3 w-24 animate-pulse rounded-full bg-ink-900 collapsed:hidden" />
    </div>
  );
}

export async function ShellUserCard() {
  return <ShellUserMenu variant="desktop" {...await readMenuProps()} />;
}
