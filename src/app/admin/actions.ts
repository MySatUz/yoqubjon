'use server';

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { parseTexFile } from '@/lib/texParser';
import { getSupabaseAdmin } from '@/lib/supabase';
import { refresh, revalidateTag } from 'next/cache';
import { requireAdmin } from '@/lib/admin';
import { TEST_COLLECTIONS_CACHE_TAG } from '@/lib/testCollections';
import { examQuestionsCacheTag } from '@/lib/examQuestions';
import {
  EXAM_DURATION_SECONDS,
  MAX_EXAM_DURATION_SECONDS,
  MIN_EXAM_DURATION_SECONDS,
} from '@/lib/examConfig';
import {
  cleanTestDescription,
  createCategoryIdBase,
  encodeTestDescription,
  isTestCategory,
  normalizeCategoryId,
} from '@/lib/testCatalog';
import { normalizeTestMaxAttempts } from '@/lib/testAttempts';
import { parseOlympiadMoment } from '@/lib/olympiad';
import {
  MAX_MODULE_COUNT,
  MIN_MODULE_COUNT,
  resolveExamModules,
  type ExamFormatInput,
} from '@/lib/examModules';

const MAX_TEX_FILE_SIZE = 2 * 1024 * 1024;
const MAX_MODULE_QUESTION_COUNT = 200;
const MAX_IMAGE_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);
const QUESTION_IMAGE_BUCKET = 'questions';
const STORAGE_LIST_PAGE_SIZE = 1000;
const TEST_ID_PATTERN = /^[0-9a-f-]{36}$/i;
const MIN_DURATION_MINUTES = Math.ceil(MIN_EXAM_DURATION_SECONDS / 60);
const MAX_DURATION_MINUTES = Math.floor(MAX_EXAM_DURATION_SECONDS / 60);

function normalizeNullableText(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeRequiredText(value: FormDataEntryValue | null, fieldName: string) {
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} is required`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${fieldName} is required`);
  }

  return trimmed;
}

function readBooleanField(formData: FormData, fieldName: string, defaultValue = false) {
  const values = formData.getAll(fieldName);
  if (values.length === 0) return defaultValue;

  return values.includes('true');
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

function validateQuestionAnswer(options: string[], correctAnswer: string) {
  const answerLetter = correctAnswer.trim().toUpperCase();
  if (!/^[A-H]$/.test(answerLetter) || options.length === 0) return;

  const answerIndex = answerLetter.charCodeAt(0) - 65;
  if (answerIndex >= options.length) {
    throw new Error(`Correct answer is ${answerLetter}, but only ${options.length} options are present`);
  }
}

function sanitizeFileName(fileName: string) {
  const normalized = fileName.trim().replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
  return normalized || `${crypto.randomUUID()}.bin`;
}

type UploadedImage = {
  name: string;
  publicUrl: string;
};

function readUploadedImages(value: FormDataEntryValue | null) {
  if (typeof value !== 'string' || !value) return [];

  const parsed = JSON.parse(value) as UploadedImage[];
  if (!Array.isArray(parsed)) {
    throw new Error('Invalid uploaded image metadata');
  }

  return parsed.map((image) => {
    if (
      typeof image?.name !== 'string' ||
      typeof image?.publicUrl !== 'string' ||
      !image.name ||
      !image.publicUrl
    ) {
      throw new Error('Invalid uploaded image metadata');
    }

    return {
      name: image.name,
      publicUrl: image.publicUrl,
    };
  });
}

/**
 * Drops the images an upload left behind after it failed.
 *
 * The admin form uploads images first, under a freshly minted test id, and only
 * then asks the server to create the test. When that second step throws — an
 * unparsable `.tex`, a missing image, a rejected window — the files are already
 * in the bucket with no row that will ever reference them. One such folder was
 * found in production before this existed.
 *
 * The existence check is the important part: `testId` can arrive from the form,
 * and if it names a test that is already stored, these images belong to it and
 * must not be touched.
 */
async function discardFailedUpload(testId: string) {
  try {
    const existing = await prisma.test.findUnique({
      where: { id: testId },
      select: { id: true },
    });

    if (existing) return;

    await removeTestImages(testId);
  } catch (error) {
    console.warn(`Could not clean up the failed upload of test ${testId}:`, error);
  }
}

export async function uploadTest(formData: FormData) {
  // Read inside the try, but needed by the catch: without it a failure cannot
  // tell which folder the images went to.
  let uploadedTestId: string | null = null;

  try {
    await requireAdmin();

    const title = typeof formData.get('title') === 'string'
      ? (formData.get('title') as string).trim()
      : '';
    const isFree = formData.get('isFree') === 'true';
    const visible = readBooleanField(formData, 'isVisible', true);
    const collection = await resolveCollectionCategory(formData.get('testCategory'));
    const testCategory = collection.category;
    const examFormat = normalizeExamFormat(formData);
    const maxAttempts = normalizeTestMaxAttempts(
      formData.get('maxAttempts'),
      collection.maxAttempts
    );
    const texFile = formData.get('texFile') as File;
    const imageFiles = formData.getAll('images') as File[];
    const uploadedImages = readUploadedImages(formData.get('uploadedImages'));
    const requestedTestId = formData.get('testId');

    // Remembered before anything can throw: the images were uploaded under this
    // id by the form, so every failure below leaves them orphaned. Recording it
    // only once the .tex parses would miss the most common failure of all.
    if (typeof requestedTestId === 'string' && TEST_ID_PATTERN.test(requestedTestId)) {
      uploadedTestId = requestedTestId;
    }

    if (!texFile || !(texFile instanceof File) || texFile.size === 0 || !title) {
      throw new Error('Title and .tex file are required');
    }

    if (!texFile.name.toLowerCase().endsWith('.tex') || texFile.size > MAX_TEX_FILE_SIZE) {
      throw new Error('Upload a valid .tex file up to 2MB');
    }

    const texContent = await texFile.text();
    const { questions: parsedQuestions, moduleIndexes } = parseTexFile(texContent);

    if (parsedQuestions.length === 0) {
      throw new Error('No questions found in the .tex file');
    }

    const invalidQuestion = parsedQuestions.find(
      (q) => !q.content || q.content === 'Missing content' || !q.correctAnswer
    );

    if (invalidQuestion) {
      throw new Error(`Question ${invalidQuestion.order} is missing content or answer`);
    }

    const examModules = resolveExamModules({
      questionCount: parsedQuestions.length,
      markerModules: moduleIndexes,
      format: examFormat,
    });

    const olympiadWindow = normalizeOlympiadWindow(formData, examModules.durationSeconds);

    const testId = uploadedTestId ?? crypto.randomUUID();

    const supabase = getSupabaseAdmin();
    const imageMap: Record<string, string> = {};
    for (const image of uploadedImages) {
      imageMap[image.name] = image.publicUrl;
    }

    await Promise.all(imageFiles.map(async (image) => {
      if (!(image instanceof File) || image.size === 0) return;

      if (image.size > MAX_IMAGE_FILE_SIZE || !ALLOWED_IMAGE_TYPES.has(image.type)) {
        throw new Error(`Invalid image file: ${image.name}`);
      }

      const filePath = `${testId}/${sanitizeFileName(image.name)}`;

      const { error } = await supabase.storage
        .from(QUESTION_IMAGE_BUCKET)
        .upload(filePath, image, {
          upsert: true,
          contentType: image.type
        });

      if (error) {
        throw new Error(`Error uploading image ${image.name}: ${error.message}`);
      }

      const { data: { publicUrl } } = supabase.storage
        .from(QUESTION_IMAGE_BUCKET)
        .getPublicUrl(filePath);
      
      imageMap[image.name] = publicUrl;
    }));

    const missingImageQuestion = parsedQuestions.find((q) => q.image && !imageMap[q.image]);
    if (missingImageQuestion?.image) {
      throw new Error(`Missing image for question ${missingImageQuestion.order}: ${missingImageQuestion.image}`);
    }

    await prisma.test.create({
      data: {
        id: testId,
        title,
        description: encodeTestDescription(testCategory),
        isFree,
        visible,
        durationSeconds: examModules.durationSeconds,
        moduleDurations: examModules.moduleDurations,
        maxAttempts,
        ...olympiadWindow,
        collectionCategory: testCategory,
        questions: {
          createMany: {
            data: parsedQuestions.map((q, index) => ({
              content: q.content,
              options: q.options,
              correctAnswer: q.correctAnswer,
              order: q.order,
              moduleIndex: examModules.moduleIndexes[index],
              imageUrl: q.image ? imageMap[q.image] || null : null
            })),
          },
        },
      }
    });

    // A re-uploaded test may reuse an existing id, so the pre-rendered question
    // HTML for that id has to go. `{ expire: 0 }` = the very next exam start
    // re-renders instead of serving the old questions.
    revalidateTag(examQuestionsCacheTag(testId), { expire: 0 });
    // Every admin page is `force-dynamic`, so there is no route cache for
    // `revalidatePath` to clear. `refresh()` re-renders the page that called the
    // action and ships the new RSC payload in this same response, which removes
    // the extra `router.refresh()` round-trip the client used to make.
    refresh();
    return { success: true, testId };

  } catch (error: unknown) {
    console.error('Upload error:', error);

    if (uploadedTestId) {
      await discardFailedUpload(uploadedTestId);
    }

    return { success: false, error: error instanceof Error ? error.message : 'Upload failed' };
  }
}

/**
 * Removes every image a test uploaded. They live under `${testId}/`, and
 * Supabase Storage has no "delete folder" call, so the prefix is listed and its
 * objects are removed by path.
 *
 * A storage failure must not fail the delete itself: the rows are already gone
 * by the time this runs, and reporting an error for a test that no longer
 * exists would only confuse the admin. Leftovers are logged instead.
 */
async function removeTestImages(testId: string) {
  const supabase = getSupabaseAdmin();
  const paths: string[] = [];
  let offset = 0;

  for (;;) {
    const { data, error } = await supabase.storage
      .from(QUESTION_IMAGE_BUCKET)
      .list(testId, { limit: STORAGE_LIST_PAGE_SIZE, offset });

    if (error) {
      console.warn(`Could not list images of test ${testId}: ${error.message}`);
      return;
    }

    if (!data || data.length === 0) break;

    // Nested folders come back with a null `metadata`; a test only stores files.
    paths.push(
      ...data
        .filter((entry) => entry.metadata)
        .map((entry) => `${testId}/${entry.name}`)
    );

    if (data.length < STORAGE_LIST_PAGE_SIZE) break;
    offset += STORAGE_LIST_PAGE_SIZE;
  }

  if (paths.length === 0) return;

  const { error } = await supabase.storage.from(QUESTION_IMAGE_BUCKET).remove(paths);

  if (error) {
    console.warn(`Could not remove ${paths.length} images of test ${testId}: ${error.message}`);
  }
}

export async function deleteTest(testId: string) {
  try {
    await requireAdmin();

    await prisma.$transaction(async (tx) => {
      await tx.result.deleteMany({ where: { testId } });
      await tx.question.deleteMany({ where: { testId } });
      await tx.test.delete({ where: { id: testId } });
    });

    // Deliberately after the rows: a failure here only orphans the images, while
    // the reverse order would leave a live test pointing at deleted files.
    await removeTestImages(testId);

    revalidateTag(examQuestionsCacheTag(testId), { expire: 0 });
    refresh();
    return { success: true };
  } catch (error: unknown) {
    console.error("Delete Test Error:", error);
    return { success: false, error: error instanceof Error ? error.message : 'Delete failed' };
  }
}

function normalizeModuleQuestionCount(value: FormDataEntryValue) {
  const count = Number(value);

  if (
    !Number.isFinite(count) ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > MAX_MODULE_QUESTION_COUNT
  ) {
    throw new Error(`Questions per module must be between 1 and ${MAX_MODULE_QUESTION_COUNT}`);
  }

  return count;
}

function normalizeModuleDurations(formData: FormData) {
  const moduleMinutes = formData.getAll('moduleMinutes');

  if (moduleMinutes.length < MIN_MODULE_COUNT || moduleMinutes.length > MAX_MODULE_COUNT) {
    throw new Error(`A test can have between ${MIN_MODULE_COUNT} and ${MAX_MODULE_COUNT} modules`);
  }

  return moduleMinutes.map((value) => normalizeDurationSeconds(value));
}

/**
 * Reads the exam format from the admin form: either one classic timer for the
 * whole test, or one timer per SAT-style module.
 */
function normalizeExamFormat(formData: FormData): ExamFormatInput {
  if (formData.get('examFormat') !== 'modular') {
    return {
      durationSeconds: normalizeDurationSeconds(formData.get('durationMinutes')),
      moduleDurations: [],
      moduleQuestionCounts: [],
    };
  }

  const moduleDurations = normalizeModuleDurations(formData);

  return {
    durationSeconds: moduleDurations.reduce((total, duration) => total + duration, 0),
    moduleDurations,
    moduleQuestionCounts: formData.getAll('moduleQuestions').map(normalizeModuleQuestionCount),
  };
}

/**
 * Reads the olympiad window off the form. Both fields or neither: a window with
 * only one end would read as "not an olympiad" to `readOlympiadWindow`, so the
 * admin would have set a competition that silently behaves like a normal test.
 *
 * The window also has to be at least one test long. A shorter one accepts nobody
 * — the entrance closes a full test length before the end — and there is no
 * point storing a competition that cannot be entered.
 */
function normalizeOlympiadWindow(formData: FormData, totalDurationSeconds: number) {
  const startsAt = parseOlympiadMoment(formData.get('olympiadStartsAt'));
  const endsAt = parseOlympiadMoment(formData.get('olympiadEndsAt'));

  if (!startsAt && !endsAt) {
    return { olympiadStartsAt: null, olympiadEndsAt: null };
  }

  if (!startsAt || !endsAt) {
    throw new Error('Set both the start and the end of the olympiad, or leave both empty');
  }

  if (endsAt <= startsAt) {
    throw new Error('The olympiad must end after it starts');
  }

  const windowSeconds = (endsAt.getTime() - startsAt.getTime()) / 1000;
  if (windowSeconds < totalDurationSeconds) {
    throw new Error(
      `The olympiad window is shorter than the test itself (${Math.round(totalDurationSeconds / 60)} minutes), so nobody could finish in time`
    );
  }

  return { olympiadStartsAt: startsAt, olympiadEndsAt: endsAt };
}

function normalizeDurationSeconds(value: FormDataEntryValue | null) {
  if (value === null || value === '') {
    return EXAM_DURATION_SECONDS;
  }

  if (typeof value !== 'string') {
    throw new Error('Test time is invalid');
  }

  const minutes = Number(value);
  if (
    !Number.isFinite(minutes) ||
    !Number.isInteger(minutes) ||
    minutes < MIN_DURATION_MINUTES ||
    minutes > MAX_DURATION_MINUTES
  ) {
    throw new Error(`Test time must be between ${MIN_DURATION_MINUTES} and ${MAX_DURATION_MINUTES} minutes`);
  }

  return minutes * 60;
}

/**
 * Resolves the section a test belongs to and returns that section's attempt
 * limit alongside it.
 *
 * The limit used to be a second `testCollectionVisibility` read right after this
 * one; it comes from the same row, so it is selected here instead. Callers keep
 * passing it to `normalizeTestMaxAttempts` as the *fallback*, which still only
 * applies when the form left the field empty.
 */
async function resolveCollectionCategory(value: FormDataEntryValue | null) {
  const collections = await prisma.testCollectionVisibility.findMany({
    orderBy: [
      { position: 'asc' },
      { category: 'asc' },
    ],
    select: { category: true, maxAttempts: true },
  });

  if (collections.length === 0) {
    throw new Error('Create at least one section before uploading tests');
  }

  if (typeof value === 'string' && value.trim()) {
    if (!isTestCategory(value)) {
      throw new Error('Selected section is invalid');
    }

    const requestedCategory = normalizeCategoryId(value);
    const requested = collections.find((collection) => collection.category === requestedCategory);
    if (requested) {
      return { category: requestedCategory, maxAttempts: requested.maxAttempts };
    }

    throw new Error('Selected section no longer exists');
  }

  const fallback = collections.find((collection) => collection.category === 'STANDARD')
    ?? collections[0];

  return { category: fallback.category, maxAttempts: fallback.maxAttempts };
}

export async function updateSectionSettings(formData: FormData) {
  try {
    await requireAdmin();

    const categories = Array.from(new Set(
      formData
        .getAll('category')
        .filter((value): value is string => typeof value === 'string' && isTestCategory(value))
        .map(normalizeCategoryId)
    ));

    if (categories.length === 0) {
      throw new Error('No sections to update');
    }

    const existingCollections = await prisma.testCollectionVisibility.findMany({
      where: { category: { in: categories } },
      select: { category: true, maxAttempts: true },
    });

    if (existingCollections.length === 0) {
      throw new Error('No sections to update');
    }

    const updates = existingCollections.flatMap((collection) => {
      const { category } = collection;
      const maxAttempts = normalizeTestMaxAttempts(
        formData.get(`attempts_${category}`),
        collection.maxAttempts
      );

      const operations: Prisma.PrismaPromise<unknown>[] = [
        prisma.testCollectionVisibility.update({
          where: { category },
          data: {
            visible: formData.get(`visible_${category}`) === 'true',
            maxAttempts,
          },
        }),
      ];

      // Only cascade when the section limit actually changed, so saving
      // visibility never silently resets per-test overrides.
      if (maxAttempts !== collection.maxAttempts) {
        operations.push(
          prisma.test.updateMany({
            where: { collectionCategory: category },
            data: { maxAttempts },
          })
        );
      }

      return operations;
    });

    await prisma.$transaction(updates);

    // `{ expire: 0 }` = immediate expiry, so a hidden section disappears on the
    // very next request instead of after a stale-while-revalidate round.
    revalidateTag(TEST_COLLECTIONS_CACHE_TAG, { expire: 0 });
    // Order matters: the tag is expired first, so the re-render triggered by
    // `refresh()` reads the collections back from the database, not the cache.
    refresh();
    return { success: true };
  } catch (error: unknown) {
    console.error('Update Section Settings Error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Update failed' };
  }
}

export async function createTestCollection(formData: FormData) {
  try {
    await requireAdmin();

    const label = normalizeRequiredText(formData.get('sectionLabel'), 'Section name');
    const description = normalizeNullableText(formData.get('sectionDescription'))
      || 'Practice tests in this section.';
    const maxAttempts = normalizeTestMaxAttempts(formData.get('sectionMaxAttempts'));
    const existingCollections = await prisma.testCollectionVisibility.findMany({
      select: { category: true },
    });
    const existingCategories = new Set(existingCollections.map((collection) => collection.category));
    const baseId = createCategoryIdBase(label);
    let category = normalizeCategoryId(baseId);
    let suffix = 2;

    while (existingCategories.has(category)) {
      category = `${baseId}_${suffix}`;
      suffix += 1;
    }

    const maxPosition = await prisma.testCollectionVisibility.aggregate({
      _max: { position: true },
    });

    await prisma.testCollectionVisibility.create({
      data: {
        category,
        label,
        description,
        visible: true,
        maxAttempts,
        position: (maxPosition._max.position ?? 0) + 10,
      },
    });

    revalidateTag(TEST_COLLECTIONS_CACHE_TAG, { expire: 0 });
    refresh();
    return { success: true };
  } catch (error: unknown) {
    console.error('Create Collection Error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Create failed' };
  }
}

export async function deleteTestCollection(categoryValue: string) {
  try {
    await requireAdmin();

    if (!isTestCategory(categoryValue)) {
      throw new Error('Invalid section');
    }

    const category = normalizeCategoryId(categoryValue);
    const collectionCount = await prisma.testCollectionVisibility.count();
    if (collectionCount <= 1) {
      throw new Error('Keep at least one section');
    }

    await prisma.testCollectionVisibility.delete({
      where: { category },
    });

    revalidateTag(TEST_COLLECTIONS_CACHE_TAG, { expire: 0 });
    refresh();
    return { success: true };
  } catch (error: unknown) {
    console.error('Delete Collection Error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Delete failed' };
  }
}

export async function updateTestDetails(testId: string, formData: FormData) {
  try {
    await requireAdmin();

    if (!testId || testId.length > 160) {
      throw new Error('Invalid test id');
    }

    const title = normalizeRequiredText(formData.get('title'), 'Test title');
    // Neither read depends on the other, so they share one round-trip. Errors
    // still surface in the original order: an invalid section rejects the whole
    // `Promise.all`, and only then is the test row inspected.
    const [collection, existingTest] = await Promise.all([
      resolveCollectionCategory(formData.get('testCategory')),
      prisma.test.findUnique({
        where: { id: testId },
        select: {
          description: true,
          visible: true,
          moduleDurations: true,
        },
      }),
    ]);
    const testCategory = collection.category;
    const maxAttempts = normalizeTestMaxAttempts(
      formData.get('maxAttempts'),
      collection.maxAttempts
    );
    const isFree = formData.get('isFree') === 'true';

    if (!existingTest) {
      throw new Error('Test not found');
    }

    // Module questions are fixed at upload time, so editing only changes how
    // long each existing module runs.
    const moduleDurations = existingTest.moduleDurations.length > 1
      ? normalizeModuleDurations(formData)
      : [];

    if (
      moduleDurations.length > 0 &&
      moduleDurations.length !== existingTest.moduleDurations.length
    ) {
      throw new Error(
        `This test has ${existingTest.moduleDurations.length} modules. Set a time for each module.`
      );
    }

    const durationSeconds = moduleDurations.length > 0
      ? moduleDurations.reduce((total, duration) => total + duration, 0)
      : normalizeDurationSeconds(formData.get('durationMinutes'));

    if (durationSeconds > MAX_EXAM_DURATION_SECONDS) {
      throw new Error(`Total test time must not exceed ${MAX_DURATION_MINUTES} minutes`);
    }

    await prisma.test.update({
      where: { id: testId },
      data: {
        title,
        isFree,
        visible: readBooleanField(formData, 'isVisible', existingTest.visible),
        durationSeconds,
        moduleDurations,
        maxAttempts,
        ...normalizeOlympiadWindow(formData, durationSeconds),
        collectionCategory: testCategory,
        description: encodeTestDescription(testCategory, cleanTestDescription(existingTest.description)),
      },
    });

    revalidateTag(examQuestionsCacheTag(testId), { expire: 0 });
    refresh();
    return { success: true };
  } catch (error: unknown) {
    console.error('Update Test Details Error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Update failed' };
  }
}

export async function updateTestVisibility(testId: string, visible: boolean) {
  try {
    await requireAdmin();

    if (!testId || testId.length > 160) {
      throw new Error('Invalid test id');
    }

    await prisma.test.update({
      where: { id: testId },
      data: { visible },
      select: { id: true },
    });

    // `/exam/[id]` reads the session, so it is dynamic as well: nothing cached
    // to invalidate there either.
    refresh();
    return { success: true };
  } catch (error: unknown) {
    console.error('Update Test Visibility Error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Update failed' };
  }
}

export async function updateQuestion(questionId: string, formData: FormData) {
  try {
    await requireAdmin();

    if (!/^[0-9a-f-]{36}$/i.test(questionId)) {
      throw new Error('Invalid question id');
    }

    const content = normalizeRequiredText(formData.get('content'), 'Question text');
    const correctAnswer = normalizeRequiredText(formData.get('correctAnswer'), 'Correct answer');
    const options = normalizeQuestionOptions(formData.getAll('options'));
    const explanation = normalizeNullableText(formData.get('explanation'));
    const imageUrl = normalizeNullableText(formData.get('imageUrl'));
    const videoUrl = normalizeNullableText(formData.get('videoUrl'));

    validateQuestionAnswer(options, correctAnswer);

    const existingQuestion = await prisma.question.findUnique({
      where: { id: questionId },
      select: { testId: true },
    });

    if (!existingQuestion) {
      throw new Error('Question not found');
    }

    await prisma.question.update({
      where: { id: questionId },
      data: {
        content,
        options,
        correctAnswer,
        explanation,
        imageUrl,
        videoUrl,
      },
    });

    // Edited question text has to reach the exam page immediately, so the
    // pre-rendered HTML for its test is expired here.
    revalidateTag(examQuestionsCacheTag(existingQuestion.testId), { expire: 0 });
    refresh();
    return { success: true };
  } catch (error: unknown) {
    console.error('Update Question Error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Update failed' };
  }
}
