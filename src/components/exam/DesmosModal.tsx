"use client";

import React from 'react';

interface DesmosModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DesmosModal({ isOpen, onClose }: DesmosModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-6xl h-[85vh] bg-white rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.2)] flex flex-col overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-200">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-900">Desmos Graphing Calculator</h3>
          </div>
          <button 
            onClick={onClose}
            className="group flex items-center gap-2 px-4 py-2 hover:bg-slate-200 rounded-full transition-all text-slate-500 hover:text-slate-900"
          >
            <span className="text-xs font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">Close</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 relative">
          <iframe 
            src="https://www.desmos.com/testing/collegeboard/graphing?lang=en" 
            className="w-full h-full border-none"
            title="College Board Desmos Graphing Calculator"
          />
        </div>
      </div>
    </div>

  );
}
