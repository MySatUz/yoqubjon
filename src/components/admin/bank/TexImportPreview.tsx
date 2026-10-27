'use client';

import 'katex/dist/katex.min.css';
import React, { useId } from 'react';
import { AlertCircle, Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Feedback';
import { Select } from '@/components/ui/Field';
import { tableClass, tdClass, thClass } from '@/components/ui/List';
import { cn } from '@/components/ui/cn';
import { KindBadge } from '@/components/admin/bank/bankBadges';
import { DifficultySegments, DomainSelect } from '@/components/admin/bank/TagControls';
import type { TexCheckState } from '@/components/admin/bank/useTexCheck';
import {
  BANK_DIFFICULTIES,
  BANK_DOMAINS,
  isBankDomain,
  type BankDifficulty,
  type BankDomain,
  type QuestionTagDraft,
  type TexCheckQuestion,
} from '@/lib/questionBank';

const stickyThClass = cn(thClass, 'sticky top-0 z-10');

function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

/** The parser's messages do not all end in a full stop; a sentence follows them here. */
function asSentence(message: string) {
  const trimmed = message.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

/**
 * The import preview: every question of the checked `.tex` with the domain
 * and difficulty it will go into the bank with. Tags from the file are
 * filled in; the rest are picked here, one by one or all the unsorted ones
 * at once. Used by the course's test upload and the bank's own upload.
 */
export function TexImportPreview({
  state,
  tags,
  onTagsChange,
  modules,
  moduleError,
  missingImages,
  onRecheck,
  disabled,
}: {
  state: TexCheckState;
  tags: QuestionTagDraft[];
  onTagsChange: (tags: QuestionTagDraft[]) => void;
  /** The module each question runs in, when the test has several; null hides the column. */
  modules?: number[] | null;
  /** Why the file does not fit the chosen format, from `resolveExamModules`. */
  moduleError?: string | null;
  /** `\image{…}` names with no chosen file of that name. */
  missingImages: string[];
  onRecheck: () => void;
  disabled?: boolean;
}) {
  const helperId = useId();

  if (state.status === 'idle') return null;

  if (state.status === 'checking') {
    return (
      <p role="status" className="inline-flex items-center gap-2 text-sm text-gray-600">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking the questions in {state.fileName}…
      </p>
    );
  }

  const { result } = state;
  if (!result.success) {
    return (
      <Alert
        tone="danger"
        title="This file cannot be imported"
        action={
          <Button variant="secondary" size="sm" onClick={onRecheck} disabled={disabled}>
            <RotateCcw className="h-4 w-4" />
            Check again
          </Button>
        }
      >
        {asSentence(result.error)} Nothing was saved. Fix the file, then choose it again or check it again.
      </Alert>
    );
  }

  const { questions } = result;
  const tagged = questions.filter((question) => question.domain && question.difficulty).length;
  const withoutDomain = tags.filter((tag) => tag.domain === null).length;
  const withoutDifficulty = tags.filter((tag) => tag.difficulty === null).length;
  const showModules = Boolean(modules && new Set(modules).size > 1);

  const setTag = (index: number, patch: Partial<QuestionTagDraft>) => {
    onTagsChange(tags.map((tag, position) => (position === index ? { ...tag, ...patch } : tag)));
  };

  const setAllUnsorted = (patch: { domain?: BankDomain; difficulty?: BankDifficulty }) => {
    onTagsChange(tags.map((tag) => ({
      domain: tag.domain ?? patch.domain ?? null,
      difficulty: tag.difficulty ?? patch.difficulty ?? null,
    })));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-sm text-gray-700">
          <span className="font-medium text-gray-900">{plural(questions.length, 'question')}</span>
          {' '}in {result.fileName} · {tagged === questions.length
            ? 'all tagged in the file'
            : `${tagged} tagged in the file`}
        </p>
        <Button variant="quiet" size="sm" onClick={onRecheck} disabled={disabled}>
          <RotateCcw className="h-4 w-4" />
          Check again
        </Button>
      </div>

      {moduleError && <Alert tone="danger">{moduleError}</Alert>}

      {missingImages.length > 0 && (
        <Alert tone="danger">
          The file asks for {plural(missingImages.length, 'image')} that {missingImages.length === 1 ? 'is' : 'are'} not
          chosen: {missingImages.slice(0, 6).join(', ')}{missingImages.length > 6 ? ` and ${missingImages.length - 6} more` : ''}.
          Add {missingImages.length === 1 ? 'it' : 'them'} under Images.
        </Alert>
      )}

      {(withoutDomain > 0 || withoutDifficulty > 0) && (
        // The quick way through a file without tags: everything still
        // unsorted gets one value, and the odd ones are changed in their rows.
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl bg-gray-50 px-3.5 py-3">
          {withoutDomain > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
              <span id={`${helperId}-domain`}>Set the {plural(withoutDomain, 'question')} without a domain to</span>
              <Select
                aria-labelledby={`${helperId}-domain`}
                value=""
                disabled={disabled}
                onChange={(event) => {
                  if (isBankDomain(event.target.value)) setAllUnsorted({ domain: event.target.value });
                }}
                className="w-60"
              >
                <option value="">Choose domain</option>
                {BANK_DOMAINS.map((domain) => (
                  <option key={domain.value} value={domain.value}>{domain.label}</option>
                ))}
              </Select>
            </div>
          )}
          {withoutDifficulty > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
              <span>Set the {plural(withoutDifficulty, 'question')} without a difficulty to</span>
              {BANK_DIFFICULTIES.map((difficulty) => (
                <Button
                  key={difficulty.value}
                  variant="quiet"
                  size="sm"
                  disabled={disabled}
                  onClick={() => setAllUnsorted({ difficulty: difficulty.value })}
                >
                  {difficulty.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Scrolls inside its own frame: a 44-question file would otherwise
          push the rest of the form a page down. */}
      <div className="max-h-112 overflow-auto rounded-xl border border-gray-200">
        <table className={tableClass}>
          <thead>
            <tr>
              <th scope="col" className={cn(stickyThClass, 'w-12')}>#</th>
              {showModules && <th scope="col" className={stickyThClass}>Module</th>}
              <th scope="col" className={stickyThClass}>Question</th>
              <th scope="col" className={stickyThClass}>Domain</th>
              <th scope="col" className={stickyThClass}>Difficulty</th>
            </tr>
          </thead>
          <tbody className="[&>tr:last-child>td]:border-b-0">
            {questions.map((question, index) => (
              <PreviewRow
                key={question.order}
                question={question}
                tag={tags[index] ?? { domain: null, difficulty: null }}
                module={showModules ? modules?.[index] ?? null : null}
                showModules={showModules}
                imageMissing={Boolean(question.image && missingImages.includes(question.image))}
                onChange={(patch) => setTag(index, patch)}
                disabled={disabled}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PreviewRow({
  question,
  tag,
  module,
  showModules,
  imageMissing,
  onChange,
  disabled,
}: {
  question: TexCheckQuestion;
  tag: QuestionTagDraft;
  module: number | null;
  showModules: boolean;
  imageMissing: boolean;
  onChange: (patch: Partial<QuestionTagDraft>) => void;
  disabled?: boolean;
}) {
  // What the file wrote, said only while it is still unresolved: once the
  // admin picks a value, the unknown tag no longer matters.
  const unknownDomain = tag.domain === null && question.domainTag ? question.domainTag : null;
  const unknownDifficulty = tag.difficulty === null && question.difficultyTag ? question.difficultyTag : null;

  return (
    <tr className="align-top">
      <td className={cn(tdClass, 'tabular-nums text-gray-500')}>{question.order}</td>
      {showModules && <td className={cn(tdClass, 'tabular-nums')}>{module ?? '—'}</td>}
      <td className={tdClass}>
        <div className="min-w-56 max-w-md space-y-1">
          <div
            className="line-clamp-2 text-gray-800"
            dangerouslySetInnerHTML={{ __html: question.previewHtml || '<span class="text-gray-500">Image only</span>' }}
          />
          {(question.image || question.kind !== 'choice') && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
              <KindBadge kind={question.kind} />
              {question.image && (
                imageMissing ? (
                  <span className="inline-flex items-center gap-1 text-red-600">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Image {question.image} not chosen
                  </span>
                ) : (
                  <span>Image {question.image}</span>
                )
              )}
            </div>
          )}
        </div>
      </td>
      <td className={tdClass}>
        <div className="w-60 space-y-1">
          <DomainSelect
            value={tag.domain}
            onChange={(domain) => onChange({ domain })}
            aria-label={`Question ${question.order} domain`}
            invalid={Boolean(unknownDomain)}
            disabled={disabled}
          />
          {unknownDomain && (
            <p className="text-xs text-red-600">Unknown domain &lsquo;{unknownDomain}&rsquo;</p>
          )}
        </div>
      </td>
      <td className={tdClass}>
        <div className="space-y-1">
          <DifficultySegments
            value={tag.difficulty}
            onChange={(difficulty) => onChange({ difficulty })}
            aria-label={`Question ${question.order} difficulty`}
            disabled={disabled}
          />
          {unknownDifficulty && (
            <p className="text-xs text-red-600">Unknown difficulty &lsquo;{unknownDifficulty}&rsquo;</p>
          )}
        </div>
      </td>
    </tr>
  );
}

/**
 * Why an import cannot start yet, in the order the admin meets the causes;
 * null once it can. Shown beside the disabled button.
 */
export function describeImportBlocker({
  state,
  untagged,
  missingImages,
  moduleError,
}: {
  state: TexCheckState;
  untagged: number;
  missingImages: string[];
  moduleError?: string | null;
}) {
  if (state.status === 'idle') return 'Choose a .tex file first.';
  if (state.status === 'checking') return 'Checking the questions…';
  if (!state.result.success) return 'Fix the file and check it again.';
  if (moduleError) return 'The file does not fit this format.';
  if (missingImages.length > 0) {
    return `${plural(missingImages.length, 'image')} still to choose.`;
  }
  if (untagged > 0) {
    return `${plural(untagged, 'question')} still ${untagged === 1 ? 'needs' : 'need'} a domain and a difficulty.`;
  }
  return null;
}
