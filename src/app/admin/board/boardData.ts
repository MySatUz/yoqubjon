import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { renderMathHtml } from '@/lib/renderMathHtml';
import { tokenizeMathText } from '@/lib/mathTokens';
import { isMultiSelectKey, parseAnswerLetters } from '@/lib/resultAnswers';
import { parseTexFile } from '@/lib/texParser';
import { isBankDifficulty, isBankDomain } from '@/lib/questionBank';
import { optionAsMath } from '@/components/exam/optionMath';
import type {
  BankFilter,
  BankPage,
  BankQuestionResult,
  BankTags,
  BoardQuestion,
  TexResult,
} from '@/components/board/types';

/*
 * The Board's server half: a pasted .tex question or a bank question, turned
 * into the same rendered HTML the exam ships (see `@/lib/examQuestions`).
 * Nothing here writes anything: the Board saves nothing.
 *
 * Server-only - Prisma and KaTeX. Called from `page.tsx` and `actions.ts`,
 * which both check the admin first.
 */

/** Far past any one question; a whole test file pasted by mistake stops here. */
export const MAX_TEX_LENGTH = 50_000;
export const BANK_PAGE_SIZE = 40;
const PREVIEW_CHARS = 150;

function readOptions(options: unknown) {
  return Array.isArray(options)
    ? options.filter((option): option is string => typeof option === 'string')
    : [];
}

function toBoardQuestion(input: {
  content: string;
  options: string[];
  correctAnswer: string;
  imageUrl: string | null;
  imageName: string | null;
}): BoardQuestion {
  const letters = input.options.length > 0 ? parseAnswerLetters(input.correctAnswer) : null;
  return {
    contentHtml: renderMathHtml(input.content),
    // As on the test: a choice that is only a number is set in KaTeX.
    optionsHtml: input.options.map((option) => renderMathHtml(optionAsMath(option))),
    multiSelect: isMultiSelectKey(input.correctAnswer),
    imageUrl: input.imageUrl,
    imageName: input.imageName,
    correctLetters: letters ? [...new Set(letters)] : null,
    // `3/4` stands stacked, as the grid-in preview draws it.
    correctAnswerHtml: renderMathHtml(optionAsMath(input.correctAnswer)),
  };
}

/* --------------------------------------------------------------- .tex */

function lineAt(text: string, index: number) {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i++) {
    if (text[i] === '\n') line++;
  }
  return line;
}

function isEscaped(value: string, index: number) {
  let slashes = 0;
  for (let i = index - 1; i >= 0 && value[i] === '\\'; i--) slashes++;
  return slashes % 2 === 1;
}

/** The inside of a command's braces, and where the command itself starts. */
type Span = { at: number; start: number; end: number; closed: boolean };

/** Where `\name{…}` sits in the text: the inside of its braces, matched as the parser matches them. */
function findCommand(text: string, name: string): Span | null {
  const match = new RegExp(`\\\\${name}\\s*\\{`).exec(text);
  if (!match) return null;
  const start = match.index + match[0].length;
  let depth = 1;
  let i = start;
  while (i < text.length && depth > 0) {
    if (text[i] === '{' && !isEscaped(text, i)) depth++;
    else if (text[i] === '}' && !isEscaped(text, i)) depth--;
    i++;
  }
  return { at: match.index, start, end: depth === 0 ? i - 1 : text.length, closed: depth === 0 };
}

/** The line option `letter` starts on: its `B)` label or its `\item`, the parser's two ways of starting one. */
function optionLine(text: string, options: Span, letter: string) {
  const inside = text.slice(options.start, options.end);
  const wanted = letter.charCodeAt(0) - 65;
  let seen = -1;
  let offset = 0;
  for (const line of inside.split('\n')) {
    if (/^\s*[A-Ha-h]\s*[:.)]/.test(line) || /^\s*\\item\b/.test(line)) {
      seen++;
      if (seen === wanted) return lineAt(text, options.start + offset);
    }
    offset += line.length + 1;
  }
  return lineAt(text, options.at);
}

/** The opening `$`, `$$`, `\(` or `\[` that is never closed, as the parser reads them; -1 when all close. */
function unclosedMath(value: string) {
  const pairs: Array<[string, string]> = [['\\[', '\\]'], ['\\(', '\\)'], ['$$', '$$'], ['$', '$']];
  let i = 0;
  while (i < value.length) {
    const pair = pairs.find(([open]) => value.startsWith(open, i) && (open[0] !== '$' || !isEscaped(value, i)));
    if (!pair) {
      i++;
      continue;
    }
    const [open, close] = pair;
    let end = value.indexOf(close, i + open.length);
    while (end !== -1 && isEscaped(value, end)) end = value.indexOf(close, end + close.length);
    if (end === -1) return i;
    i = end + close.length;
  }
  return -1;
}

/** The line a parser message is about, found from the field it names. */
function locateError(text: string, message: string): number | null {
  const begin = text.indexOf('\\begin{question}');
  const content = findCommand(text, 'content');
  const options = findCommand(text, 'options');
  const answer = findCommand(text, 'answer');

  if (/missing \\content|missing \\answer/.test(message)) return begin >= 0 ? lineAt(text, begin) : 1;
  if (/only one option/.test(message)) return options ? lineAt(text, options.at) : null;
  if (/ answer /.test(message) && !/invalid math/.test(message)) return answer ? lineAt(text, answer.at) : null;

  const field = /invalid math in (content|option ([A-H])|answer)/.exec(message);
  if (field) {
    if (field[1] === 'content') return content ? lineAt(text, content.at) : null;
    if (field[1] === 'answer') return answer ? lineAt(text, answer.at) : null;
    return options ? optionLine(text, options, field[2]) : null;
  }

  // "Missing closing $ ...": the parser does not say where, so the fields are
  // scanned the way it scans them, and the line is the unclosed opener's.
  if (/^Missing closing/.test(message)) {
    for (const span of [content, options, answer]) {
      if (!span) continue;
      const open = unclosedMath(text.slice(span.start, span.end));
      if (open >= 0) return lineAt(text, span.start + open);
    }
  }
  return null;
}

/** The parser counts questions; the board only ever has one, so "Question 1" goes. */
function tidyMessage(message: string) {
  return message
    .replace(/^Question \d+ answer /, 'The answer ')
    .replace(/^Question \d+ /, 'The question ');
}

const BEGIN = '\\begin{question}';
const END = '\\end{question}';

/**
 * One pasted question, parsed by the test importer's own parser, so what
 * shows on the board is what the same text would show in a test. Bare
 * `\content{}` / `\options{}` / `\answer{}` are wrapped in a question block:
 * the opening tag on the first line, so every line number still matches the
 * field, and the closing tag on a line of its own, so a `%` comment on the
 * last pasted line cannot swallow it.
 */
export function parseBoardTex(source: string): TexResult {
  const text = source.replace(/\r\n?/g, '\n');
  if (!text.trim()) {
    return { ok: false, error: 'Paste a question first.', line: null };
  }

  const beginAt = text.indexOf(BEGIN);
  const endAt = text.indexOf(END);
  if (beginAt === -1 && endAt !== -1) {
    return { ok: false, error: 'This \\end{question} has no \\begin{question} before it.', line: lineAt(text, endAt) };
  }
  if (beginAt !== -1 && text.indexOf(END, beginAt) === -1) {
    return { ok: false, error: 'This \\begin{question} has no \\end{question} after it.', line: lineAt(text, beginAt) };
  }

  // A field whose braces never close is read by the parser as no field at
  // all - choices that vanish into a grid-in - so it is stopped here, with
  // its line. Only inside the question: braces after it are not its own.
  const ownText = beginAt === -1 ? text : text.slice(0, text.indexOf(END, beginAt));
  for (const name of ['content', 'options', 'answer', 'image']) {
    const field = findCommand(ownText, name);
    if (field && !field.closed) {
      return {
        ok: false,
        error: `The braces of \\${name}{…} do not close. Check for a missing }.`,
        line: lineAt(text, field.at),
      };
    }
  }

  const block = beginAt === -1 ? `${BEGIN}${text}\n${END}` : text;

  let questions;
  try {
    questions = parseTexFile(block).questions;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'The text could not be read as a question.';
    return { ok: false, error: tidyMessage(message), line: locateError(text, message) };
  }

  if (questions.length === 0) {
    return {
      ok: false,
      error: 'No question found. Paste one \\begin{question} … \\end{question} block, or \\content{…} with \\answer{…}.',
      line: null,
    };
  }
  if (questions.length > 1) {
    const second = text.indexOf(BEGIN, text.indexOf(END, beginAt) + END.length);
    return {
      ok: false,
      error: `This text has ${questions.length} questions. The board shows one at a time: paste one block.`,
      line: second >= 0 ? lineAt(text, second) : null,
    };
  }

  const [question] = questions;
  const image = findCommand(text, 'image');
  return {
    ok: true,
    question: toBoardQuestion({
      content: question.content,
      options: question.options,
      correctAnswer: question.correctAnswer,
      imageUrl: null,
      imageName: question.image || null,
    }),
    imageLine: image ? lineAt(text, image.at) : null,
  };
}

/* --------------------------------------------------------------- bank */

/**
 * The stem's opening as one line of source, for a row title: text with its
 * line breaks folded, display maths set inline, cut at a word near
 * `PREVIEW_CHARS` and never inside a formula, so it renders whole.
 */
function previewSource(content: string) {
  let out = '';
  let length = 0;
  for (const token of tokenizeMathText(content)) {
    if (token.type === 'text') {
      const value = token.value.replace(/\s+/g, ' ');
      if (length + value.length > PREVIEW_CHARS) {
        let cut = value.slice(0, Math.max(0, PREVIEW_CHARS - length));
        const space = cut.lastIndexOf(' ');
        if (space > cut.length / 2) cut = cut.slice(0, space);
        // A lone backslash left at the cut would escape the ellipsis.
        return `${out}${cut.replace(/\\+$/, '').trimEnd()}…`;
      }
      out += value;
      length += value.length;
      continue;
    }
    const formula = token.value.replace(/\s+/g, ' ').trim();
    // A formula counts at about half its source: `\frac{1}{2}` draws as one glyph wide.
    const weight = Math.ceil(formula.length / 2);
    if (length > 0 && length + weight > PREVIEW_CHARS) return `${out.trimEnd()} …`;
    out += `\\(${formula}\\)`;
    length += weight;
  }
  return out.trim();
}

/** How many questions the whole bank holds per domain and per difficulty, for the search tiles. */
export type BankCounts = {
  domains: Record<string, number>;
  difficulties: Record<number, number>;
};

/** A page of the Board's bank search; the read with no choices carries the tile counts instead of rows. */
export type BoardBankPage = BankPage & { counts?: BankCounts };

function cleanFilter(filter: BankFilter): BankFilter {
  return {
    query: typeof filter?.query === 'string' ? filter.query.trim().slice(0, 200) : '',
    domains: Array.isArray(filter?.domains) ? filter.domains.filter(isBankDomain) : [],
    difficulties: Array.isArray(filter?.difficulties) ? filter.difficulties.filter(isBankDifficulty) : [],
  };
}

function isEmptyFilter(filter: BankFilter) {
  return filter.query === '' && filter.domains.length === 0 && filter.difficulties.length === 0;
}

function bankWhere(filter: BankFilter): Prisma.BankQuestionWhereInput {
  const { query, domains, difficulties } = cleanFilter(filter);
  return {
    ...(domains.length > 0 ? { domain: { in: domains } } : {}),
    ...(difficulties.length > 0 ? { difficulty: { in: difficulties } } : {}),
    ...(query
      ? {
          OR: [
            { content: { contains: query, mode: 'insensitive' as const } },
            { source: { contains: query, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };
}

/** The page's `asOf` back as a date; anything unreadable starts the list now. */
function readAsOf(asOf: unknown) {
  const date = typeof asOf === 'string' ? new Date(asOf) : null;
  return date && !Number.isNaN(date.getTime()) ? date : new Date();
}

/**
 * One page of bank questions in a fixed order - newest first, then by id -
 * so "Next question" walks the same list the teacher picked from. Pages after
 * the first pass the first page's `asOf`: newest first, a question added in
 * the meantime would sort ahead of the loaded rows, and paging by offset
 * would then hand back rows already shown - with 40 or more added, only
 * those, and the list could never grow again.
 *
 * As on the bank page, nothing is listed before a choice: with no domain, no
 * difficulty and no words the read returns no rows, only the bank's size and
 * its count per tile - what the Board's search card opens on.
 */
export async function searchBank(filter: BankFilter, offset: number, asOf?: string): Promise<BoardBankPage> {
  const listedAt = readAsOf(asOf);
  const clean = cleanFilter(filter);

  if (isEmptyFilter(clean)) {
    const [total, byDomain, byDifficulty] = await Promise.all([
      prisma.bankQuestion.count(),
      prisma.bankQuestion.groupBy({ by: ['domain'], _count: { _all: true } }),
      prisma.bankQuestion.groupBy({ by: ['difficulty'], _count: { _all: true } }),
    ]);
    const counts: BankCounts = { domains: {}, difficulties: {} };
    for (const group of byDomain) {
      if (isBankDomain(group.domain)) counts.domains[group.domain] = group._count._all;
    }
    for (const group of byDifficulty) {
      if (isBankDifficulty(group.difficulty)) counts.difficulties[group.difficulty] = group._count._all;
    }
    return { rows: [], total, asOf: listedAt.toISOString(), counts };
  }

  const where: Prisma.BankQuestionWhereInput = { AND: [bankWhere(clean), { createdAt: { lte: listedAt } }] };
  const skip = Number.isInteger(offset) && offset > 0 ? offset : 0;
  const [rows, total] = await Promise.all([
    prisma.bankQuestion.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip,
      take: BANK_PAGE_SIZE,
      select: { id: true, content: true, options: true, domain: true, difficulty: true },
    }),
    prisma.bankQuestion.count({ where }),
  ]);

  return {
    total,
    asOf: listedAt.toISOString(),
    rows: rows.map((row) => ({
      id: row.id,
      previewHtml: renderMathHtml(previewSource(row.content)),
      domain: row.domain,
      difficulty: row.difficulty,
      isGridIn: readOptions(row.options).length === 0,
    })),
  };
}

export async function readBankQuestion(id: string): Promise<BankQuestionResult> {
  const row = await prisma.bankQuestion.findUnique({
    where: { id },
    select: { content: true, options: true, correctAnswer: true, imageUrl: true, domain: true, difficulty: true },
  });
  if (!row) {
    return { ok: false, error: 'This question is no longer in the bank. Pick another one.' };
  }

  const tags: BankTags = { domain: row.domain, difficulty: row.difficulty };
  return {
    ok: true,
    tags,
    question: toBoardQuestion({
      content: row.content,
      options: readOptions(row.options),
      correctAnswer: row.correctAnswer,
      imageUrl: row.imageUrl,
      imageName: null,
    }),
  };
}
