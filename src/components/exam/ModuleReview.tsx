"use client";

import React, { useCallback, useEffect, useRef } from 'react';
import { QuestionGrid, useModuleCounts } from '@/components/exam/QuestionNavigator';
import { useExamStore } from '@/store/useExamStore';
import { formatDuration } from '@/lib/olympiad';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';

/** A number in the summary line, set darker than the words around it. */
function Count({ value }: { value: number }) {
  return <span className="font-medium text-mist-900">{value}</span>;
}

interface ModuleReviewProps {
  questionIds: string[];
  moduleIndex: number;
  moduleCount: number;
  /** The next module's clock, for what finishing this one means; null on the last. */
  nextModuleSeconds: number | null;
}

/**
 * "Check your work": the module's questions at a glance before it is
 * finished, opened by Next on the last question and from the navigator. It
 * replaces a browser `confirm()` that said nothing about what was left.
 *
 * Every chip goes back to its question; Finish is in the bottom bar, where
 * Next was (see `BottomNav`). The clock keeps running here, as on the test.
 */
export default function ModuleReview({
  questionIds,
  moduleIndex,
  moduleCount,
  nextModuleSeconds,
}: ModuleReviewProps) {
  const setCurrentQuestionIndex = useExamStore((state) => state.setCurrentQuestionIndex);
  const setReviewOpen = useExamStore((state) => state.setReviewOpen);
  const { answered, unanswered, marked } = useModuleCounts(questionIds);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // The screen changed under the student: a screen reader starts here.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const handleSelect = useCallback(
    (index: number) => {
      setCurrentQuestionIndex(index);
      setReviewOpen(false);
    },
    [setCurrentQuestionIndex, setReviewOpen]
  );

  const isLastModule = nextModuleSeconds === null;

  return (
    <div className="flex-1 overflow-y-auto bg-mist-100 px-4 py-6 sm:py-10">
      <div className="mx-auto w-full max-w-[680px] space-y-4">
        <div>
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="text-xl font-semibold tracking-tight text-mist-900 focus:outline-hidden sm:text-2xl"
          >
            Check your work
          </h2>
          <p className="mt-1 text-sm text-mist-600">Pick any question to go back to it.</p>
        </div>

        {/* The counts as one line over the grid they describe, not three
            stat tiles: on a phone the tiles broke two-and-one, and the grid
            under them already shows every question's state. */}
        <Card>
          <CardHeader
            title={moduleCount > 1 ? `Module ${moduleIndex} of ${moduleCount}` : 'Your answers'}
            description={
              <span className="tabular-nums">
                <Count value={answered} /> answered · <Count value={unanswered} /> not answered
                {marked > 0 && <> · <Count value={marked} /> flagged</>}
              </span>
            }
          />
          <CardBody>
            <QuestionGrid questionIds={questionIds} currentIndex={null} onSelect={handleSelect} />
          </CardBody>
        </Card>

        <p className="text-sm text-mist-600">
          {isLastModule
            ? 'Finishing sends your answers and opens your result.'
            : `Once you finish, you cannot come back to Module ${moduleIndex}. Module ${moduleIndex + 1} is timed on its own (${formatDuration(nextModuleSeconds)}) and starts when you press Start.`}
        </p>
      </div>
    </div>
  );
}
