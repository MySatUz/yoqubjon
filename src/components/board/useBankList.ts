"use client";

import { useCallback, useRef, useState } from 'react';
import { searchBoardBank } from '@/app/admin/board/actions';
import type { BankCounts, BoardBankPage } from '@/app/admin/board/boardData';
import { EMPTY_FILTER, type BankFilter, type BankPage, type BankRow } from '@/components/board/types';

const LOAD_ERROR = 'The question bank could not be loaded. Check the connection and try again.';
const NO_RESULTS: BankPage = { rows: [], total: 0, asOf: '' };

function toggle<T>(list: T[], value: T) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function isEmptyFilter(filter: BankFilter) {
  return filter.query.trim() === '' && filter.domains.length === 0 && filter.difficulties.length === 0;
}

/**
 * The bank search the Board picks from, and walks with "Next question". As on
 * the bank page it opens on the choices alone: the tiles and the words are a
 * draft, and nothing is listed until Search is pressed with at least one
 * choice or some words. The rows loaded so far and the total they match
 * belong to that search; changing a tile afterwards leaves them, and "Next
 * question", alone until the next Search. A reply that comes back after a
 * newer search is dropped.
 */
export function useBankList(initial: BoardBankPage | null) {
  const [filter, setFilter] = useState<BankFilter>(EMPTY_FILTER);
  // An empty `asOf` reads as "now" on the server; with no rows it is never sent.
  const [list, setList] = useState<BankPage>(NO_RESULTS);
  const [hasSearched, setHasSearched] = useState(false);
  // Search was pressed with nothing chosen: the card says what it needs.
  const [needsChoice, setNeedsChoice] = useState(false);
  // The whole bank, read with the page (the read with no choices); null while unknown.
  const [bankTotal, setBankTotal] = useState<number | null>(initial ? initial.total : null);
  const [counts, setCounts] = useState<BankCounts | null>(initial?.counts ?? null);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(initial ? null : LOAD_ERROR);
  const requestRef = useRef(0);
  // The last search asked for, for "Try again"; null reads the bank's size again.
  const requestedRef = useRef<BankFilter | null>(null);
  // The list as last loaded, for `loadMore` to append to without waiting for a render.
  const rowsRef = useRef<BankRow[]>([]);
  // The search those rows answer: more of the same list, whatever the tiles say now.
  const loadedFilterRef = useRef<BankFilter>(EMPTY_FILTER);
  // When those rows were first searched: every further page is read as of
  // then, so questions added since cannot push the pages back onto rows
  // already loaded (see `searchBank`).
  const asOfRef = useRef('');

  const search = useCallback(async (next: BankFilter | null) => {
    const id = ++requestRef.current;
    requestedRef.current = next;
    setIsSearching(true);
    try {
      const page = await searchBoardBank(next ?? EMPTY_FILTER, 0);
      if (id !== requestRef.current) return;
      if (page.counts) {
        setCounts(page.counts);
        setBankTotal(page.total);
      }
      if (next) {
        rowsRef.current = page.rows;
        loadedFilterRef.current = next;
        asOfRef.current = page.asOf;
        setList({ rows: page.rows, total: page.total, asOf: page.asOf });
      }
      setError(null);
    } catch {
      if (id === requestRef.current) setError(LOAD_ERROR);
    } finally {
      if (id === requestRef.current) setIsSearching(false);
    }
  }, []);

  /** The draft changed: the card's "choose something" note has done its job. */
  const editFilter = (next: BankFilter) => {
    setFilter(next);
    setNeedsChoice(false);
  };

  const setQuery = (query: string) => editFilter({ ...filter, query });
  const toggleDomain = (domain: string) => editFilter({ ...filter, domains: toggle(filter.domains, domain) });
  const toggleDifficulty = (difficulty: number) =>
    editFilter({ ...filter, difficulties: toggle(filter.difficulties, difficulty) });

  /** The search card back to nothing chosen and nothing listed, as the bank page's Clear. */
  const clearResults = () => {
    requestRef.current += 1;
    requestedRef.current = null;
    rowsRef.current = [];
    loadedFilterRef.current = EMPTY_FILTER;
    asOfRef.current = '';
    setList(NO_RESULTS);
    setHasSearched(false);
    setIsSearching(false);
  };

  const clearFilter = () => {
    clearResults();
    setFilter(EMPTY_FILTER);
    setNeedsChoice(false);
    // A failed search is gone with it; a bank that could not be read is not.
    setError(bankTotal === null ? LOAD_ERROR : null);
  };

  /** [Search]: the draft as it stands; with nothing chosen it lists nothing, as on the bank page. */
  const submit = () => {
    const next = { ...filter, query: filter.query.trim() };
    if (isEmptyFilter(next)) {
      clearResults();
      setNeedsChoice(true);
      return;
    }
    setNeedsChoice(false);
    setHasSearched(true);
    void search(next);
  };

  const retry = () => void search(requestedRef.current);

  /** The next page appended; the whole list after it, or null when it failed or a search replaced it. */
  const loadMore = useCallback(async (): Promise<BankRow[] | null> => {
    const id = requestRef.current;
    if (rowsRef.current.length === 0) return null;
    setIsLoadingMore(true);
    try {
      const page = await searchBoardBank(loadedFilterRef.current, rowsRef.current.length, asOfRef.current);
      if (id !== requestRef.current) return null;
      const known = new Set(rowsRef.current.map((row) => row.id));
      const rows = [...rowsRef.current, ...page.rows.filter((row) => !known.has(row.id))];
      rowsRef.current = rows;
      setList({ rows, total: page.total, asOf: asOfRef.current });
      return rows;
    } catch {
      return null;
    } finally {
      setIsLoadingMore(false);
    }
  }, []);

  return {
    filter,
    rows: list.rows,
    total: list.total,
    hasSearched,
    needsChoice,
    bankTotal,
    counts,
    isSearching,
    isLoadingMore,
    error,
    setQuery,
    toggleDomain,
    toggleDifficulty,
    clearFilter,
    submit,
    retry,
    loadMore,
  };
}
