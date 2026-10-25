'use server';

import { refresh, revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { parseTexFile, type ParsedQuestion } from '@/lib/texParser';
import { isMultiSelectKey } from '@/lib/resultAnswers';
import { renderQuestionPreview } from '@/app/admin/tests/questionPreview';
import {
  BANK_PICKER_PAGE_SIZE,
  isBankDifficulty,
  isBankDomain,
  normalizeBankFilters,
  type BankDifficulty,
  type BankFilters,
  type BankPickRow,
  type TexCheckResult,
} from '@/lib/questionBank';
import {
  bankQuestionWhere,
  bankRowSelect,
  buildBankRows,
  pickRandomBankQuestions,
  readBankTags,
  readSharedQuestionFields,
  readTexUpload,
  readUploadedImages,
  removeFolderImages,
  removeUnreferencedImages,
  resolveImportTags,
  toBankPickRow,
  writeBankQuestionThrough,
} from '@/lib/questionBankServer';

const QUESTION_ID_PATTERN = /^[0-9a-f-]{36}$/i;
/** The folder the signed-upload route gives a bank import (route.ts). */
const BANK_FOLDER_PATTERN = /^bank\/[0-9a-f-]{36}$/i;
const MAX_RANDOM_PER_DIFFICULTY = 200;
const MAX_EXCLUDED_IDS = 2000;

function describeError(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function questionKind(question: ParsedQuestion) {
  if (question.options.length === 0) return 'grid-in' as const;
  return isMultiSelectKey(question.correctAnswer) ? 'multi-select' as const : 'choice' as const;
}

/** The checks every import makes before anything is written. */
function parseImport(text: string) {
  const { questions, moduleIndexes } = parseTexFile(text);

  if (questions.length === 0) {
    throw new Error('No questions found in the .tex file');
  }

  const invalid = questions.find((question) => !question.content || !question.correctAnswer);
  if (invalid) {
    throw new Error(`Question ${invalid.order} is missing content or answer`);
  }

  return { questions, moduleIndexes };
}

/**
 * The import preview's "Check questions": parses the `.tex` and returns each
 * question's opening typeset, its image name and the tags the file gives it,
 * so the admin can sort the rest before anything is saved. Nothing is stored.
 * The same parse runs again on save, so a file edited in between is read as
 * it is then.
 */
export async function checkTexFile(formData: FormData): Promise<TexCheckResult> {
  try {
    await requireAdmin();

    const tex = await readTexUpload(formData.get('texFile'));
    const { questions, moduleIndexes } = parseImport(tex.text);

    return {
      success: true,
      fileName: tex.name,
      hasModuleMarkers: moduleIndexes !== null,
      questions: questions.map((question, index) => ({
        order: question.order,
        markerModule: moduleIndexes?.[index] ?? null,
        previewHtml: renderQuestionPreview(question.content),
        image: question.image || null,
        kind: questionKind(question),
        domainTag: question.domainTag ?? null,
        difficultyTag: question.difficultyTag ?? null,
        domain: question.domain,
        difficulty: question.difficulty,
      })),
    };
  } catch (error: unknown) {
    return { success: false, error: describeError(error, 'The file could not be read. Choose it again.') };
  }
}

/**
 * Adds a `.tex` file's questions to the bank without making a test. Its
 * images were uploaded first into a `bank/<id>` folder of their own; if the
 * save fails they are removed again.
 */
export async function uploadBankQuestions(formData: FormData) {
  let folder: string | null = null;

  try {
    const session = await requireAdmin();

    const requestedFolder = formData.get('folder');
    if (typeof requestedFolder === 'string' && BANK_FOLDER_PATTERN.test(requestedFolder)) {
      folder = requestedFolder;
    }

    const tex = await readTexUpload(formData.get('texFile'));
    const { questions } = parseImport(tex.text);
    const tags = resolveImportTags(questions, formData.get('questionTags'));
    const uploadedImages = readUploadedImages(formData.get('uploadedImages'), folder ?? 'bank/none');

    const imageMap: Record<string, string> = {};
    for (const image of uploadedImages) {
      imageMap[image.name] = image.publicUrl;
    }

    const missingImage = questions.find((question) => question.image && !imageMap[question.image]);
    if (missingImage?.image) {
      throw new Error(`Missing image for question ${missingImage.order}: ${missingImage.image}`);
    }

    const rows = buildBankRows({
      questions,
      tags,
      imageMap,
      source: tex.name,
      createdById: session?.user?.id ?? null,
    });

    await prisma.bankQuestion.createMany({ data: rows });

    refresh();
    return { success: true as const, count: rows.length, fileName: tex.name };
  } catch (error: unknown) {
    console.error('Bank upload error:', error);
    // Nothing points at these files: the rows were never written.
    if (folder) await removeFolderImages(folder);
    return { success: false as const, error: describeError(error, 'The questions were not added') };
  }
}

/**
 * Saves a bank question from its page - tags, text, options, answer, image -
 * and writes the shared fields through to every test showing it.
 */
export async function updateBankQuestion(questionId: string, formData: FormData) {
  try {
    await requireAdmin();

    if (!QUESTION_ID_PATTERN.test(questionId)) {
      throw new Error('Invalid question id');
    }

    const fields = readSharedQuestionFields(formData);
    const tags = readBankTags(formData);
    const existing = await prisma.bankQuestion.findUnique({ where: { id: questionId }, select: { id: true } });

    if (!existing) {
      throw new Error('This question is no longer in the bank');
    }

    await writeBankQuestionThrough(questionId, fields, tags);
    refresh();
    return { success: true as const };
  } catch (error: unknown) {
    console.error('Update Bank Question Error:', error);
    return { success: false as const, error: describeError(error, 'The question was not saved') };
  }
}

/**
 * Deletes a bank question. Tests keep their copies: their rows only lose the
 * link (`onDelete: SetNull`), so no exam, result or review changes. The
 * picture goes only when no test shows it either.
 */
export async function deleteBankQuestion(questionId: string) {
  try {
    await requireAdmin();

    if (!QUESTION_ID_PATTERN.test(questionId)) {
      throw new Error('Invalid question id');
    }

    const existing = await prisma.bankQuestion.findUnique({
      where: { id: questionId },
      select: { imageUrl: true },
    });

    if (existing) {
      await prisma.bankQuestion.delete({ where: { id: questionId }, select: { id: true } });
      await removeUnreferencedImages([existing.imageUrl]);
    }
  } catch (error: unknown) {
    console.error('Delete Bank Question Error:', error);
    return { success: false as const, error: describeError(error, 'The question was not deleted') };
  }

  // The bank list and the test editors' bank badges are other pages.
  revalidatePath('/admin', 'layout');
  redirect('/admin/bank');
}

/** One page of the build page's question browser. */
export async function searchBankQuestions(input: { filters: Partial<BankFilters>; page: number }): Promise<
  | { success: true; rows: BankPickRow[]; total: number; hasMore: boolean }
  | { success: false; error: string }
> {
  try {
    await requireAdmin();

    const filters = normalizeBankFilters(input?.filters);
    const page = Number.isInteger(input?.page) && input.page > 1 ? input.page : 1;
    const skip = (page - 1) * BANK_PICKER_PAGE_SIZE;
    const where = bankQuestionWhere(filters);

    const [total, rows] = await Promise.all([
      prisma.bankQuestion.count({ where }),
      prisma.bankQuestion.findMany({
        where,
        // Newest import first, each in its file's order (see buildBankRows).
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip,
        take: BANK_PICKER_PAGE_SIZE,
        select: bankRowSelect,
      }),
    ]);

    return { success: true, rows: rows.map(toBankPickRow), total, hasMore: skip + rows.length < total };
  } catch (error: unknown) {
    return { success: false, error: describeError(error, 'The bank could not be searched. Try again.') };
  }
}

/**
 * A random set for one module of the build page: so many of each difficulty,
 * from some domains or all, never a question another module already has.
 */
export async function pickBankQuestions(input: {
  counts: Partial<Record<BankDifficulty, number>>;
  domains: string[];
  excludeIds: string[];
}) {
  try {
    await requireAdmin();

    const counts: Partial<Record<BankDifficulty, number>> = {};
    for (const [key, value] of Object.entries(input?.counts ?? {})) {
      const difficulty = Number(key);
      const count = Number(value);
      if (!isBankDifficulty(difficulty) || !Number.isInteger(count) || count <= 0) continue;
      counts[difficulty] = Math.min(count, MAX_RANDOM_PER_DIFFICULTY);
    }

    if (Object.keys(counts).length === 0) {
      throw new Error('Set how many questions of each difficulty to pick');
    }

    const excludeIds = (Array.isArray(input?.excludeIds) ? input.excludeIds : [])
      .filter((id): id is string => typeof id === 'string' && QUESTION_ID_PATTERN.test(id))
      .slice(0, MAX_EXCLUDED_IDS);

    const result = await pickRandomBankQuestions({
      counts,
      domains: (Array.isArray(input?.domains) ? input.domains : []).filter(isBankDomain),
      excludeIds,
    });

    return { success: true as const, ...result };
  } catch (error: unknown) {
    return { success: false as const, error: describeError(error, 'No questions were picked. Try again.') };
  }
}
