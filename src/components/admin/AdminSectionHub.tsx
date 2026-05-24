'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import { ArrowLeft, CreditCard, FilePlus2, ShieldCheck } from 'lucide-react';

type AdminSection = 'home' | 'admins' | 'payments' | 'tests';

type SectionCard = {
  id: Exclude<AdminSection, 'home'>;
  title: string;
  body: string;
  countLabel: string;
  icon: typeof ShieldCheck;
  accent: string;
};

type AdminSectionHubProps = {
  canManageAdmins: boolean;
  adminCount: number;
  paymentCount: number;
  pendingPaymentCount: number;
  testCount: number;
  adminAccess: ReactNode;
  payments: ReactNode;
  tests: ReactNode;
};

export default function AdminSectionHub({
  canManageAdmins,
  adminCount,
  paymentCount,
  pendingPaymentCount,
  testCount,
  adminAccess,
  payments,
  tests,
}: AdminSectionHubProps) {
  const [activeSection, setActiveSection] = useState<AdminSection>('home');

  const cards: SectionCard[] = [
    ...(canManageAdmins
      ? [{
          id: 'admins' as const,
          title: 'Admin access',
          body: 'Grant or remove admin access for registered users.',
          countLabel: `${adminCount} admins`,
          icon: ShieldCheck,
          accent: 'bg-blue-600 text-white',
        }]
      : []),
    {
      id: 'payments',
      title: 'Manual payment requests',
      body: 'Review transfers by month, inspect receipts, approve or reject.',
      countLabel: pendingPaymentCount ? `${pendingPaymentCount} pending` : `${paymentCount} requests`,
      icon: CreditCard,
      accent: 'bg-emerald-600 text-white',
    },
    {
      id: 'tests',
      title: 'Tests',
      body: 'Upload TEX files, images, and manage imported practice tests.',
      countLabel: `${testCount} tests`,
      icon: FilePlus2,
      accent: 'bg-slate-900 text-white',
    },
  ];

  if (activeSection !== 'home') {
    const currentTitle = cards.find((card) => card.id === activeSection)?.title;
    const sectionContent = activeSection === 'admins'
      ? adminAccess
      : activeSection === 'payments'
        ? payments
        : tests;

    return (
      <div>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setActiveSection('home')}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-600"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <h2 className="text-2xl font-black tracking-tight text-slate-900">{currentTitle}</h2>
        </div>

        <div key={activeSection}>{sectionContent}</div>
      </div>
    );
  }

  return (
    <section className="grid gap-5 md:grid-cols-3">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <button
            key={card.id}
            type="button"
            onClick={() => setActiveSection(card.id)}
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
          </button>
        );
      })}
    </section>
  );
}
