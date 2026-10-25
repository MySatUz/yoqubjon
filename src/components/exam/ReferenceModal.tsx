"use client";

import React from 'react';
import FloatingWindow from '@/components/exam/FloatingWindow';

interface ReferenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** `ReferenceSheet`, rendered on the server with its formulas typeset. */
  children: React.ReactNode;
}

/**
 * The reference sheet, in the same kind of window as the calculator: it opens
 * against the right edge, and the two can be open side by side, as in
 * Bluebook. Not a modal any more, so the question stays readable and
 * answerable behind it. Nothing in it keeps state, so closing unmounts it.
 */
export default function ReferenceModal({ isOpen, onClose, children }: ReferenceModalProps) {
  if (!isOpen) return null;

  return (
    <FloatingWindow
      id="reference"
      title="Reference sheet"
      isOpen
      onClose={onClose}
      closeLabel="Close reference sheet"
      side="right"
      defaultWidth={440}
    >
      <div className="absolute inset-0 overflow-y-auto overscroll-contain p-4">
        {children}
      </div>
    </FloatingWindow>
  );
}
