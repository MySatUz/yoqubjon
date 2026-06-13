'use server';

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

const MAX_TEX_FILE_SIZE = 2 * 1024 * 1024;
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
    const testCategory = await resolveCollectionCategory(formData.get('testCategory'));
    const durationSeconds = normalizeDurationSeconds(formData.get('durationMinutes'));
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
    const parsedQuestions = parseTexFile(texContent);

    if (parsedQuestions.length === 0) {
      throw new Error('No questions found in the .tex file');
    }

    const invalidQuestion = parsedQuestions.find(
      (q) => !q.content || q.content === 'Missing content' || !q.correctAnswer
    );

    if (invalidQuestion) {
      throw new Error(`Question ${invalidQuestion.order} is missing content or answer`);
    }

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
        durationSeconds,
        collectionCategory: testCategory,
        questions: {
          createMany: {
            data: parsedQuestions.map((q) => ({
              content: q.content,
              options: q.options,
              correctAnswer: q.correctAnswer,
              order: q.order,
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

export async function updateCollectionVisibility(formData: FormData) {
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

    await prisma.$transaction(
      categories.map((category) => (
        prisma.testCollectionVisibility.update({
          where: { category },
          data: { visible: formData.get(`visible_${category}`) === 'true' },
        })
      ))
    );

    revalidatePath('/admin');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error: unknown) {
    console.error('Update Collection Visibility Error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Update failed' };
  }
}

export async function createTestCollection(formData: FormData) {
  try {
    await requireAdmin();

    const label = normalizeRequiredText(formData.get('sectionLabel'), 'Section name');
    const description = normalizeNullableText(formData.get('sectionDescription'))
      || 'Practice tests in this section.';
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
    const durationSeconds = normalizeDurationSeconds(formData.get('durationMinutes'));
    const isFree = formData.get('isFree') === 'true';
    const existingTest = await prisma.test.findUnique({
      where: { id: testId },
      select: { description: true },
    });

    if (!existingTest) {
      throw new Error('Test not found');
    }

    await prisma.test.update({
      where: { id: testId },
      data: {
        title,
        isFree,
        durationSeconds,
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
