"use client";

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useBoardStore } from '@/components/exam/whiteboard/boardStore';
import BoardCanvas from '@/components/exam/whiteboard/BoardCanvas';
import BoardToolbar from '@/components/exam/whiteboard/BoardToolbar';

/**
 * The exam's whiteboard over the Board's question - the same canvas and the
 * same toolbar as `exam/whiteboard/Whiteboard`, which is tied to the exam's
 * store (its attempt id and its open switch) and so is not reused as a whole.
 *
 * The page lives in the shared board store under a `board:` key, so it never
 * mixes with a lesson drawn on a test in this tab, and it is forgotten when
 * the question leaves the board: there is no going back to it, and nothing
 * on the Board is kept.
 *
 * The toolbar goes into the Board's own full-window layer rather than into
 * `document.body`: the layer stacks over the admin shell, and a toolbar
 * outside it would sit underneath.
 */
export default function BoardWhiteboard({
  pageKey,
  isOpen,
  isActive,
  onClose,
  toolbarContainer,
}: {
  pageKey: string;
  isOpen: boolean;
  /** The board is on screen: the undo keys only work then. */
  isActive: boolean;
  onClose: () => void;
  toolbarContainer: HTMLElement | null;
}) {
  const hasInk = useBoardStore((state) => Boolean(state.pages[pageKey]?.strokes.length));
  const discardPages = useBoardStore((state) => state.discardPages);

  useEffect(() => () => discardPages(pageKey), [discardPages, pageKey]);

  // The exam's shortcuts, as in `Whiteboard`.
  useEffect(() => {
    if (!isOpen || !isActive) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      // The grid-in answer and the label field keep their own Ctrl+Z.
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;

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
  }, [isActive, isOpen, pageKey]);

  return (
    <>
      {(isOpen || hasInk) && <BoardCanvas key={pageKey} pageKey={pageKey} interactive={isOpen} />}
      {isOpen && toolbarContainer && createPortal(<BoardToolbar pageKey={pageKey} onClose={onClose} />, toolbarContainer)}
    </>
  );
}
