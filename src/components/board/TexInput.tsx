"use client";

import React from 'react';
import { ImageIcon, Loader2, Presentation } from 'lucide-react';
import { Card, CardBody, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field, Textarea, labelClass, hintClass } from '@/components/ui/Field';
import { cn } from '@/components/ui/cn';

export type ChosenImage = { name: string; url: string };

/**
 * The test importer's file box (`FilePickBox`), so the two read as the same
 * control: a field's mist-400 edge, mist-500 on hover.
 */
const dropzoneClass =
  'flex h-14 min-w-0 items-center justify-center gap-2 rounded-xl border border-dashed border-mist-400 px-4 text-sm transition-colors ' +
  'group-hover:border-mist-500 group-hover:bg-mist-50 group-focus-within:border-board-600 group-focus-within:ring-1 group-focus-within:ring-board-600';

/**
 * Way in (a): one question pasted as .tex, in the test files' own format.
 * The text and the chosen pictures stay here while the board is up, so "New
 * question" comes back to them as they were.
 */
export default function TexInput({
  value,
  onChange,
  images,
  onChooseImages,
  onClearImages,
  error,
  isRendering,
  onShow,
}: {
  value: string;
  onChange: (value: string) => void;
  images: ChosenImage[];
  onChooseImages: (files: FileList) => void;
  onClearImages: () => void;
  /** The parser's message, with its line when it could be found. */
  error: { message: string; line: number | null } | null;
  isRendering: boolean;
  onShow: () => void;
}) {
  return (
    <Card>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!isRendering) onShow();
        }}
      >
        <CardBody className="space-y-5">
          <Field
            label="Question"
            htmlFor="board-tex"
            error={error ? (error.line ? `Line ${error.line}: ${error.message}` : error.message) : undefined}
            hint={
              <>
                One <code>\begin{'{question}'} … \end{'{question}'}</code> block, or only <code>\content{'{…}'}</code>,{' '}
                <code>\options{'{…}'}</code> and <code>\answer{'{…}'}</code>. Without <code>\options</code> it is a
                grid-in question.
              </>
            }
          >
            <Textarea
              id="board-tex"
              value={value}
              onChange={(event) => onChange(event.target.value)}
              onKeyDown={(event) => {
                // Ctrl+Enter shows it, as the button does, without leaving the keys.
                if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                  event.preventDefault();
                  if (!isRendering) onShow();
                }
              }}
              rows={14}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              placeholder="Paste one question here"
              className="font-mono"
            />
          </Field>

          <div className="space-y-1.5">
            <label htmlFor="board-images" className={labelClass}>
              Images
            </label>
            <div className="group relative">
              <input
                id="board-images"
                type="file"
                multiple
                accept="image/*"
                aria-describedby="board-images-hint"
                onChange={(event) => {
                  if (event.target.files?.length) onChooseImages(event.target.files);
                  // The same file chosen again after "Clear" still counts as a change.
                  event.target.value = '';
                }}
                className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
              />
              <div className={cn(dropzoneClass, images.length > 0 ? 'text-mist-900' : 'text-mist-500')}>
                <ImageIcon className="h-4 w-4 shrink-0" />
                <span className="truncate">
                  {images.length > 0 ? images.map((image) => image.name).join(', ') : 'Choose the pictures \\image{…} names'}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p id="board-images-hint" className={hintClass}>
                Matched to <code>\image{'{…}'}</code> by file name. They stay in this browser and are never uploaded.
              </p>
              {images.length > 0 && (
                <Button variant="quiet" size="sm" onClick={onClearImages}>
                  Clear images
                </Button>
              )}
            </div>
          </div>
        </CardBody>
        <CardFooter>
          <Button type="submit" disabled={isRendering || !value.trim()} title="Ctrl+Enter">
            {isRendering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Presentation className="h-4 w-4" />}
            Show on board
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
