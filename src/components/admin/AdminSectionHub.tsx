import Link from 'next/link';
import { CreditCard, Eye, FilePlus2, ShieldCheck, UsersRound } from 'lucide-react';

type SectionCard = {
  href: string;
  title: string;
  body: string;
  countLabel: string;
  icon: typeof ShieldCheck;
  accent: string;
};

type AdminSectionHubProps = {
  canManageAdmins: boolean;
  adminCount: number;
  userCount: number;
  paymentCount: number;
  pendingPaymentCount: number;
  visibleSectionCount: number;
  visibleTestCount: number;
  testCount: number;
};

export default function AdminSectionHub({
  canManageAdmins,
  adminCount,
  userCount,
  paymentCount,
  pendingPaymentCount,
  visibleSectionCount,
  visibleTestCount,
  testCount,
}: AdminSectionHubProps) {
  const cards: SectionCard[] = [
    {
      href: '/admin/users',
      title: canManageAdmins ? 'Users & admin access' : 'Users',
      body: canManageAdmins
        ? 'Review users, inspect results, and manage admin access.'
        : 'Review users and inspect their practice results.',
      countLabel: canManageAdmins ? `${adminCount} admins` : `${userCount} users`,
      icon: UsersRound,
      accent: 'bg-blue-600 text-white',
    },
    {
      href: '/admin/payments',
      title: 'Manual payment requests',
      body: 'Review transfers by month, inspect receipts, approve or reject.',
      countLabel: pendingPaymentCount ? `${pendingPaymentCount} pending` : `${paymentCount} requests`,
      icon: CreditCard,
      accent: 'bg-emerald-600 text-white',
    },
    {
      href: '/admin/sections',
      title: 'Sections',
      body: 'Grant course access and choose which collections students can see.',
      countLabel: `${visibleSectionCount} visible`,
      icon: Eye,
      accent: 'bg-teal-600 text-white',
    },
    {
      href: '/admin/tests',
      title: 'Tests',
      body: 'Upload TEX files, images, and manage imported practice tests.',
      countLabel: `${visibleTestCount}/${testCount} visible`,
      icon: FilePlus2,
      accent: 'bg-slate-900 text-white',
    },
  ];

  return (
    <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <Link
            key={card.href}
            href={card.href}
            prefetch={false}
            className="group min-h-[220px] rounded-3xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl hover:shadow-slate-200/70"
          >
            <div className="mb-8 flex items-start justify-between gap-4">
              <span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${card.accent}`}>
                <Icon className="h-6 w-6" />
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">
                {card.countLabel}
              </span>
            </div>

            <h3 className="text-2xl font-black tracking-tight text-slate-900 group-hover:text-blue-600">
              {card.title}
            </h3>
            <p className="mt-3 text-sm font-bold leading-relaxed text-slate-500">
              {card.body}
            </p>
          </Link>
        );
      })}
    </section>
  );
}
