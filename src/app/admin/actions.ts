'use server';

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { parseTexFile } from '@/lib/texParser';
import { getSupabaseAdmin } from '@/lib/supabase';
import { refresh, revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
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
import { normalizeAccessCode } from '@/lib/testAccessCode';
import {
  MAX_MODULE_COUNT,
  MIN_MODULE_COUNT,
  resolveExamModules,
  type ExamFormatInput,
} from '@/lib/examModules';
import {
  QUESTION_IMAGE_BUCKET,
  buildBankRows,
  readOptionalText,
  readSharedQuestionFields,
  readTexUpload,
  readUploadedImages,
  removeFolderImages,
  removeUnreferencedImages,
  resolveImportTags,
  writeTestQuestionThrough,
} from '@/lib/questionBankServer';

const MAX_MODULE_QUESTION_COUNT = 200;
const MAX_IMAGE_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);
const TEST_ID_PATTERN = /^[0-9a-f-]{36}$/i;
const MAX_SECTION_LABEL_LENGTH = 80;
const MAX_SECTION_DESCRIPTION_LENGTH = 180;
const MAX_TEST_TITLE_LENGTH = 200;
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

function sanitizeFileName(fileName: string) {
  const normalized = fileName.trim().replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
  return normalized || `${crypto.randomUUID()}.bin`;
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
 * must not be touched. `removeFolderImages` also keeps any file a bank
 * question or a test row still shows.
 */
async function discardFailedUpload(testId: string) {
  try {
    const existing = await prisma.test.findUnique({
      where: { id: testId },
      select: { id: true },
    });

    if (existing) return;

    await removeFolderImages(testId);
  } catch (error) {
    console.warn(`Could not clean up the failed upload of test ${testId}:`, error);
  }
}

/**
 * Creates a test from a `.tex` file and puts its questions in the question
 * bank at the same time: one BankQuestion per question, tagged with the domain
 * and difficulty chosen in the import preview, and the test's own rows linked
 * to them (`bankQuestionId`). The test keeps its rows, so the exam reads them
 * as before; deleting the test later leaves the bank questions in place.
 */
export async function uploadTest(formData: FormData) {
  // Read inside the try, but needed by the catch: without it a failure cannot
  // tell which folder the images went to.
  let uploadedTestId: string | null = null;

  try {
    const session = await requireAdmin();

    const title = typeof formData.get('title') === 'string'
      ? (formData.get('title') as string).trim()
      : '';
    const isFree = formData.get('isFree') === 'true';
    const visible = readBooleanField(formData, 'isVisible', true);
    const requestedTestId = formData.get('testId');

    // Remembered before anything can throw: the images were uploaded under this
    // id by the form, so every failure below leaves them orphaned. Recording it
    // only once the .tex parses would miss the most common failure of all.
    if (typeof requestedTestId === 'string' && TEST_ID_PATTERN.test(requestedTestId)) {
      uploadedTestId = requestedTestId;
    }

    const collection = await resolveCollectionCategory(formData.get('testCategory'));
    const testCategory = collection.category;
    const examFormat = normalizeExamFormat(formData);
    const maxAttempts = normalizeTestMaxAttempts(
      formData.get('maxAttempts'),
      collection.maxAttempts
    );
    const imageFiles = formData.getAll('images') as File[];
    const testId = uploadedTestId ?? crypto.randomUUID();
    const uploadedImages = readUploadedImages(formData.get('uploadedImages'), testId);

    // Empty means no code. Only read once the id above is known, so a rejected
    // code still lets the catch clear away the images uploaded for this test.
    const accessCode = normalizeAccessCode(formData.get('accessCode'));

    if (!title) {
      throw new Error('Title and .tex file are required');
    }
    if (title.length > MAX_TEST_TITLE_LENGTH) {
      throw new Error(`Test title must be at most ${MAX_TEST_TITLE_LENGTH} characters`);
    }

    const texFile = await readTexUpload(formData.get('texFile'));
    const { questions: parsedQuestions, moduleIndexes } = parseTexFile(texFile.text);

    if (parsedQuestions.length === 0) {
      throw new Error('No questions found in the .tex file');
    }

    const invalidQuestion = parsedQuestions.find(
      (q) => !q.content || q.content === 'Missing content' || !q.correctAnswer
    );

    if (invalidQuestion) {
      throw new Error(`Question ${invalidQuestion.order} is missing content or answer`);
    }

    const tags = resolveImportTags(parsedQuestions, formData.get('questionTags'));

    const examModules = resolveExamModules({
      questionCount: parsedQuestions.length,
      markerModules: moduleIndexes,
      format: examFormat,
    });

    const olympiadWindow = normalizeOlympiadWindow(formData, examModules.durationSeconds);

    const imageMap: Record<string, string> = {};
    for (const image of uploadedImages) {
      imageMap[image.name] = image.publicUrl;
    }

    // The older path, with the files in the form itself. The admin form now
    // uploads straight to storage through signed URLs and sends only names.
    const directImages = imageFiles.filter((image) => image instanceof File && image.size > 0);
    if (directImages.length > 0) {
      const supabase = getSupabaseAdmin();

      await Promise.all(directImages.map(async (image, index) => {
        if (image.size > MAX_IMAGE_FILE_SIZE || !ALLOWED_IMAGE_TYPES.has(image.type)) {
          throw new Error(`Invalid image file: ${image.name}`);
        }

        // As the signed-upload route names them: names that sanitize alike
        // ('Рис.png', 'Фиг.png') must not land on one path, and a collision
        // fails rather than replacing another question's picture.
        const filePath = `${testId}/direct-${index + 1}-${sanitizeFileName(image.name)}`;

        const { error } = await supabase.storage
          .from(QUESTION_IMAGE_BUCKET)
          .upload(filePath, image, {
            upsert: false,
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
    }

    const missingImageQuestion = parsedQuestions.find((q) => q.image && !imageMap[q.image]);
    if (missingImageQuestion?.image) {
      throw new Error(`Missing image for question ${missingImageQuestion.order}: ${missingImageQuestion.image}`);
    }

    const bankRows = buildBankRows({
      questions: parsedQuestions,
      tags,
      imageMap,
      source: texFile.name,
      createdById: session?.user?.id ?? null,
    });

    // One transaction: a test whose bank questions failed to save, or bank
    // questions without the test they were imported with, is never left behind.
    await prisma.$transaction([
      prisma.bankQuestion.createMany({ data: bankRows }),
      prisma.test.create({
        data: {
          id: testId,
          title,
          description: encodeTestDescription(testCategory),
          isFree,
          visible,
          durationSeconds: examModules.durationSeconds,
          moduleDurations: examModules.moduleDurations,
          maxAttempts,
          accessCode,
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
                imageUrl: bankRows[index].imageUrl ?? null,
                bankQuestionId: bankRows[index].id,
              })),
            },
          },
        },
        select: { id: true },
      }),
    ]);

    // A re-uploaded test may reuse an existing id, so the pre-rendered question
    // HTML for that id has to go. `{ expire: 0 }` = the very next exam start
    // re-renders instead of serving the old questions.
    revalidateTag(examQuestionsCacheTag(testId), { expire: 0 });
    // Every admin page is `force-dynamic`, so there is no route cache for
    // `revalidatePath` to clear. `refresh()` re-renders the page that called the
    // action and ships the new RSC payload in this same response, which removes
    // the extra `router.refresh()` round-trip the client used to make.
    refresh();
    return { success: true, testId, questionCount: parsedQuestions.length };

  } catch (error: unknown) {
    console.error('Upload error:', error);

    if (uploadedTestId) {
      await discardFailedUpload(uploadedTestId);
    }

    return { success: false, error: error instanceof Error ? error.message : 'Upload failed' };
  }
}

/**
 * Deletes a test, its results and its question rows. Bank questions stay:
 * the rows were copies, and `Question.bankQuestionId` is the only link.
 */
export async function deleteTest(testId: string) {
  try {
    await requireAdmin();

    // A copy only borrows its questions, so deleting one leaves the original
    // alone. Deleting an original takes its copies with it: they would have
    // nothing left to show, and the database refuses to leave them behind.
    const { copyIds, imageUrls } = await prisma.$transaction(async (tx) => {
      const copies = await tx.test.findMany({
        where: { questionSourceId: testId },
        select: { id: true },
      });
      const ids = copies.map((copy) => copy.id);
      // A test built from the bank shows the bank's image files, which live
      // outside its own folder; they are checked once the rows are gone.
      const images = await tx.question.findMany({
        where: { testId, imageUrl: { not: null } },
        select: { imageUrl: true },
      });

      if (ids.length > 0) {
        await tx.result.deleteMany({ where: { testId: { in: ids } } });
        await tx.test.deleteMany({ where: { id: { in: ids } } });
      }

      await tx.result.deleteMany({ where: { testId } });
      await tx.question.deleteMany({ where: { testId } });
      await tx.test.delete({ where: { id: testId } });

      return { copyIds: ids, imageUrls: images.map((image) => image.imageUrl) };
    });

    // Deliberately after the rows: a failure here only orphans the images, while
    // the reverse order would leave a live test pointing at deleted files. A
    // copy has no images of its own, so for one this finds nothing. Files a
    // bank question or another test still shows are kept: an imported test's
    // pictures are its bank questions' pictures too.
    await removeFolderImages(testId);
    await removeUnreferencedImages(imageUrls);

    for (const id of [testId, ...copyIds]) {
      revalidateTag(examQuestionsCacheTag(id), { expire: 0 });
    }
    refresh();
    return { success: true };
  } catch (error: unknown) {
    console.error("Delete Test Error:", error);
    return { success: false, error: error instanceof Error ? error.message : 'Delete failed' };
  }
}

/**
 * Puts a test into a section under a new title without copying its questions.
 * The copy is a test of its own - title, section, settings and results - that
 * shows the original's questions and images, so they are stored once and an
 * edit made through either test shows in both. Copying a copy borrows from the
 * same original, which keeps a single level to follow.
 *
 * The olympiad window and the start code are copied only when the form asks
 * for them. Both are ticked by default: dropping either one would open the copy
 * to everyone in its section straight away.
 */
export async function copyTest(testId: string, formData: FormData) {
  try {
    await requireAdmin();

    if (!testId || testId.length > 160) {
      throw new Error('Invalid test id');
    }

    const title = normalizeRequiredText(formData.get('title'), 'Test title');
    const [collection, source] = await Promise.all([
      resolveCollectionCategory(formData.get('testCategory')),
      prisma.test.findUnique({
        where: { id: testId },
        select: {
          title: true,
          description: true,
          collectionCategory: true,
          isFree: true,
          visible: true,
          durationSeconds: true,
          moduleDurations: true,
          maxAttempts: true,
          olympiadStartsAt: true,
          olympiadEndsAt: true,
          accessCode: true,
          questionSourceId: true,
        },
      }),
    ]);

    if (!source) {
      throw new Error('Test not found');
    }

    if (collection.category === source.collectionCategory && title === source.title.trim()) {
      throw new Error('The copy would sit next to the original under the same title. Give it a new title or pick another course.');
    }

    const keepOlympiadWindow = formData.get('keepOlympiadWindow') === 'true';
    const keepAccessCode = formData.get('keepAccessCode') === 'true';

    const copy = await prisma.test.create({
      data: {
        title,
        description: encodeTestDescription(collection.category, cleanTestDescription(source.description)),
        isFree: source.isFree,
        visible: source.visible,
        durationSeconds: source.durationSeconds,
        moduleDurations: source.moduleDurations,
        maxAttempts: source.maxAttempts,
        olympiadStartsAt: keepOlympiadWindow ? source.olympiadStartsAt : null,
        olympiadEndsAt: keepOlympiadWindow ? source.olympiadEndsAt : null,
        accessCode: keepAccessCode ? source.accessCode : null,
        collectionCategory: collection.category,
        questionSourceId: source.questionSourceId ?? testId,
      },
      select: { id: true },
    });

    refresh();
    return { success: true as const, testId: copy.id, title, category: collection.category };
  } catch (error: unknown) {
    console.error('Copy Test Error:', error);
    return { success: false as const, error: error instanceof Error ? error.message : 'Copy failed' };
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
    throw new Error('Create at least one course before adding tests');
  }

  if (typeof value === 'string' && value.trim()) {
    if (!isTestCategory(value)) {
      throw new Error('The chosen course is invalid');
    }

    const requestedCategory = normalizeCategoryId(value);
    const requested = collections.find((collection) => collection.category === requestedCategory);
    if (requested) {
      return { category: requestedCategory, maxAttempts: requested.maxAttempts };
    }

    throw new Error('The chosen course no longer exists');
  }

  const fallback = collections.find((collection) => collection.category === 'STANDARD')
    ?? collections[0];

  return { category: fallback.category, maxAttempts: fallback.maxAttempts };
}

/**
 * Reads a section's new name and description. A card sends them only while it
 * is open for renaming, so a missing field means "leave it as it is", never
 * "clear it".
 *
 * Only what people read changes. The `category` id stays, because tests, access
 * grants and the result pages all point at it.
 */
function readSectionRename(formData: FormData, category: string) {
  const label = formData.get(`label_${category}`);
  if (label === null) return {};

  const name = normalizeRequiredText(label, 'Course name');
  if (name.length > MAX_SECTION_LABEL_LENGTH) {
    throw new Error(`Course name must be at most ${MAX_SECTION_LABEL_LENGTH} characters`);
  }

  const descriptionField = formData.get(`description_${category}`);
  if (descriptionField === null) return { label: name };

  // Empty falls back to the default description, as it does for a new section.
  const description = normalizeNullableText(descriptionField);
  if (description && description.length > MAX_SECTION_DESCRIPTION_LENGTH) {
    throw new Error(`Course description must be at most ${MAX_SECTION_DESCRIPTION_LENGTH} characters`);
  }

  return { label: name, description };
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
      throw new Error('No courses to update');
    }

    const existingCollections = await prisma.testCollectionVisibility.findMany({
      where: { category: { in: categories } },
      select: { category: true, maxAttempts: true },
    });

    if (existingCollections.length === 0) {
      throw new Error('No courses to update');
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
            ...readSectionRename(formData, category),
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

    const label = normalizeRequiredText(formData.get('sectionLabel'), 'Course name');
    const description = normalizeNullableText(formData.get('sectionDescription'))
      || 'Practice tests in this course.';
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
      throw new Error('Invalid course');
    }

    const category = normalizeCategoryId(categoryValue);
    const collectionCount = await prisma.testCollectionVisibility.count();
    if (collectionCount <= 1) {
      throw new Error('Keep at least one course');
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
    // An empty course keeps the one the test has - none included. The editor
    // offers "No course" only for a test without one (its course was
    // deleted), and resolving empty to the default course moved such a test
    // there on any save, open to that course's students.
    const requestedCategory = formData.get('testCategory');
    const changesCategory = typeof requestedCategory === 'string' && requestedCategory.trim() !== '';
    // Neither read depends on the other, so they share one round-trip. Errors
    // still surface in the original order: an invalid section rejects the whole
    // `Promise.all`, and only then is the test row inspected.
    const [collection, existingTest] = await Promise.all([
      changesCategory ? resolveCollectionCategory(requestedCategory) : null,
      prisma.test.findUnique({
        where: { id: testId },
        select: {
          description: true,
          visible: true,
          moduleDurations: true,
          collection: { select: { maxAttempts: true } },
        },
      }),
    ]);
    const maxAttempts = normalizeTestMaxAttempts(
      formData.get('maxAttempts'),
      collection?.maxAttempts ?? existingTest?.collection?.maxAttempts
    );
    const isFree = formData.get('isFree') === 'true';
    // Empty clears the code. A changed code asks every student again, because an
    // unlock only counts while it matches the code on the test.
    const accessCode = normalizeAccessCode(formData.get('accessCode'));

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
        accessCode,
        ...normalizeOlympiadWindow(formData, durationSeconds),
        ...(collection && {
          collectionCategory: collection.category,
          description: encodeTestDescription(collection.category, cleanTestDescription(existingTest.description)),
        }),
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

/**
 * Saves a question from the test editor. A question that came from the bank
 * is written through: the bank question and every other test showing it get
 * the same text, options, answer and image (src/lib/questionBankServer.ts).
 */
export async function updateQuestion(questionId: string, formData: FormData) {
  try {
    await requireAdmin();

    if (!/^[0-9a-f-]{36}$/i.test(questionId)) {
      throw new Error('Invalid question id');
    }

    const fields = readSharedQuestionFields(formData);

    // Edited question text has to reach the exam page immediately, so the
    // pre-rendered HTML of every test showing it - and of their copies - is
    // expired inside.
    await writeTestQuestionThrough(questionId, fields, {
      explanation: readOptionalText(formData.get('explanation')),
      videoUrl: readOptionalText(formData.get('videoUrl')),
    });
    refresh();
    return { success: true };
  } catch (error: unknown) {
    console.error('Update Question Error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Update failed' };
  }
}

export type BuildTestInput = {
  course: string;
  title: string;
  /** One block on one timer, or two or more modules with a timer each. */
  format: 'single' | 'modular';
  /** Minutes per module, in order; one entry for a one-block test. */
  minutes: number[];
  /** Bank question ids per module, in the order they will be asked. */
  modules: string[][];
  maxAttempts: number | string;
  visible: boolean;
  isFree: boolean;
};

/**
 * Builds a test in a course from bank questions, chosen by hand or at random
 * on /admin/bank/build. The test gets rows of its own, copies of the bank text
 * linked by `bankQuestionId`, exactly like an imported test, so everything
 * downstream reads it the same way. Timers are stored as `uploadTest` stores
 * them. Lands on the new test's editor.
 */
export async function createTestFromBank(input: BuildTestInput) {
  let testId: string;

  try {
    await requireAdmin();

    const title = normalizeRequiredText(typeof input?.title === 'string' ? input.title : null, 'Test title');
    if (title.length > MAX_TEST_TITLE_LENGTH) {
      throw new Error(`Test title must be at most ${MAX_TEST_TITLE_LENGTH} characters`);
    }

    const collection = await resolveCollectionCategory(typeof input?.course === 'string' ? input.course : null);
    const modular = input?.format === 'modular';
    const modules = Array.isArray(input?.modules) ? input.modules : [];
    const minutes = Array.isArray(input?.minutes) ? input.minutes : [];

    if (modular ? modules.length < 2 || modules.length > MAX_MODULE_COUNT : modules.length !== 1) {
      throw new Error(modular
        ? `A test can have between 2 and ${MAX_MODULE_COUNT} modules`
        : 'A one-block test has one list of questions');
    }
    if (minutes.length !== modules.length) {
      throw new Error('Set a time for each module');
    }

    const durations = minutes.map((value) => normalizeDurationSeconds(String(value)));
    const durationSeconds = durations.reduce((total, duration) => total + duration, 0);
    if (durationSeconds > MAX_EXAM_DURATION_SECONDS) {
      throw new Error(`Total test time must not exceed ${MAX_DURATION_MINUTES} minutes`);
    }

    const seen = new Set<string>();
    modules.forEach((ids, index) => {
      const label = modular ? `Module ${index + 1}` : 'The test';
      if (!Array.isArray(ids) || ids.length === 0) {
        throw new Error(`${label} has no questions`);
      }
      if (ids.length > MAX_MODULE_QUESTION_COUNT) {
        throw new Error(`${label} has more than ${MAX_MODULE_QUESTION_COUNT} questions`);
      }
      for (const id of ids) {
        if (typeof id !== 'string' || !TEST_ID_PATTERN.test(id)) {
          throw new Error('A chosen question is not in the bank');
        }
        if (seen.has(id)) {
          throw new Error('A question is chosen twice. Each question can appear once in a test.');
        }
        seen.add(id);
      }
    });

    const bankRows = await prisma.bankQuestion.findMany({
      where: { id: { in: [...seen] } },
      select: { id: true, content: true, options: true, correctAnswer: true, imageUrl: true },
    });
    if (bankRows.length !== seen.size) {
      throw new Error('Some chosen questions were deleted from the bank. Choose them again.');
    }
    const bankById = new Map(bankRows.map((row) => [row.id, row]));

    let order = 0;
    const questions: Prisma.QuestionCreateManyTestInput[] = modules.flatMap((ids, index) => ids.map((id) => {
      const bank = bankById.get(id)!;
      order += 1;
      return {
        content: bank.content,
        options: bank.options ?? [],
        correctAnswer: bank.correctAnswer,
        imageUrl: bank.imageUrl,
        order,
        moduleIndex: index + 1,
        bankQuestionId: bank.id,
      };
    }));

    const test = await prisma.test.create({
      data: {
        title,
        description: encodeTestDescription(collection.category),
        isFree: input.isFree === true,
        visible: input.visible === true,
        // As `uploadTest` stores them: one block runs on durationSeconds alone,
        // modules keep one duration each and the total beside them.
        durationSeconds,
        moduleDurations: modular ? durations : [],
        maxAttempts: normalizeTestMaxAttempts(input.maxAttempts, collection.maxAttempts),
        collectionCategory: collection.category,
        questions: { createMany: { data: questions } },
      },
      select: { id: true },
    });
    testId = test.id;

    revalidateTag(examQuestionsCacheTag(testId), { expire: 0 });
    // The course's test list and the bank's "used in" counts are on other
    // pages: this clears the client's cached copies of every admin page.
    revalidatePath('/admin', 'layout');
  } catch (error: unknown) {
    console.error('Create Test From Bank Error:', error);
    return { success: false as const, error: error instanceof Error ? error.message : 'The test was not created' };
  }

  // Outside the try: `redirect` throws to navigate.
  redirect(`/admin/tests/${testId}`);
}
