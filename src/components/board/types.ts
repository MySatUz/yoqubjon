/**
 * What crosses from the server to the Board: one question with its maths
 * already rendered, and the question bank's rows. The HTML strings come from
 * `renderMathHtml`, which escapes every plain-text segment - they are the only
 * values the Board injects.
 */

export type BoardQuestion = {
  contentHtml: string;
  /** One entry per answer choice; empty for a grid-in question. */
  optionsHtml: string[];
  /** Several choices are right, so the teacher picks a set. */
  multiSelect: boolean;
  /** A stored picture (a bank question's), or null. */
  imageUrl: string | null;
  /**
   * The file a pasted `\image{…}` names. Never uploaded: the browser matches
   * it to a chosen file by name (see `TexInput`).
   */
  imageName: string | null;
  /** The right letters of a multiple-choice question; null for a grid-in. */
  correctLetters: string[] | null;
  /** The answer key as written, rendered: what "Show answer" prints for a grid-in. */
  correctAnswerHtml: string;
};

export type BankTags = { domain: string | null; difficulty: number | null };

export type TexResult =
  | {
      ok: true;
      question: BoardQuestion;
      /** Where `\image{…}` is, for the message when its file has not been chosen. */
      imageLine: number | null;
    }
  | { ok: false; error: string; line: number | null };

export type BankRow = BankTags & {
  id: string;
  /** The stem's opening, rendered, for the row title. */
  previewHtml: string;
  isGridIn: boolean;
};

export type BankFilter = {
  query: string;
  domains: string[];
  difficulties: number[];
};

export type BankPage = {
  rows: BankRow[];
  total: number;
  /**
   * The moment the list was first searched (ISO). Every further page of it is
   * read as of then, so questions added since cannot slide in ahead of the
   * rows already loaded and shift the pages. A new search starts a new list.
   */
  asOf: string;
};

export const EMPTY_FILTER: BankFilter = { query: '', domains: [], difficulties: [] };

export type BankQuestionResult =
  | { ok: true; question: BoardQuestion; tags: BankTags }
  | { ok: false; error: string };
