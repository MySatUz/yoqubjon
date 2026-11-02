'use client';

import React, { useState, useTransition } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { closeQuestionReports } from '@/app/admin/question-report-actions';
import { Button } from '@/components/ui/Button';

/**
 * Closes one question's open reports: on the bell, a report that needs no
 * fix; on the question's page, every report about it once it is fixed. The
 * page refreshes without them.
 */
export function CloseReportsButton({
  reportIds,
  label,
  variant = 'quiet',
  className,
}: {
  reportIds: string[];
  label: string;
  variant?: 'secondary' | 'quiet';
  className?: string;
}) {
  const [isClosing, startClosing] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className={className}>
      <Button
        variant={variant}
        size="sm"
        disabled={isClosing}
        onClick={() => {
          setError(null);
          startClosing(async () => {
            try {
              const result = await closeQuestionReports(reportIds);
              if (!result.success) setError(result.error);
            } catch {
              setError('No answer from the server. Try again.');
            }
          });
        }}
      >
        {isClosing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        {label}
      </Button>
      {error && <p role="alert" className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
