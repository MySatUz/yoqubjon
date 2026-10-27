'use client';

import React from 'react';
import { labelClass } from '@/components/ui/Field';
import { cn } from '@/components/ui/cn';

/**
 * The hidden file input covers the whole box, so a click anywhere opens the
 * picker. Focus is the accent of `fieldFocusClass`, on the box, because the
 * focused input itself is invisible. A box that holds a choice says it in
 * gray-900; an empty one reads like a placeholder.
 */
const dropzoneClass =
  'flex h-14 min-w-0 items-center justify-center gap-2 rounded-xl border border-dashed border-gray-400 px-4 text-sm transition-colors '
  + 'group-hover:border-gray-500 group-hover:bg-gray-50 group-focus-within:border-ink-600 group-focus-within:ring-1 group-focus-within:ring-ink-600';

/** One file picker of an import form: the `.tex`, or its images. */
export function FilePickBox({
  id,
  name,
  label,
  accept,
  multiple,
  required,
  disabled,
  icon,
  summary,
  placeholder,
  inputRef,
  onFiles,
}: {
  id: string;
  name: string;
  label: React.ReactNode;
  accept: string;
  multiple?: boolean;
  required?: boolean;
  disabled?: boolean;
  icon: React.ReactNode;
  /** What is chosen, e.g. "main.tex" or "12 images selected"; null while nothing is. */
  summary: string | null;
  placeholder: string;
  inputRef?: React.Ref<HTMLInputElement>;
  onFiles: (files: File[]) => void;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <label htmlFor={id} className={labelClass}>{label}</label>
      <div className="group relative">
        <input
          ref={inputRef}
          id={id}
          name={name}
          type="file"
          accept={accept}
          multiple={multiple}
          required={required}
          disabled={disabled}
          onChange={(event) => onFiles(Array.from(event.target.files ?? []))}
          className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />
        <div className={cn(dropzoneClass, summary ? 'text-gray-900' : 'text-gray-500')}>
          <span className="shrink-0 [&_svg]:h-4 [&_svg]:w-4">{icon}</span>
          <span className="truncate">{summary ?? placeholder}</span>
        </div>
      </div>
    </div>
  );
}
