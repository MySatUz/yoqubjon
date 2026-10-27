'use client';

import React, { useId, useRef, useState } from 'react';
import { Loader2, Search, SearchX } from 'lucide-react';
import { searchBankQuestions } from '@/app/admin/bank/actions';
import type { BankAvailability } from '@/components/admin/bank/BuildTestForm';
import { DifficultyBars, KindBadge, choiceTileClass } from '@/components/admin/bank/bankBadges';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Alert, EmptyState } from '@/components/ui/Feedback';
import { checkboxClass, hintClass, inputClass, labelClass } from '@/components/ui/Field';
import { cn } from '@/components/ui/cn';
import {
  BANK_DIFFICULTIES,
  BANK_DOMAINS,
  EMPTY_BANK_FILTERS,
  MAX_BANK_SEARCH_LENGTH,
  getDifficultyLabel,
  getDomainShortLabel,
  hasBankFilters,
  isBankDifficulty,
  isBankDomain,
  normalizeBankFilters,
  toggleValue,
  type BankFilters,
  type BankPickRow,
} from '@/lib/questionBank';

/** One search's results so far; `filters` is what was searched, so "Show more" pages the same search. */
type Listing = { filters: BankFilters; rows: BankPickRow[]; total: number; hasMore: boolean; page: number };

/**
 * The picker's search, kept by the build form so the choices and the results
 * survive closing the dialog and opening it for another module.
 *
 * Like the bank page, nothing is listed until the admin searches: ticking a
 * tile or typing only changes the choices, and Search (or Enter in the text
 * field) runs them. Loads are started by those presses, not by an effect,
 * and a slower earlier answer never overwrites a newer one.
 */
export function useBankPicker() {
  const [filters, setFilters] = useState<BankFilters>(EMPTY_BANK_FILTERS);
  const [listing, setListing] = useState<Listing | null>(null);
  /** The page being loaded: 1 for a new search, more for "Show more". */
  const [loadingPage, setLoadingPage] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);

  const load = async (next: BankFilters, page: number) => {
    const request = ++requestRef.current;
    setLoadingPage(page);
    setError(null);

    let response: Awaited<ReturnType<typeof searchBankQuestions>>;
    try {
      response = await searchBankQuestions({ filters: next, page });
    } catch {
      response = { success: false, error: 'The bank could not be searched. Check your connection and try again.' };
    }
    if (request !== requestRef.current) return;

    setLoadingPage(null);
    if (!response.success) {
      setError(response.error);
      return;
    }
    const { rows, total, hasMore } = response;
    setListing((current) => {
      // A question imported between two pages would otherwise show twice.
      const seen = new Set(page > 1 && current ? current.rows.map((row) => row.id) : []);
      return {
        filters: next,
        rows: page > 1 && current ? [...current.rows, ...rows.filter((row) => !seen.has(row.id))] : rows,
        total,
        hasMore,
        page,
      };
    });
  };

  /** Runs the choices as they are now; with no choice and no words there is nothing to run. */
  const search = () => {
    const next = normalizeBankFilters(filters);
    if (!hasBankFilters(next)) return;
    void load(next, 1);
  };

  const showMore = () => {
    if (!listing || loadingPage !== null) return;
    void load(listing.filters, listing.page + 1);
  };

  const clear = () => {
    // An answer still on its way belongs to the search being cleared.
    requestRef.current += 1;
    setFilters(EMPTY_BANK_FILTERS);
    setListing(null);
    setLoadingPage(null);
    setError(null);
  };

  return { filters, setFilters, listing, loadingPage, error, search, showMore, clear };
}

function questionCount(count: number) {
  return `${count} ${count === 1 ? 'question' : 'questions'}`;
}

/**
 * Searches the bank the way the bank page does - domain and difficulty tiles
 * with their counts, words in the question, Search - and ticks the questions
 * found into one module. A tick adds the question at the end of the module's
 * list at once - the order is the ticking order - and an untick takes it out.
 * A question another module already has cannot be ticked: no question repeats
 * in a test.
 */
export function BankPicker({
  open,
  onClose,
  title,
  picker,
  availability,
  chosen,
  onToggle,
  usedElsewhere,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  picker: ReturnType<typeof useBankPicker>;
  /** The bank's questions per domain and difficulty, for the counts on the tiles. */
  availability: BankAvailability;
  /** This module's questions, in order. */
  chosen: BankPickRow[];
  onToggle: (row: BankPickRow) => void;
  /** Question id → the module that already has it. */
  usedElsewhere: Map<string, string>;
}) {
  const fieldId = useId();
  const textRef = useRef<HTMLInputElement>(null);
  const { filters, setFilters, listing, loadingPage, error, search, showMore, clear } = picker;
  const chosenIds = new Set(chosen.map((row) => row.id));
  const canSearch = hasBankFilters(normalizeBankFilters(filters));
  const canClear = listing !== null || hasBankFilters(filters);

  // From the build page's own count of the bank: no query per tick.
  const countWhere = (match: (row: BankAvailability[number]) => boolean) =>
    availability.filter(match).reduce((total, row) => total + row.count, 0);
  const unsortedCount = countWhere((row) => row.domain === null || row.difficulty === null);
  const showUnsorted = unsortedCount > 0 || filters.unsorted;

  // The Clear button goes away with what it cleared, so focus moves to the
  // words field rather than falling out of the dialog.
  const clearSearch = () => {
    clear();
    textRef.current?.focus();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="xl"
      title={title}
      description="Search the bank, then tick questions in the order they should be asked. Ticked questions are added at the end of the list."
      footer={
        <>
          <p className="mr-auto text-sm tabular-nums text-gray-600">
            {questionCount(chosen.length)} chosen
          </p>
          <Button onClick={onClose}>Done</Button>
        </>
      }
    >
      <div className="space-y-4">
        <form
          role="search"
          aria-label="Find questions"
          onSubmit={(event) => {
            event.preventDefault();
            search();
          }}
          className="space-y-4"
        >
          <fieldset className="space-y-2">
            <legend className={labelClass}>Domain</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {BANK_DOMAINS.map((domain) => (
                <label key={domain.value} className={choiceTileClass}>
                  <input
                    type="checkbox"
                    checked={filters.domains.includes(domain.value)}
                    onChange={() => setFilters((current) => ({
                      ...current,
                      domains: toggleValue(current.domains, domain.value),
                    }))}
                    className={checkboxClass}
                  />
                  <span className="min-w-0 flex-1 text-sm font-medium text-gray-900">{domain.label}</span>
                  <span className="text-xs tabular-nums text-gray-500">
                    {countWhere((row) => row.domain === domain.value)}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className={labelClass}>Difficulty</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
              {BANK_DIFFICULTIES.map((difficulty) => (
                <label key={difficulty.value} className={choiceTileClass}>
                  <input
                    type="checkbox"
                    checked={filters.difficulties.includes(difficulty.value)}
                    onChange={() => setFilters((current) => ({
                      ...current,
                      difficulties: toggleValue(current.difficulties, difficulty.value),
                    }))}
                    className={checkboxClass}
                  />
                  <DifficultyBars level={difficulty.value} />
                  <span className="min-w-0 flex-1 text-sm font-medium text-gray-900">{difficulty.label}</span>
                  <span className="text-xs tabular-nums text-gray-500">
                    {countWhere((row) => row.difficulty === difficulty.value)}
                  </span>
                </label>
              ))}
              {/* Only while there is something to sort, or the choice is on. */}
              {showUnsorted && (
                <label className={choiceTileClass}>
                  <input
                    type="checkbox"
                    checked={filters.unsorted}
                    onChange={() => setFilters((current) => ({ ...current, unsorted: !current.unsorted }))}
                    className={checkboxClass}
                  />
                  <span className="min-w-0 flex-1 text-sm font-medium text-gray-900">Not sorted yet</span>
                  <span className="text-xs tabular-nums text-gray-500">{unsortedCount}</span>
                </label>
              )}
            </div>
          </fieldset>

          <div className="space-y-2">
            <label htmlFor={`${fieldId}-q`} className={labelClass}>Words in the question or file name</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  ref={textRef}
                  id={`${fieldId}-q`}
                  type="search"
                  value={filters.q}
                  maxLength={MAX_BANK_SEARCH_LENGTH}
                  onChange={(event) => {
                    const q = event.target.value;
                    setFilters((current) => ({ ...current, q }));
                  }}
                  placeholder="e.g. circle, f(x), geometry-set-oct"
                  autoComplete="off"
                  className={inputClass({ className: 'pl-9' })}
                />
              </div>
              <div className="flex gap-2">
                {canClear && (
                  <Button variant="secondary" onClick={clearSearch}>
                    Clear
                  </Button>
                )}
                {/* Not disabled while it searches: a focused button that turns disabled drops the focus. */}
                <Button type="submit" disabled={!canSearch}>
                  {loadingPage === 1 ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Search
                </Button>
              </div>
            </div>
            {!canSearch && (
              <p className={hintClass}>Choose a domain or a difficulty, or type words from a question.</p>
            )}
          </div>
        </form>

        {error && <Alert tone="danger">{error}</Alert>}

        {/* Always there, so the first count after a search is announced too. */}
        <p
          role="status"
          className={cn('text-sm font-semibold tabular-nums text-gray-900', !listing && 'sr-only')}
        >
          {listing
            ? listing.total === 0 ? 'No questions found' : `${questionCount(listing.total)} found`
            : loadingPage !== null ? 'Searching…' : ''}
        </p>

        {listing && (listing.rows.length === 0 ? (
          <EmptyState
            icon={<SearchX />}
            title="Nothing matches these choices"
            action={
              <Button variant="secondary" size="sm" onClick={clearSearch}>
                Clear the search
              </Button>
            }
          />
        ) : (
          // Scrolls inside the dialog, so the search stays in view.
          <div className="max-h-96 overflow-y-auto rounded-xl border border-gray-200">
            <ul className="divide-y divide-gray-100">
              {listing.rows.map((row) => {
                const ticked = chosenIds.has(row.id);
                const elsewhere = usedElsewhere.get(row.id);
                const sorted = isBankDomain(row.domain) && isBankDifficulty(row.difficulty);

                return (
                  <li key={row.id}>
                    <label
                      className={cn(
                        'flex items-start gap-3 px-4 py-3 transition-colors',
                        elsewhere ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={ticked}
                        disabled={Boolean(elsewhere)}
                        onChange={() => onToggle(row)}
                        className={cn(checkboxClass, 'mt-0.5')}
                      />
                      <span className="min-w-0 flex-1 space-y-1.5">
                        <span
                          className={cn('line-clamp-2 block text-sm', elsewhere ? 'text-gray-500' : 'text-gray-800')}
                          dangerouslySetInnerHTML={{ __html: row.previewHtml || '<span class="text-gray-500">Image only</span>' }}
                        />
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
                          <span className="inline-flex items-center gap-1.5">
                            <DifficultyBars level={row.difficulty} />
                            {isBankDifficulty(row.difficulty) && <span>{getDifficultyLabel(row.difficulty)}</span>}
                          </span>
                          {isBankDomain(row.domain) && (
                            <>
                              <span aria-hidden>·</span>
                              <span>{getDomainShortLabel(row.domain)}</span>
                            </>
                          )}
                          {!sorted && (
                            <Badge tone="warning" title={!isBankDomain(row.domain) ? 'No domain yet' : 'No difficulty yet'}>
                              Not sorted
                            </Badge>
                          )}
                          <KindBadge kind={row.kind} />
                          {row.hasImage && <Badge>Image</Badge>}
                          {elsewhere && <Badge>In {elsewhere}</Badge>}
                          {ticked && (
                            <Badge tone="accent">
                              {`#${chosen.findIndex((item) => item.id === row.id) + 1} here`}
                            </Badge>
                          )}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {listing?.hasMore && (
          <div className="flex justify-center">
            {/* Not disabled while it loads, for the same reason as Search; a second press waits for the first. */}
            <Button variant="secondary" size="sm" onClick={showMore} aria-busy={loadingPage !== null && loadingPage > 1}>
              {loadingPage !== null && loadingPage > 1 && <Loader2 className="h-4 w-4 animate-spin" />}
              {loadingPage !== null && loadingPage > 1 ? 'Loading…' : 'Show more'}
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  );
}
