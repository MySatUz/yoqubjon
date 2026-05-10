"use client";

import React from 'react';
import { X } from 'lucide-react';

interface ReferenceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ReferenceModal({ isOpen, onClose }: ReferenceModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <h2 className="text-xl font-bold text-slate-900">SAT Math Reference Sheet</h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-200 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-slate-500" />
          </button>
        </div>
        
        <div className="p-8 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Geometry Section */}
          <section className="space-y-4">
            <h3 className="text-lg font-bold text-slate-800 border-b pb-2">Geometry & Trigonometry</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <p className="font-semibold">Circle</p>
                <p>Area: A = πr²</p>
                <p>Circumference: C = 2πr</p>
                <p>Degrees: 360°</p>
                <p>Radians: 2π</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <p className="font-semibold">Rectangle</p>
                <p>Area: A = lw</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <p className="font-semibold">Triangle</p>
                <p>Area: A = ½bh</p>
                <p>Sum of angles: 180°</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <p className="font-semibold">Pythagorean Theorem</p>
                <p>a² + b² = c²</p>
              </div>
            </div>
          </section>

          {/* Right Triangles Section */}
          <section className="space-y-4">
            <h3 className="text-lg font-bold text-slate-800 border-b pb-2">Special Right Triangles</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <p className="font-semibold">30°-60°-90°</p>
                <p>Sides: x, x√3, 2x</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <p className="font-semibold">45°-45°-90°</p>
                <p>Sides: x, x, x√2</p>
              </div>
            </div>
          </section>

          {/* Volume Section */}
          <section className="space-y-4">
            <h3 className="text-lg font-bold text-slate-800 border-b pb-2">Volume</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <p className="font-semibold">Rectangular Prism</p>
                <p>V = lwh</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <p className="font-semibold">Cylinder</p>
                <p>V = πr²h</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <p className="font-semibold">Sphere</p>
                <p>V = 4/3 πr³</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <p className="font-semibold">Cone</p>
                <p>V = 1/3 πr²h</p>
              </div>
            </div>
          </section>

          {/* Equations Section */}
          <section className="space-y-4">
            <h3 className="text-lg font-bold text-slate-800 border-b pb-2">Algebra & Functions</h3>
            <div className="grid grid-cols-1 gap-4 text-sm">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <p className="font-semibold">Quadratic Formula</p>
                <p>x = [-b ± √(b² - 4ac)] / 2a</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <p className="font-semibold">Slope Formula</p>
                <p>m = (y₂ - y₁) / (x₂ - x₁)</p>
              </div>
            </div>
          </section>
        </div>

        <div className="p-4 border-t border-slate-200 text-center">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 transition-colors"
          >
            Close Reference
          </button>
        </div>
      </div>
    </div>
  );
}
