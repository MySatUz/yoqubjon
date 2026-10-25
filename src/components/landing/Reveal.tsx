'use client';

import type { ReactNode } from 'react';
import { cn } from '@/components/ui/cn';
import { useInViewOnce } from '@/lib/landing/hooks';

/**
 * Marks its box `data-inview` the first time it is seen, so server-rendered
 * children can play a one-off entrance with `group-data-[inview]:` classes.
 */
export default function Reveal({
  className,
  threshold = 0.4,
  children,
}: {
  className?: string;
  threshold?: number;
  children: ReactNode;
}) {
  const [ref, inView] = useInViewOnce<HTMLDivElement>(threshold);
  return (
    <div ref={ref} data-inview={inView ? '' : undefined} className={cn('group', className)}>
      {children}
    </div>
  );
}
