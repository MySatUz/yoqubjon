'use server';

import { prisma } from '@/lib/prisma';
import { parseTexFile } from '@/lib/texParser';
import { getSupabaseAdmin } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin';

export async function uploadTest(formData: FormData) {
  try {
    await requireAdmin();

    const title = formData.get('title') as string;
    const isFree = formData.get('isFree') === 'true';
    const texFile = formData.get('texFile') as File;
    const imageFiles = formData.getAll('images') as File[];

    if (!texFile || !title) {
      throw new Error('Title and .tex file are required');
    }

    // 1. Create the Test entry
    const test = await prisma.test.create({
      data: {
        title,
        description: `Imported from ${texFile.name}`,
        isFree,
      }
    });

    // 2. Handle Images (Upload to Supabase Storage)
    const supabase = getSupabaseAdmin();
    const imageMap: Record<string, string> = {};

    for (const image of imageFiles) {
      if (!(image instanceof File) || image.size === 0) continue;

      const filePath = `${test.id}/${image.name}`;

      const { error } = await supabase.storage
        .from('questions')
        .upload(filePath, image, {
          upsert: true,
          contentType: image.type
        });

      if (error) {
        console.error(`Error uploading image ${image.name}:`, error);
        continue;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('questions')
        .getPublicUrl(filePath);
      
      imageMap[image.name] = publicUrl;
    }

    // 3. Parse and Save Questions
    const texContent = await texFile.text();
    const parsedQuestions = parseTexFile(texContent);

    for (const q of parsedQuestions) {
      await prisma.question.create({
        data: {
          testId: test.id,
          content: q.content,
          options: q.options,
          correctAnswer: q.correctAnswer,
          order: q.order,
          imageUrl: q.image ? imageMap[q.image] || null : null 
        }
      });
    }

    revalidatePath('/dashboard');
    return { success: true, testId: test.id };

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
