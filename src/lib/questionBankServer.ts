import type { Prisma } from '@prisma/client';
import { revalidateTag } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getSupabaseAdmin } from '@/lib/supabase';
import { examQuestionsCacheTag } from '@/lib/examQuestions';
import { formatAnswerLetters, isMultiSelectKey, parseAnswerLetters } from '@/lib/resultAnswers';
import { renderQuestionPreview } from '@/app/admin/tests/questionPreview';
import type { ParsedQuestion } from '@/lib/texParser';
import {
  isBankDifficulty,
  isBankDomain,
  type BankDifficulty,
  type BankDomain,
  type BankFilters,
  type BankPickRow,
} from '@/lib/questionBank';

/*
 * Server side of the question bank (prisma/schema.prisma, BankQuestion): the
 * reads behind the bank pages and pickers, the write-through between a bank
 * question and the test rows copied from it, and the image bookkeeping that
 * keeps a test's deletion from taking pictures the bank still shows.
 *
 * Not a 'use server' module: these are helpers for the actions in
 * src/app/admin/actions.ts and src/app/admin/bank/actions.ts, which check the
 * admin first. Nothing here does.
 */

export const QUESTION_IMAGE_BUCKET = 'questions';
const STORAGE_LIST_PAGE_SIZE = 1000;
const MAX_TEX_FILE_SIZE = 2 * 1024 * 1024;

// ── Cache ───────────────────────────────────────────────────────────────────

/**
 * Expires the pre-rendered exam questions (src/lib/examQuestions.ts) of these
 * tests and of every copy of them: a copy shows its original's questions but
 * caches them under its own id.
 */
export async function revalidateTestQuestions(testIds: Iterable<string>) {
  const ids = [...new Set(testIds)];
  if (ids.length === 0) return;

  const copies = await prisma.test.findMany({
    where: { questionSourceId: { in: ids } },
    select: { id: true },
  });

  for (const id of [...ids, ...copies.map((copy) => copy.id)]) {
    revalidateTag(examQuestionsCacheTag(id), { expire: 0 });
  }
}

// ── Question fields ─────────────────────────────────────────────────────────

function readText(value: FormDataEntryValue | null) {
  return typeof value === 'string' ? value.trim() : '';
}

export function readOptionalText(value: FormDataEntryValue | null) {
  return readText(value) || null;
}

function normalizeQuestionOptions(values: FormDataEntryValue[]) {
  const options = values
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean);

  if (options.length === 1) {
    throw new Error('Use at least two options or remove all options for a grid-in answer');
  }

  return options;
}

/**
 * Checks the answer key against the options and returns the form to store.
 *
 * Two or more letters make the question multi-select, exactly as `\answer{B, C}`
 * does in a `.tex` file, and the stored key is sorted and de-spaced so `C, B`
 * and `B,C` are the same key. Anything that is not a list of option letters is
 * a grid-in value and passes through untouched - `1,000` stays a number.
 */
function normalizeQuestionAnswer(options: string[], correctAnswer: string) {
  const letters = parseAnswerLetters(correctAnswer);
  const isMultiSelect = letters !== null && letters.length > 1;

  if (isMultiSelect && options.length === 0) {
    throw new Error('Several correct answers need options to choose from. Use one value for a grid-in answer.');
  }

  if (!letters || options.length === 0) return correctAnswer;

  if (new Set(letters).size !== letters.length) {
    throw new Error('The correct answer repeats an option letter');
  }

  for (const letter of letters) {
    if (letter.charCodeAt(0) - 65 >= options.length) {
      throw new Error(`Correct answer is ${letter}, but only ${options.length} options are present`);
    }
  }

  return isMultiSelect ? formatAnswerLetters(letters) : correctAnswer;
}

/**
 * The fields a bank question and a test row share, read off an editor form
 * (the test editor's and the bank question page's): question text, options,
 * the answer key and the image. The test-only fields - explanation, video -
 * are read by the test editor's action itself.
 */
export function readSharedQuestionFields(formData: FormData) {
  const content = readText(formData.get('content'));
  if (!content) throw new Error('Question text is required');

  const correctAnswer = readText(formData.get('correctAnswer'));
  if (!correctAnswer) throw new Error('Correct answer is required');

  const options = normalizeQuestionOptions(formData.getAll('options'));

  return {
    content,
    options,
    correctAnswer: normalizeQuestionAnswer(options, correctAnswer),
    imageUrl: readOptionalText(formData.get('imageUrl')),
  };
}

export type SharedQuestionFields = ReturnType<typeof readSharedQuestionFields>;

/** The tags from an editor form. Empty is allowed: a question may stay unsorted. */
export function readBankTags(formData: FormData) {
  const domain = readText(formData.get('domain'));
  const difficulty = Number(readText(formData.get('difficulty')));

  if (domain && !isBankDomain(domain)) throw new Error('Pick a domain from the list');
  if (readText(formData.get('difficulty')) && !isBankDifficulty(difficulty)) {
    throw new Error('Pick Easy, Medium or Hard');
  }

  return {
    domain: domain ? (domain as BankDomain) : null,
    difficulty: isBankDifficulty(difficulty) ? difficulty : null,
  };
}

// ── Write-through ───────────────────────────────────────────────────────────

/**
 * Saves a bank question and copies the shared fields into every test row
 * that shows it, in one transaction, then expires those tests' cached
 * questions. The tags live on the bank only.
 */
export async function writeBankQuestionThrough(
  bankQuestionId: string,
  fields: SharedQuestionFields,
  tags: { domain: BankDomain | null; difficulty: BankDifficulty | null },
) {
  await prisma.$transaction([
    prisma.bankQuestion.update({
      where: { id: bankQuestionId },
      data: { ...fields, ...tags },
      select: { id: true },
    }),
    prisma.question.updateMany({
      where: { bankQuestionId },
      data: fields,
    }),
  ]);

  // Read after the write: a test built from the bank in between was copied
  // before the update and is part of `updateMany`, so it is expired too.
  const linked = await prisma.question.findMany({
    where: { bankQuestionId },
    select: { testId: true },
  });
  await revalidateTestQuestions(linked.map((row) => row.testId));
}

/**
 * Saves a test row from the test editor. A row that came from the bank
 * writes the shared fields through to its bank question and to the rows of
 * every other test that shows it; explanation and video stay on this row.
 */
export async function writeTestQuestionThrough(
  questionId: string,
  fields: SharedQuestionFields,
  testOnly: { explanation: string | null; videoUrl: string | null },
) {
  const existing = await prisma.question.findUnique({
    where: { id: questionId },
    select: { testId: true, bankQuestionId: true },
  });

  if (!existing) {
    throw new Error('Question not found');
  }

  const { bankQuestionId } = existing;
  const writes: Prisma.PrismaPromise<unknown>[] = [
    prisma.question.update({
      where: { id: questionId },
      data: { ...fields, ...testOnly },
      select: { id: true },
    }),
  ];

  if (bankQuestionId) {
    writes.push(
      prisma.bankQuestion.update({ where: { id: bankQuestionId }, data: fields, select: { id: true } }),
      prisma.question.updateMany({
        where: { bankQuestionId, id: { not: questionId } },
        data: fields,
      }),
    );
  }

  await prisma.$transaction(writes);

  const testIds = bankQuestionId
    ? (await prisma.question.findMany({ where: { bankQuestionId }, select: { testId: true } }))
      .map((row) => row.testId)
    : [existing.testId];
  await revalidateTestQuestions([existing.testId, ...testIds]);
}

// ── Reads ───────────────────────────────────────────────────────────────────

export function bankQuestionWhere(
  filters: BankFilters,
  excludeIds: readonly string[] = [],
): Prisma.BankQuestionWhereInput {
  const conditions: Prisma.BankQuestionWhereInput[] = [];

  if (filters.domains.length > 0) conditions.push({ domain: { in: filters.domains } });
  if (filters.difficulties.length > 0) conditions.push({ difficulty: { in: filters.difficulties } });
  if (filters.unsorted) conditions.push({ OR: [{ domain: null }, { difficulty: null }] });
  if (filters.q) {
    conditions.push({
      OR: [
        { content: { contains: filters.q, mode: 'insensitive' } },
        { source: { contains: filters.q, mode: 'insensitive' } },
      ],
    });
  }
  if (excludeIds.length > 0) conditions.push({ id: { notIn: [...excludeIds] } });

  return conditions.length > 0 ? { AND: conditions } : {};
}

export const bankRowSelect = {
  id: true,
  content: true,
  options: true,
  correctAnswer: true,
  imageUrl: true,
  domain: true,
  difficulty: true,
} as const;

type BankRowSource = Prisma.BankQuestionGetPayload<{ select: typeof bankRowSelect }>;

export function readOptions(options: unknown) {
  return Array.isArray(options)
    ? options.filter((option): option is string => typeof option === 'string')
    : [];
}

/** A bank question as a picker row: its opening typeset, its tags, its kind. */
export function toBankPickRow(row: BankRowSource): BankPickRow {
  const options = readOptions(row.options);

  return {
    id: row.id,
    previewHtml: renderQuestionPreview(row.content),
    domain: isBankDomain(row.domain) ? row.domain : null,
    difficulty: isBankDifficulty(row.difficulty) ? row.difficulty : null,
    kind: options.length === 0 ? 'grid-in' : isMultiSelectKey(row.correctAnswer) ? 'multi-select' : 'choice',
    hasImage: Boolean(row.imageUrl),
  };
}

/**
 * How many tests show each bank question: the tests holding a row linked to
 * it, plus their copies, which show the same rows.
 */
export async function countTestsUsing(bankQuestionIds: string[]) {
  const counts = new Map<string, number>();
  if (bankQuestionIds.length === 0) return counts;

  const rows = await prisma.question.groupBy({
    by: ['bankQuestionId', 'testId'],
    where: { bankQuestionId: { in: bankQuestionIds } },
  });
  const testIds = [...new Set(rows.map((row) => row.testId))];
  const copies = testIds.length > 0
    ? await prisma.test.groupBy({
        by: ['questionSourceId'],
        where: { questionSourceId: { in: testIds } },
        _count: { _all: true },
      })
    : [];
  const copiesByTest = new Map(copies.map((row) => [row.questionSourceId, row._count._all]));

  for (const row of rows) {
    if (!row.bankQuestionId) continue;
    counts.set(
      row.bankQuestionId,
      (counts.get(row.bankQuestionId) ?? 0) + 1 + (copiesByTest.get(row.testId) ?? 0),
    );
  }

  return counts;
}

function shuffle<T>(items: T[]) {
  for (let index = items.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [items[index], items[other]] = [items[other], items[index]];
  }
  return items;
}

/**
 * Random bank questions for the build page: `counts[d]` of difficulty d,
 * optionally from some domains only, never one of `excludeIds` (the other
 * modules' questions). Ids are drawn in memory: the bank is thousands of
 * rows at most, and an id list is small. Returned easy first, then medium,
 * then hard - the way a module runs on the test.
 */
export async function pickRandomBankQuestions(input: {
  counts: Partial<Record<BankDifficulty, number>>;
  domains: BankDomain[];
  excludeIds: string[];
}) {
  const picked: string[] = [];
  const shortages: { difficulty: BankDifficulty; requested: number; available: number }[] = [];

  for (const difficulty of [1, 2, 3] as const) {
    const requested = input.counts[difficulty] ?? 0;
    if (requested <= 0) continue;

    const candidates = await prisma.bankQuestion.findMany({
      where: {
        difficulty,
        ...(input.domains.length > 0 ? { domain: { in: input.domains } } : {}),
        ...(input.excludeIds.length > 0 ? { id: { notIn: input.excludeIds } } : {}),
      },
      select: { id: true },
    });

    if (candidates.length < requested) {
      shortages.push({ difficulty, requested, available: candidates.length });
    }
    picked.push(...shuffle(candidates.map((row) => row.id)).slice(0, requested));
  }

  const rows = picked.length > 0
    ? await prisma.bankQuestion.findMany({ where: { id: { in: picked } }, select: bankRowSelect })
    : [];
  const byId = new Map(rows.map((row) => [row.id, row]));

  return {
    questions: picked.flatMap((id) => {
      const row = byId.get(id);
      return row ? [toBankPickRow(row)] : [];
    }),
    shortages,
  };
}

// ── Imports ─────────────────────────────────────────────────────────────────

/** The `.tex` of an import form: present, named `.tex`, at most 2 MB. */
export async function readTexUpload(value: FormDataEntryValue | null) {
  if (!(value instanceof File) || value.size === 0) {
    throw new Error('Choose a .tex file');
  }

  if (!value.name.toLowerCase().endsWith('.tex') || value.size > MAX_TEX_FILE_SIZE) {
    throw new Error('Upload a valid .tex file up to 2MB');
  }

  return { name: value.name, text: await value.text() };
}

/**
 * The tags every imported question goes into the bank with: what the admin
 * picked in the import preview (sent as JSON, one entry per question in file
 * order), else what the file says. The preview does not let an import start
 * with a question unsorted, so a gap here is a stale form, and refused.
 */
export function resolveImportTags(questions: ParsedQuestion[], value: FormDataEntryValue | null) {
  let picked: unknown = [];
  if (typeof value === 'string' && value) {
    try {
      picked = JSON.parse(value);
    } catch {
      throw new Error('The question tags could not be read. Check the questions again.');
    }
  }
  const list = Array.isArray(picked) ? picked : [];

  return questions.map((question, index) => {
    const entry = list[index] as { domain?: unknown; difficulty?: unknown } | undefined;
    const domain = isBankDomain(entry?.domain) ? entry.domain : question.domain;
    const difficulty = isBankDifficulty(entry?.difficulty) ? entry.difficulty : question.difficulty;

    if (!domain || !difficulty) {
      throw new Error(
        `Question ${question.order} has no ${domain ? 'difficulty' : 'domain'}. Check the questions and pick one.`
      );
    }

    return { domain, difficulty };
  });
}

/**
 * Bank rows for imported questions, with their ids minted here so the test
 * rows can point at them in the same transaction. A test row and its bank
 * question share the image URL: the file is stored once.
 *
 * `createdAt` steps back a millisecond per question. The bank lists newest
 * first, and one import shares a single timestamp otherwise, which left its
 * questions in id order - shuffled. This way the newest import comes first
 * and reads in its file's order.
 */
export function buildBankRows(input: {
  questions: ParsedQuestion[];
  tags: { domain: BankDomain; difficulty: BankDifficulty }[];
  imageMap: Record<string, string>;
  source: string;
  createdById: string | null;
}): Prisma.BankQuestionCreateManyInput[] {
  const importedAt = Date.now();

  return input.questions.map((question, index) => ({
    id: crypto.randomUUID(),
    createdAt: new Date(importedAt - index),
    content: question.content,
    options: question.options,
    correctAnswer: question.correctAnswer,
    imageUrl: question.image ? input.imageMap[question.image] || null : null,
    domain: input.tags[index].domain,
    difficulty: input.tags[index].difficulty,
    source: input.source.slice(0, 200),
    createdById: input.createdById,
  }));
}

// ── Images ──────────────────────────────────────────────────────────────────

/**
 * Of these image URLs, the ones a bank question or a test row still shows.
 * Those two columns are the only places an uploaded image is referenced.
 */
async function findReferencedImageUrls(urls: string[]) {
  if (urls.length === 0) return new Set<string>();

  const [bankRows, questionRows] = await Promise.all([
    prisma.bankQuestion.findMany({
      where: { imageUrl: { in: urls } },
      select: { imageUrl: true },
      distinct: ['imageUrl'],
    }),
    prisma.question.findMany({
      where: { imageUrl: { in: urls } },
      select: { imageUrl: true },
      distinct: ['imageUrl'],
    }),
  ]);

  return new Set(
    [...bankRows, ...questionRows]
      .map((row) => row.imageUrl)
      .filter((url): url is string => Boolean(url)),
  );
}

function publicUrlOf(path: string) {
  return getSupabaseAdmin().storage.from(QUESTION_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** The object path of one of our bucket's public URLs; null for any other URL. */
function storagePathOf(url: string) {
  const prefix = publicUrlOf('');
  if (!url.startsWith(prefix)) return null;

  let path: string;
  try {
    path = decodeURI(url.slice(prefix.length));
  } catch {
    return null;
  }
  return path && !path.includes('..') && !path.includes('?') ? path : null;
}

async function removeUnreferencedPaths(paths: string[], label: string) {
  if (paths.length === 0) return;

  const urlByPath = new Map(paths.map((path) => [path, publicUrlOf(path)]));
  const referenced = await findReferencedImageUrls([...urlByPath.values()]);
  const removable = paths.filter((path) => !referenced.has(urlByPath.get(path)!));

  if (removable.length === 0) return;

  const { error } = await getSupabaseAdmin().storage.from(QUESTION_IMAGE_BUCKET).remove(removable);
  if (error) {
    console.warn(`Could not remove ${removable.length} images of ${label}: ${error.message}`);
  }
}

/**
 * Removes the images uploaded into one folder - a test's `${testId}/`, or a
 * bank import's `bank/${id}/` - except those a bank question or another
 * test's row still shows. An imported test's pictures are its bank
 * questions' pictures too, so deleting the test must leave them.
 *
 * Supabase Storage has no "delete folder" call, so the prefix is listed and
 * its objects removed by path. A storage failure never fails the caller: the
 * rows are already gone by then, and leftovers are logged instead.
 */
export async function removeFolderImages(folder: string) {
  const supabase = getSupabaseAdmin();
  const paths: string[] = [];
  let offset = 0;

  for (;;) {
    const { data, error } = await supabase.storage
      .from(QUESTION_IMAGE_BUCKET)
      .list(folder, { limit: STORAGE_LIST_PAGE_SIZE, offset });

    if (error) {
      console.warn(`Could not list images of ${folder}: ${error.message}`);
      return;
    }

    if (!data || data.length === 0) break;

    // Nested folders come back with a null `metadata`; an upload only stores files.
    paths.push(
      ...data
        .filter((entry) => entry.metadata)
        .map((entry) => `${folder}/${entry.name}`)
    );

    if (data.length < STORAGE_LIST_PAGE_SIZE) break;
    offset += STORAGE_LIST_PAGE_SIZE;
  }

  try {
    await removeUnreferencedPaths(paths, folder);
  } catch (error) {
    console.warn(`Could not clean up the images of ${folder}:`, error);
  }
}

/**
 * Removes images nothing shows any more, given by URL: the picture of a
 * deleted bank question, or a test row's picture from outside its own folder
 * (a test built from the bank shows the bank's files). URLs outside our
 * bucket - typed into the editor's Image URL - are never touched.
 */
export async function removeUnreferencedImages(urls: (string | null | undefined)[]) {
  try {
    const paths = [...new Set(
      urls
        .filter((url): url is string => Boolean(url))
        .map(storagePathOf)
        .filter((path): path is string => path !== null),
    )];
    await removeUnreferencedPaths(paths, 'deleted questions');
  } catch (error) {
    console.warn('Could not clean up the images of deleted questions:', error);
  }
}

/**
 * The uploaded images of an import form, `[{ name, publicUrl }]` as the
 * signed-upload route handed them to the browser. Only URLs inside the given
 * folder of our bucket are accepted, so a form cannot point a question at
 * some other test's files or at another site.
 */
export function readUploadedImages(value: FormDataEntryValue | null, folder: string) {
  if (typeof value !== 'string' || !value) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('Invalid uploaded image metadata');
  }
  if (!Array.isArray(parsed)) {
    throw new Error('Invalid uploaded image metadata');
  }

  return parsed.map((image: { name?: unknown; publicUrl?: unknown }) => {
    if (
      typeof image?.name !== 'string' ||
      typeof image?.publicUrl !== 'string' ||
      !image.name ||
      !image.publicUrl
    ) {
      throw new Error('Invalid uploaded image metadata');
    }

    const path = storagePathOf(image.publicUrl);
    if (!path || !path.startsWith(`${folder}/`)) {
      throw new Error(`Image ${image.name} was not uploaded with this file`);
    }

    return { name: image.name, publicUrl: image.publicUrl };
  });
}
