'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/components/ui/cn';
import styles from './landing.module.css';

/**
 * Digits that roll instead of blinking: each character sits in its own clipped
 * slot, and a changed one leaves downwards while the new one drops in. Only
 * the slots that changed move, so "1:30" → "1:29" rolls two digits, not four.
 * Pair it with `tabular-nums` on the parent so the width never changes.
 */
export default function Odometer({ value, animate = true }: { value: string; animate?: boolean }) {
  return (
    <span className="inline-flex">
      {[...value].map((char, index) => (
        // Keyed by position and length: "10:00" → "9:59" is a new layout, not
        // a roll of every digit.
        <Slot key={`${value.length}-${index}`} char={char} animate={animate} />
      ))}
    </span>
  );
}

function Slot({ char, animate }: { char: string; animate: boolean }) {
  const [shown, setShown] = useState(char);
  const [leaving, setLeaving] = useState<string | null>(null);
  const [turn, setTurn] = useState(0);

  // Derived from the previous render, as React recommends: the new digit is
  // known now, and the old one has to be kept for its exit.
  if (char !== shown) {
    setLeaving(animate ? shown : null);
    setShown(char);
    setTurn(turn + 1);
  }

  useEffect(() => {
    if (leaving === null) return;
    const timer = window.setTimeout(() => setLeaving(null), 200);
    return () => window.clearTimeout(timer);
  }, [leaving, turn]);

  return (
    <span className="relative inline-block h-[1.15em] overflow-hidden align-bottom">
      {leaving !== null && (
        <span key={`out-${turn}`} aria-hidden="true" className={cn('absolute inset-x-0 top-0', styles.rollOut)}>
          {leaving}
        </span>
      )}
      <span key={`in-${turn}`} className={cn('block', leaving !== null && styles.rollIn)}>
        {shown}
      </span>
    </span>
  );
}
