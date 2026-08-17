import { getShellSession } from '@/components/layout/shell-data';

export type ShellSession = {
  user?: {
    name?: string | null;
    email?: string | null;
  } | null;
} | null;

function userInitialOf(session: ShellSession) {
  return session?.user?.name?.[0] || session?.user?.email?.[0] || 'U';
}

/* ---------- mobile header avatar ---------- */

export function ShellUserAvatarView({ session }: { session: ShellSession }) {
  return (
    <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-medium uppercase">
      {userInitialOf(session)}
    </div>
  );
}

export function ShellUserAvatarSkeleton() {
  return <div className="h-8 w-8 animate-pulse rounded-lg bg-slate-200" />;
}

export async function ShellUserAvatar() {
  const session = await getShellSession();

  return <ShellUserAvatarView session={session} />;
}

/* ---------- desktop sidebar user card ---------- */

export function ShellUserCardView({ session }: { session: ShellSession }) {
  return (
    <div className="bg-slate-50 rounded-2xl p-4 flex items-center gap-3 mb-4">
      <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-medium uppercase">
        {userInitialOf(session)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900 truncate">{session?.user?.name || 'User'}</p>
        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest truncate">
          {session?.user?.email}
        </p>
      </div>
    </div>
  );
}

export function ShellUserCardSkeleton() {
  // Same wrapper/padding/avatar size as ShellUserCardView, so the card height
  // (40px avatar + p-4) is identical and the swap causes no layout shift.
  return (
    <div className="bg-slate-50 rounded-2xl p-4 flex items-center gap-3 mb-4">
      <div className="h-10 w-10 animate-pulse rounded-xl bg-slate-200" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="h-3.5 w-24 animate-pulse rounded-full bg-slate-200" />
        <div className="h-2.5 w-32 animate-pulse rounded-full bg-slate-100" />
      </div>
    </div>
  );
}

export async function ShellUserCard() {
  const session = await getShellSession();

  return <ShellUserCardView session={session} />;
}
