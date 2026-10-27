"use client";

import React from 'react';
import Link from 'next/link';
import { ChevronRight, Library, Loader2, Search, SearchX, X } from 'lucide-react';
import 'katex/dist/katex.min.css';
import type { BankCounts } from '@/app/admin/board/boardData';
import type { BankFilter, BankRow } from '@/components/board/types';
import { DifficultyBars, choiceTileClass } from '@/components/admin/bank/bankBadges';
import { Badge } from '@/components/ui/Badge';
import { Button, buttonClass, iconButtonClass } from '@/components/ui/Button';
import { cardClass } from '@/components/ui/Card';
import { Alert, EmptyState } from '@/components/ui/Feedback';
import { checkboxClass, inputClass, labelClass } from '@/components/ui/Field';
import { List, listRowInteractiveClass, rowChevronClass } from '@/components/ui/List';
import { cn } from '@/components/ui/cn';
import {
  BANK_DIFFICULTIES,
  BANK_DOMAINS,
  MAX_BANK_SEARCH_LENGTH,
  getDifficultyLabel,
  getDomainShortLabel,
  isBankDifficulty,
  isBankDomain,
} from '@/lib/questionBank';

function formatCount(count: number) {
  return `${count} ${count === 1 ? 'question' : 'questions'}`;
}

/** A tile's count, once the bank's counts are known. */
function TileCount({ value }: { value: number | undefined }) {
  if (value === undefined) return null;
  return <span className="text-xs tabular-nums text-gray-500">{value}</span>;
}

/**
 * Way in (b): a question from the bank. Like the bank page (and the College
 * Board's educator bank) it opens on the search, not on a list: domain and
 * difficulty tiles, words from the question, and Search. Nothing is listed
 * before that. Picking a found row puts that question on the board, and
 * "Next question" there walks on down this same search.
 */
export default function BankPicker({
  filter,
  rows,
  total,
  hasSearched,
  needsChoice,
  bankTotal,
  counts,
  isSearching,
  isLoadingMore,
  error,
  pickError,
  pendingId,
  onQueryChange,
  onToggleDomain,
  onToggleDifficulty,
  onClearFilter,
  onSearch,
  onRetry,
  onLoadMore,
  onPick,
}: {
  /** The choices on the search card, not yet searched until Search is pressed. */
  filter: BankFilter;
  rows: BankRow[];
  /** How many questions the last search matched. */
  total: number;
  /** Search was pressed with something chosen: the results show. */
  hasSearched: boolean;
  /** Search was pressed with nothing chosen. */
  needsChoice: boolean;
  /** Questions in the whole bank; null while unknown. */
  bankTotal: number | null;
  /** The whole bank per tile; null while unknown, and the tiles go without. */
  counts: BankCounts | null;
  isSearching: boolean;
  isLoadingMore: boolean;
  error: string | null;
  /** Why the picked question could not be opened. */
  pickError: string | null;
  /** The row whose question is on its way. */
  pendingId: string | null;
  onQueryChange: (query: string) => void;
  onToggleDomain: (domain: string) => void;
  onToggleDifficulty: (difficulty: number) => void;
  onClearFilter: () => void;
  onSearch: () => void;
  onRetry: () => void;
  onLoadMore: () => void;
  onPick: (index: number) => void;
}) {
  const hasChoices = filter.query.trim() !== '' || filter.domains.length > 0 || filter.difficulties.length > 0;

  if (bankTotal === 0) {
    return (
      <EmptyState
        icon={<Library />}
        title="The question bank is empty"
        description="Questions arrive with every imported test."
        action={
          <Link href="/admin/bank" className={buttonClass({ variant: 'secondary' })}>
            Open the question bank
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <form
        role="search"
        aria-label="Find questions"
        className={cardClass}
        onSubmit={(event) => {
          event.preventDefault();
          onSearch();
        }}
      >
        <div className="space-y-5 p-5">
          <fieldset className="space-y-2">
            <legend className={labelClass}>Domain</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 2xl:grid-cols-4">
              {BANK_DOMAINS.map((domain) => (
                <label key={domain.value} className={choiceTileClass}>
                  <input
                    type="checkbox"
                    checked={filter.domains.includes(domain.value)}
                    onChange={() => onToggleDomain(domain.value)}
                    className={checkboxClass}
                  />
                  <span className="min-w-0 flex-1 text-sm font-medium text-gray-900">{domain.label}</span>
                  <TileCount value={counts ? counts.domains[domain.value] ?? 0 : undefined} />
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className={labelClass}>Difficulty</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {BANK_DIFFICULTIES.map((difficulty) => (
                <label key={difficulty.value} className={choiceTileClass}>
                  <input
                    type="checkbox"
                    checked={filter.difficulties.includes(difficulty.value)}
                    onChange={() => onToggleDifficulty(difficulty.value)}
                    className={checkboxClass}
                  />
                  <DifficultyBars level={difficulty.value} />
                  <span className="min-w-0 flex-1 text-sm font-medium text-gray-900">{difficulty.label}</span>
                  <TileCount value={counts ? counts.difficulties[difficulty.value] ?? 0 : undefined} />
                </label>
              ))}
            </div>
          </fieldset>

          <div className="space-y-2">
            <label htmlFor="board-bank-search" className={labelClass}>Words in the question or file name</label>
            <div className="relative max-w-xl">
              <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                id="board-bank-search"
                type="text"
                enterKeyHint="search"
                value={filter.query}
                onChange={(event) => onQueryChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape' && filter.query) {
                    event.preventDefault();
                    onQueryChange('');
                  }
                }}
                maxLength={MAX_BANK_SEARCH_LENGTH}
                placeholder="e.g. circle, f(x), geometry-set-oct"
                autoComplete="off"
                // Room for the clear button, which grows to h-10 on a coarse pointer.
                className={inputClass({ className: 'pl-9 pr-9 pointer-coarse:pr-11' })}
              />
              {filter.query && (
                <button
                  type="button"
                  onClick={() => onQueryChange('')}
                  aria-label="Clear the words"
                  className={iconButtonClass({ size: 'sm', className: 'absolute right-0.5 top-1/2 -translate-y-1/2' })}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 px-5 py-3">
          <p className="mr-auto text-xs tabular-nums text-gray-500" role="status">
            {needsChoice
              ? 'Choose a domain or a difficulty, or type words, then search.'
              : bankTotal !== null
                ? `${formatCount(bankTotal)} in the bank`
                : null}
          </p>
          {(hasChoices || hasSearched) && (
            <Button variant="secondary" onClick={onClearFilter}>
              Clear
            </Button>
          )}
          <Button type="submit">
            {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Search
          </Button>
        </div>
      </form>

      {error && (
        <Alert
          tone="danger"
          action={
            <Button variant="secondary" size="sm" onClick={onRetry}>
              Try again
            </Button>
          }
        >
          {error}
        </Alert>
      )}
      {pickError && <Alert tone="danger">{pickError}</Alert>}

      {hasSearched && (
        <section aria-labelledby="board-bank-results" className="space-y-3">
          <h2
            id="board-bank-results"
            aria-live="polite"
            className="flex items-center gap-2 text-base font-semibold tabular-nums text-gray-900"
          >
            {isSearching && <Loader2 aria-hidden className="h-4 w-4 animate-spin text-gray-500" />}
            {isSearching ? 'Searching' : total === 0 ? 'No questions found' : `${formatCount(total)} found`}
          </h2>

          {rows.length > 0 ? (
            <List className={isSearching ? 'pointer-events-none' : undefined}>
              {rows.map((row, index) => {
                const hasDomain = isBankDomain(row.domain);
                const hasDifficulty = isBankDifficulty(row.difficulty);
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => onPick(index)}
                      disabled={pendingId !== null}
                      aria-busy={pendingId === row.id || undefined}
                      className={cn(listRowInteractiveClass, 'group w-full text-left disabled:cursor-wait')}
                    >
                      {/* Spans, not blocks: a button holds phrasing content only. */}
                      <span className="block min-w-0 flex-1">
                        <span
                          className="block truncate text-sm font-medium text-gray-900"
                          dangerouslySetInnerHTML={{ __html: row.previewHtml }}
                        />
                        <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
                          <DifficultyBars level={row.difficulty} />
                          {hasDifficulty && <span>{getDifficultyLabel(row.difficulty)}</span>}
                          {hasDomain && (
                            <>
                              {hasDifficulty && <span aria-hidden>·</span>}
                              <span>{getDomainShortLabel(row.domain)}</span>
                            </>
                          )}
                          {(!hasDomain || !hasDifficulty) && (
                            <Badge tone="warning" title={!hasDomain ? 'No domain yet' : 'No difficulty yet'}>
                              Not sorted
                            </Badge>
                          )}
                          {row.isGridIn && <Badge>Grid-in</Badge>}
                        </span>
                      </span>
                      {pendingId === row.id ? (
                        <Loader2 aria-hidden className="h-4 w-4 shrink-0 animate-spin text-gray-500" />
                      ) : (
                        <ChevronRight aria-hidden className={rowChevronClass} />
                      )}
                    </button>
                  </li>
                );
              })}
            </List>
          ) : !isSearching && !error ? (
            <EmptyState
              icon={<SearchX />}
              title="Nothing matches these choices"
              action={
                <Button variant="secondary" size="sm" onClick={onClearFilter}>
                  Clear the search
                </Button>
              }
            />
          ) : null}

          {rows.length < total && (
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="secondary" onClick={onLoadMore} disabled={isLoadingMore || isSearching}>
                {isLoadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                Show more
              </Button>
              {/* On the gray-100 canvas, where gray-500 misses AA. */}
              <span className="text-xs tabular-nums text-gray-600">
                {rows.length} of {total}
              </span>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
