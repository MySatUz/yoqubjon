"use client";

import React from 'react';
import { Calculator, Circle, Ruler, Sigma, Triangle, X } from 'lucide-react';

interface ReferenceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const referenceGroups = [
  {
    title: 'Geometry',
    icon: Circle,
    formulas: [
      'Circle area: A = pi r^2',
      'Circle circumference: C = 2 pi r',
      'Rectangle area: A = l * w',
      'Triangle area: A = (1/2) * b * h',
    ],
  },
  {
    title: 'Triangles',
    icon: Triangle,
    formulas: [
      'a^2 + b^2 = c^2',
      '30-60-90 sides: x, x sqrt(3), 2x',
      '45-45-90 sides: x, x, x sqrt(2)',
      'Sum of triangle angles = 180 deg',
    ],
  },
  {
    title: 'Volume',
    icon: Ruler,
    formulas: [
      'Rectangular prism: V = l * w * h',
      'Cylinder: V = pi r^2 h',
      'Cone: V = (1/3) pi r^2 h',
      'Sphere: V = (4/3) pi r^3',
    ],
  },
  {
    title: 'Algebra',
    icon: Sigma,
    formulas: [
      'Slope: m = (y2 - y1) / (x2 - x1)',
      'Quadratic formula: x = [-b +/- sqrt(b^2 - 4ac)] / 2a',
      'Exponents: x^a * x^b = x^(a+b)',
      'Roots: x^(1/2) = sqrt(x)',
    ],
  },
];

export default function ReferenceModal({ isOpen, onClose }: ReferenceModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.25)]">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-6 py-5 sm:px-8">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-600">Math Reference</p>
            <h2 className="mt-2 text-2xl font-black text-slate-900">SAT formulas at a glance</h2>
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
          <div className="mb-6 rounded-3xl border border-blue-100 bg-blue-50/70 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200">
                <Calculator className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-900">Quick reminder</h3>
                <p className="mt-1 text-sm font-medium text-slate-600">
                  Keep units consistent, label what each variable means, and estimate before you lock an answer.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {referenceGroups.map((group) => (
              <section key={group.title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white">
                    <group.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900">{group.title}</h3>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Most used formulas</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {group.formulas.map((formula) => (
                    <div key={formula} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                      {formula}
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
            className="rounded-2xl bg-slate-900 px-6 py-3 text-sm font-black text-white transition-colors hover:bg-slate-800"
          >
            Back to Questions
          </button>
        </div>
      </div>
    </div>
  );
}
