'use server';

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { parseTexFile } from '@/lib/texParser';
import { getSupabaseAdmin } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin';
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
import { DEFAULT_TEST_MAX_ATTEMPTS, normalizeTestMaxAttempts } from '@/lib/testAttempts';
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

export async function uploadTest(formData: FormData) {
  try {
    await requireAdmin();

    const title = typeof formData.get('title') === 'string'
      ? (formData.get('title') as string).trim()
      : '';
    const isFree = formData.get('isFree') === 'true';
    const visible = readBooleanField(formData, 'isVisible', true);
    const testCategory = await resolveCollectionCategory(formData.get('testCategory'));
    const examFormat = normalizeExamFormat(formData);
    const maxAttempts = normalizeTestMaxAttempts(
      formData.get('maxAttempts'),
      await getCollectionMaxAttempts(testCategory)
    );
    const texFile = formData.get('texFile') as File;
    const imageFiles = formData.getAll('images') as File[];
    const uploadedImages = readUploadedImages(formData.get('uploadedImages'));
    const requestedTestId = formData.get('testId');

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

    const testId = typeof requestedTestId === 'string' && /^[0-9a-f-]{36}$/i.test(requestedTestId)
      ? requestedTestId
      : crypto.randomUUID();

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
        .from('questions')
        .upload(filePath, image, {
          upsert: true,
          contentType: image.type
        });

      if (error) {
        throw new Error(`Error uploading image ${image.name}: ${error.message}`);
      }

      const { data: { publicUrl } } = supabase.storage
        .from('questions')
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

    revalidatePath('/admin');
    revalidatePath('/dashboard');
    return { success: true, testId };

  } catch (error: unknown) {
    console.error('Upload error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Upload failed' };
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

    revalidatePath('/admin');
    revalidatePath('/dashboard');
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

async function resolveCollectionCategory(value: FormDataEntryValue | null) {
  const collections = await prisma.testCollectionVisibility.findMany({
    orderBy: [
      { position: 'asc' },
      { category: 'asc' },
    ],
    select: { category: true },
  });

  if (collections.length === 0) {
    throw new Error('Create at least one section before uploading tests');
  }

  const collectionSet = new Set(collections.map((collection) => collection.category));
  if (typeof value === 'string' && value.trim()) {
    if (!isTestCategory(value)) {
      throw new Error('Selected section is invalid');
    }

    const requestedCategory = normalizeCategoryId(value);
    if (collectionSet.has(requestedCategory)) {
      return requestedCategory;
    }

    throw new Error('Selected section no longer exists');
  }

  return collectionSet.has('STANDARD') ? 'STANDARD' : collections[0].category;
}

async function getCollectionMaxAttempts(category: string) {
  const collection = await prisma.testCollectionVisibility.findUnique({
    where: { category },
    select: { maxAttempts: true },
  });

  return collection?.maxAttempts ?? DEFAULT_TEST_MAX_ATTEMPTS;
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

    revalidatePath('/admin');
    revalidatePath('/dashboard');
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

    revalidatePath('/admin');
    revalidatePath('/dashboard');
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

    revalidatePath('/admin');
    revalidatePath('/dashboard');
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
    const testCategory = await resolveCollectionCategory(formData.get('testCategory'));
    const maxAttempts = normalizeTestMaxAttempts(
      formData.get('maxAttempts'),
      await getCollectionMaxAttempts(testCategory)
    );
    const isFree = formData.get('isFree') === 'true';
    const existingTest = await prisma.test.findUnique({
      where: { id: testId },
      select: {
        description: true,
        visible: true,
        moduleDurations: true,
      },
    });

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
        collectionCategory: testCategory,
        description: encodeTestDescription(testCategory, cleanTestDescription(existingTest.description)),
      },
    });

    revalidatePath('/admin');
    revalidatePath('/dashboard');
    revalidatePath(`/exam/${testId}`);
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

    revalidatePath('/admin');
    revalidatePath('/dashboard');
    revalidatePath(`/exam/${testId}`);
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

    revalidatePath('/admin');
    revalidatePath('/dashboard');
    revalidatePath(`/exam/${existingQuestion.testId}`);
    return { success: true };
  } catch (error: unknown) {
    console.error('Update Question Error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Update failed' };
  }
}
