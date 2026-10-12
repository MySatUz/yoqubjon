"use client";

import React, { useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useExamStore } from '@/store/useExamStore';
import { pageKeyFor, useBoardStore } from '@/components/exam/whiteboard/boardStore';
import BoardCanvas from '@/components/exam/whiteboard/BoardCanvas';
import BoardToolbar from '@/components/exam/whiteboard/BoardToolbar';

/**
 * The admin's whiteboard over the question, for running a lesson on the exam
 * screen itself.
 *
 * Mounted by `SplitScreen` inside the question's scrolling surface, so the
 * drawing scrolls with the question instead of floating over whatever is
 * under the window. Only admins get it, and only through `next/dynamic`, so a
 * student's exam never downloads a byte of this folder.
 *
 * Closing the toolbar keeps the drawing on screen and lets every press through
 * to the answers; the canvas is only left out entirely when the question has
 * nothing drawn on it.
 */
export default function Whiteboard({ questionId }: { questionId: string }) {
  const attemptId = useExamStore((state) => state.attemptId);
  const isOpen = useExamStore((state) => state.isWhiteboardOpen);
  const setOpen = useExamStore((state) => state.setWhiteboardOpen);
  const boundAttemptId = useBoardStore((state) => state.attemptId);
  const bindAttempt = useBoardStore((state) => state.bindAttempt);

  // Before paint: the pages read back from sessionStorage after a reload have
  // to be in place before the first frame of the question is drawn.
  useLayoutEffect(() => {
    if (attemptId) bindAttempt(attemptId);
  }, [attemptId, bindAttempt]);

  const pageKey = attemptId ? pageKeyFor(attemptId, questionId) : null;
  const hasInk = useBoardStore((state) => Boolean(pageKey && state.pages[pageKey]?.strokes.length));
  const isReady = pageKey !== null && boundAttemptId === attemptId;

  useEffect(() => {
    if (!isOpen || !isReady || !pageKey) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      // The grid-in answer and the label field keep their own Ctrl+Z.
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (useExamStore.getState().isReferenceOpen) return;

      const key = event.key.toLowerCase();
      const { undo, redo } = useBoardStore.getState();
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo(pageKey);
      } else if ((key === 'z' && event.shiftKey) || key === 'y') {
        event.preventDefault();
        redo(pageKey);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, isReady, pageKey]);

  if (!isReady || !pageKey) return null;

  return (
    <>
      {/* Keyed by the page: every question gets a canvas of its own, created
          blank, so nothing drawn on the last question can be painted over
          this one - not even for a frame. */}
      {(isOpen || hasInk) && <BoardCanvas key={pageKey} pageKey={pageKey} interactive={isOpen} />}
      {isOpen && createPortal(<BoardToolbar pageKey={pageKey} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}
