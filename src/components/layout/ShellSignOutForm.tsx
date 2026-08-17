import { LogOut } from 'lucide-react';
import { signOut } from '@/auth';

type ShellSignOutFormProps = {
  variant: 'desktop' | 'mobile';
};

export default function ShellSignOutForm({ variant }: ShellSignOutFormProps) {
  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  if (variant === 'mobile') {
    return (
      <form action={signOutAction}>
        <button className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 transition-colors hover:bg-red-50" aria-label="Sign out">
          <LogOut className="h-4 w-4" />
        </button>
      </form>
    );
  }

  return (
    <form action={signOutAction}>
      <button className="flex items-center justify-center gap-2 w-full py-3 text-red-500 font-bold hover:bg-red-50 rounded-xl transition-colors">
        <LogOut className="w-4 h-4" />
        Sign Out
      </button>
    </form>
  );
}
