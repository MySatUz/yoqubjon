"use client";

import React from 'react';
import FloatingWindow from '@/components/exam/FloatingWindow';

/**
 * College Board's own Desmos, in a floating window over the question as in
 * Bluebook (see `FloatingWindow`). Shared by the exam and the admin Board.
 *
 * The caller mounts it the first time it is opened and only hides it after
 * that: Desmos is expensive to boot and keeps the graphs in its own state,
 * and the window is `hidden` when closed rather than unmounted, because
 * moving or remounting the iframe would reload it.
 */
export default function CalculatorWindow({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <FloatingWindow
      id="calculator"
      title="Graphing calculator"
      isOpen={isOpen}
      onClose={onClose}
      closeLabel="Close calculator"
      side="left"
      defaultWidth={520}
    >
      <iframe
        src="https://www.desmos.com/testing/collegeboard/graphing?lang=en"
        className="absolute inset-0 h-full w-full border-none"
        title="College Board Desmos Calculator"
      />
    </FloatingWindow>
  );
}
