"use client";

import React from 'react';
import { Calculator, Circle, Cuboid, Sigma, Triangle, X } from 'lucide-react';

interface ReferenceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ReferenceFormula = {
  label: string;
  value: React.ReactNode;
};

const referenceGroups: {
  title: string;
  icon: typeof Circle;
  formulas: ReferenceFormula[];
}[] = [
  {
    title: 'Geometry',
    icon: Circle,
    formulas: [
      { label: 'Circle area', value: <>A = πr<sup>2</sup></> },
      { label: 'Circle circumference', value: <>C = 2πr</> },
      { label: 'Rectangle area', value: <>A = l × w</> },
      { label: 'Triangle area', value: <>A = ½bh</> },
    ],
  },
  {
    title: 'Triangles',
    icon: Triangle,
    formulas: [
      { label: 'Pythagorean theorem', value: <>a<sup>2</sup> + b<sup>2</sup> = c<sup>2</sup></> },
      { label: '30-60-90 sides', value: <>x, x√3, 2x</> },
      { label: '45-45-90 sides', value: <>x, x, x√2</> },
      { label: 'Angle sum', value: <>180°</> },
    ],
  },
  {
    title: 'Volume',
    icon: Cuboid,
    formulas: [
      { label: 'Rectangular prism', value: <>V = lwh</> },
      { label: 'Cylinder', value: <>V = πr<sup>2</sup>h</> },
      { label: 'Cone', value: <>V = ⅓πr<sup>2</sup>h</> },
      { label: 'Sphere', value: <>V = ⁴⁄₃πr<sup>3</sup></> },
    ],
  },
  {
    title: 'Algebra',
    icon: Sigma,
    formulas: [
      { label: 'Slope', value: <>m = (y<sub>2</sub> − y<sub>1</sub>) / (x<sub>2</sub> − x<sub>1</sub>)</> },
      { label: 'Quadratic formula', value: <>x = (-b ± √(b<sup>2</sup> − 4ac)) / 2a</> },
      { label: 'Exponent rule', value: <>x<sup>a</sup> · x<sup>b</sup> = x<sup>a+b</sup></> },
      { label: 'Square root', value: <>√x = x<sup>½</sup></> },
    ],
  },
];

function MiniFigures() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Circle</p>
          <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">r</span>
        </div>
        <svg viewBox="0 0 180 112" className="h-28 w-full" role="img" aria-label="Circle with radius">
          <circle cx="82" cy="56" r="42" fill="#eff6ff" stroke="#2563eb" strokeWidth="4" />
          <line x1="82" y1="56" x2="124" y2="56" stroke="#0f172a" strokeWidth="3" />
          <circle cx="82" cy="56" r="4" fill="#0f172a" />
          <text x="100" y="49" fill="#0f172a" fontSize="14" fontWeight="800">r</text>
        </svg>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Right triangle</p>
          <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">a²+b²</span>
        </div>
        <svg viewBox="0 0 180 112" className="h-28 w-full" role="img" aria-label="Right triangle">
          <path d="M38 86 L138 86 L38 26 Z" fill="#ecfdf5" stroke="#059669" strokeWidth="4" />
          <path d="M38 72 L52 72 L52 86" fill="none" stroke="#0f172a" strokeWidth="2" />
          <text x="83" y="102" fill="#0f172a" fontSize="13" fontWeight="800">b</text>
          <text x="22" y="60" fill="#0f172a" fontSize="13" fontWeight="800">a</text>
          <text x="88" y="52" fill="#0f172a" fontSize="13" fontWeight="800">c</text>
        </svg>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Cylinder</p>
          <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">πr²h</span>
        </div>
        <svg viewBox="0 0 180 112" className="h-28 w-full" role="img" aria-label="Cylinder with radius and height">
          <ellipse cx="90" cy="28" rx="46" ry="16" fill="#fffbeb" stroke="#d97706" strokeWidth="4" />
          <path d="M44 28 V80 C44 89 136 89 136 80 V28" fill="#fffbeb" stroke="#d97706" strokeWidth="4" />
          <path d="M44 80 C44 98 136 98 136 80" fill="none" stroke="#d97706" strokeWidth="4" />
          <line x1="90" y1="28" x2="136" y2="28" stroke="#0f172a" strokeWidth="3" />
          <line x1="148" y1="28" x2="148" y2="80" stroke="#0f172a" strokeWidth="3" />
          <text x="111" y="22" fill="#0f172a" fontSize="13" fontWeight="800">r</text>
          <text x="154" y="58" fill="#0f172a" fontSize="13" fontWeight="800">h</text>
        </svg>
      </div>
    </div>
  );
}

export default function ReferenceModal({ isOpen, onClose }: ReferenceModalProps) {
  if (!isOpen) return null;

  // No `backdrop-blur` on the scrim: blurring the whole exam behind the sheet
  // keeps the compositor busy for as long as the modal is open. The scrim is
  // opaque enough on its own to separate the sheet from the question.
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-6 py-5 sm:px-8">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-blue-600">Math Reference</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">SAT formulas at a glance</h2>
            <p className="mt-2 max-w-2xl text-sm font-medium text-slate-500">
              Use this sheet during the math module for the formulas students most often need quickly.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
            aria-label="Close reference sheet"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-6 sm:px-8">
          <div className="mb-6 rounded-2xl border border-blue-100 bg-blue-50/70 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg">
                <Calculator className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-medium uppercase tracking-[0.18em] text-slate-900">Quick reminder</h3>
                <p className="mt-1 text-sm font-medium text-slate-600">
                  Keep units consistent, label what each variable means, and estimate before you lock an answer.
                </p>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <MiniFigures />
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {referenceGroups.map((group) => (
              <section key={group.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white">
                    <group.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">{group.title}</h3>
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">Most used formulas</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {group.formulas.map((formula) => (
                    <div key={formula.label} className="rounded-2xl bg-slate-50 px-4 py-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-3">
                        <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                          {formula.label}
                        </span>
                        <span className="text-base font-semibold text-slate-900">
                          {formula.value}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-200 bg-white px-6 py-4 text-right sm:px-8">
          <button
            onClick={onClose}
            className="rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
          >
            Back to Questions
          </button>
        </div>
      </div>
    </div>
  );
}
