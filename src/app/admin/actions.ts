'use server';

import { prisma } from '@/lib/prisma';
import { parseTexFile } from '@/lib/texParser';
import { supabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

export async function uploadTest(formData: FormData) {
  try {
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
    const imageMap: Record<string, string> = {};

    for (const image of imageFiles) {
      if (!(image instanceof File) || image.size === 0) continue;

      const fileExt = image.name.split('.').pop();
      const fileName = `${test.id}/${image.name}`;
      const filePath = fileName;

      const { data, error } = await supabase.storage
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
        } as any
      });
    }

    revalidatePath('/dashboard');
    return { success: true, testId: test.id };

  } catch (error: any) {
    console.error('Upload error:', error);
    return { success: false, error: error.message };
  }
}

export async function deleteTest(testId: string) {
  try {
    // Delete questions first (manual cascade)
    await prisma.question.deleteMany({
      where: { testId }
    });

    // Delete results
    await prisma.result.deleteMany({
      where: { testId }
    });

    // Delete the test itself
    await prisma.test.delete({
      where: { id: testId }
    });

    revalidatePath('/admin');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error: any) {
    console.error("Delete Test Error:", error);
    return { success: false, error: error.message };
  }
}
