"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createSurface, type Surface } from '@/components/exam/whiteboard/surface';
import { currentInk, useBoardStore } from '@/components/exam/whiteboard/boardStore';
import {
  MAX_TEXT_LENGTH,
  nextStrokeId,
  sanitizeStroke,
  textFontSize,
  type BoardPoint,
  type BoardTool,
} from '@/components/exam/whiteboard/geometry';

/** The cursor names the tool before any tooltip has time to. */
const CURSORS: Record<BoardTool, string> = {
  pen: 'crosshair',
  marker: 'crosshair',
  line: 'crosshair',
  arrow: 'crosshair',
  rect: 'crosshair',
  ellipse: 'crosshair',
  text: 'text',
  // The red dot is the cursor; an arrow on top of it is two pointers.
  laser: 'none',
  eraser: 'cell',
};

/** The label field's 1px border plus its `px-1` padding. */
const LABEL_INSET = 5;

interface LabelDraft {
  point: BoardPoint;
  value: string;
}

interface BoardCanvasProps {
  /** `${attemptId}:${questionId}`. The parent keys this component by it. */
  pageKey: string;
  /** The toolbar is open: presses draw. Closed, they go through to the question. */
  interactive: boolean;
}

/**
 * One question's drawing surface. Mounted fresh for every question - the
 * parent keys it by the page - so the canvas under a new question has never
 * held the last one's ink. See `surface.ts` for the engine itself.
 */
export default function BoardCanvas({ pageKey, interactive }: BoardCanvasProps) {
  const tool = useBoardStore((state) => state.tool);
  const colorIndex = useBoardStore((state) => state.colorIndex);
  const width = useBoardStore((state) => state.width);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const surfaceRef = useRef<Surface | null>(null);
  const [label, setLabel] = useState<LabelDraft | null>(null);
  // Mirrors `label` for the commit paths that run outside a render: blur,
  // Enter, a press elsewhere, and the question going away.
  const labelRef = useRef<LabelDraft | null>(null);

  const updateLabel = useCallback((next: LabelDraft | null) => {
    labelRef.current = next;
    setLabel(next);
  }, []);

  /**
   * Turns the open field into a stroke on this page. Idempotent - blur fires
   * after Enter has already committed, and again when the field is removed -
   * because the ref is emptied before anything is written.
   */
  const commitLabel = useCallback(() => {
    const current = labelRef.current;
    if (!current) return;
    updateLabel(null);
    // Colour and size are read now, not when the field opened: picking a
    // swatch while typing restyles the label being typed.
    const { colorIndex: ink, width: size, addStroke } = useBoardStore.getState();
    const stroke = sanitizeStroke({
      id: nextStrokeId(),
      kind: 'text',
      color: currentInk(ink),
      width: size,
      points: [current.point],
      text: current.value,
    });
    if (stroke) addStroke(pageKey, stroke);
  }, [pageKey, updateLabel]);

  // A press somewhere else with a label open means "done here, now there",
  // never "throw away what I typed".
  const openLabel = useCallback((point: BoardPoint) => {
    commitLabel();
    updateLabel({ point, value: '' });
  }, [commitLabel, updateLabel]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const surface = createSurface(canvas, { pageKey, onTextRequest: openLabel });
    surfaceRef.current = surface;
    return () => {
      surface?.destroy();
      surfaceRef.current = null;
    };
  }, [openLabel, pageKey]);

  useLayoutEffect(() => {
    surfaceRef.current?.setInteractive(interactive);
  }, [interactive]);

  // A label being typed when the question changes belongs to the question it
  // was typed on - this component's page, which the cleanup still closes over.
  useEffect(() => commitLabel, [commitLabel]);

  // The browser moves focus as part of the press that opened the field, after
  // React has already mounted it; one frame later the focus sticks.
  const labelPoint = label?.point;
  useEffect(() => {
    if (!labelPoint) return;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [labelPoint]);

  return (
    <>
      {/* A canvas is a replaced element: without the explicit full width and
          height it keeps its intrinsic 300x150 and `inset-0` stops meaning
          anything. Closed, it lets every press through to the answers. */}
      <canvas
        ref={canvasRef}
        aria-hidden
        className={`absolute inset-0 z-10 block h-full w-full touch-none ${
          interactive ? 'pointer-events-auto' : 'pointer-events-none'
        }`}
        style={{ cursor: interactive ? CURSORS[tool] : undefined }}
      />
      {interactive && label && (
        <input
          ref={inputRef}
          type="text"
          value={label.value}
          maxLength={MAX_TEXT_LENGTH}
          placeholder="Label"
          aria-label="Label text"
          onChange={(event) => updateLabel({ point: label.point, value: event.target.value })}
          onBlur={commitLabel}
          onKeyDown={(event) => {
            // The board's own shortcuts must not fire while typing here.
            event.stopPropagation();
            if (event.key === 'Enter') {
              event.preventDefault();
              commitLabel();
            } else if (event.key === 'Escape') {
              event.preventDefault();
              updateLabel(null);
            }
          }}
          className="absolute z-20 min-w-[8ch] max-w-[24ch] -translate-y-1/2 rounded-lg border border-dashed border-slate-300 bg-white px-1 font-semibold leading-snug outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          style={{
            // Less the field's border and padding, so the committed label is
            // painted where the typed one stood instead of jumping left.
            left: `calc(50% + ${label.point[0] - LABEL_INSET}px)`,
            top: label.point[1],
            fontSize: textFontSize(width),
            color: currentInk(colorIndex),
          }}
        />
      )}
    </>
  );
}
