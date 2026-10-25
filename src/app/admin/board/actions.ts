'use server';

import { requireAdmin } from '@/lib/admin';
import {
  MAX_TEX_LENGTH,
  parseBoardTex,
  readBankQuestion,
  searchBank,
  type BoardBankPage,
} from '@/app/admin/board/boardData';
import type {
  BankFilter,
  BankQuestionResult,
  TexResult,
} from '@/components/board/types';

/*
 * The Board's three reads. Each checks the admin itself: a server function
 * can be called by a bare POST, not only from the page. None of them writes.
 */

const NOT_ADMIN = 'Only an admin can use the board. Sign in again with an admin account.';

async function isAdmin() {
  try {
    await requireAdmin();
    return true;
  } catch {
    return false;
  }
}

/** [Show on board] for pasted text: parsed and rendered, or the parser's message and line. */
export async function showTexOnBoard(source: string): Promise<TexResult> {
  if (!await isAdmin()) return { ok: false, error: NOT_ADMIN, line: null };
  if (typeof source !== 'string') return { ok: false, error: 'Paste a question first.', line: null };
  if (source.length > MAX_TEX_LENGTH) {
    return {
      ok: false,
      error: `This is ${source.length.toLocaleString('en-US')} characters, more than one question can be. Paste one question block.`,
      line: null,
    };
  }

  try {
    return parseBoardTex(source);
  } catch (error: unknown) {
    console.error('Board .tex error:', error);
    return { ok: false, error: 'The question could not be rendered. Nothing was saved; check the text and try again.', line: null };
  }
}

/**
 * One page of the bank list; `asOf` is the first page's, for every page after
 * it. With no choices it lists nothing and returns the tile counts.
 */
export async function searchBoardBank(filter: BankFilter, offset: number, asOf?: string): Promise<BoardBankPage> {
  if (!await isAdmin()) throw new Error(NOT_ADMIN);
  return searchBank(filter, offset, asOf);
}

export async function loadBoardBankQuestion(id: string): Promise<BankQuestionResult> {
  if (!await isAdmin()) return { ok: false, error: NOT_ADMIN };
  if (typeof id !== 'string' || !id || id.length > 100) {
    return { ok: false, error: 'This question is no longer in the bank. Pick another one.' };
  }
  return readBankQuestion(id);
}
