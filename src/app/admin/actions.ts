'use server';

import { prisma } from '@/lib/prisma';
import { parseTexFile } from '@/lib/texParser';
import { getSupabaseAdmin } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin';

const MAX_TEX_FILE_SIZE = 2 * 1024 * 1024;
const MAX_IMAGE_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);

function sanitizeFileName(fileName: string) {
  const normalized = fileName.trim().replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
  return normalized || `${crypto.randomUUID()}.bin`;
}

export async function uploadTest(formData: FormData) {
  try {
    await requireAdmin();

    const title = typeof formData.get('title') === 'string'
      ? (formData.get('title') as string).trim()
      : '';
    const isFree = formData.get('isFree') === 'true';
    const texFile = formData.get('texFile') as File;
    const imageFiles = formData.getAll('images') as File[];

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

    const testId = crypto.randomUUID();

    const supabase = getSupabaseAdmin();
    const imageMap: Record<string, string> = {};

    for (const image of imageFiles) {
      if (!(image instanceof File) || image.size === 0) continue;

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
    }

    const missingImageQuestion = parsedQuestions.find((q) => q.image && !imageMap[q.image]);
    if (missingImageQuestion?.image) {
      throw new Error(`Missing image for question ${missingImageQuestion.order}: ${missingImageQuestion.image}`);
    }

    await prisma.$transaction(async (tx) => {
      await tx.test.create({
        data: {
          id: testId,
          title,
          description: `Imported from ${texFile.name}`,
          isFree,
        }
      });

      for (const q of parsedQuestions) {
        await tx.question.create({
          data: {
            testId,
            content: q.content,
            options: q.options,
            correctAnswer: q.correctAnswer,
            order: q.order,
            imageUrl: q.image ? imageMap[q.image] || null : null
          }
        });
      }
    });

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
