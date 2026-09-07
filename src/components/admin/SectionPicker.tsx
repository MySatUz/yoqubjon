import Link from 'next/link';
import { Atom, Layers3, Sparkles } from 'lucide-react';
import type { TestCollectionOption } from '@/lib/testCatalog';

/**
 * The single section control on the tests page: it both filters the list below
 * and decides where a newly uploaded test lands. The upload form used to carry
 * its own copy of this picker, which meant two lists of the same sections doing
 * two different jobs.
 *
 * Links rather than radios, because the choice drives the page's data and has to
 * survive a reload and a back button.
 */
function iconFor(category: string) {
  if (category === 'PLANCK') return Atom;
  if (category === 'ADVANCED') return Sparkles;
  return Layers3;
}

interface SectionPickerProps {
  collections: TestCollectionOption[];
  selected: string | undefined;
  /** Number of tests per section, shown on each card. */
  counts: Record<string, number>;
}

export default function SectionPicker({ collections, selected, counts }: SectionPickerProps) {
  return (
    <div className="mb-8">
      <span className="mb-3 block text-xs font-medium uppercase tracking-widest text-slate-400">
        Section
      </span>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {collections.map((option) => {
          const Icon = iconFor(option.value);
          const isSelected = option.value === selected;
          const count = counts[option.value] ?? 0;

          return (
            <Link
              key={option.value}
              href={`/admin/tests?category=${option.value}`}
              prefetch={false}
              aria-current={isSelected ? 'page' : undefined}
              className={`block h-full rounded-2xl border p-4 transition-all ${
                isSelected
                  ? 'border-blue-500 bg-blue-50 ring-4 ring-blue-100'
                  : 'border-slate-200 bg-white hover:border-blue-200'
              }`}
            >
              <div className="mb-3 flex items-center gap-3">
                <span className="rounded-xl bg-white p-2 text-blue-600 shadow-sm">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="text-sm font-semibold text-slate-900">{option.label}</span>
                <span className="ml-auto text-sm font-semibold tabular-nums text-slate-400">
                  {count}
                </span>
              </div>
              <p className="text-xs font-medium leading-relaxed text-slate-500">
                {option.description}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
