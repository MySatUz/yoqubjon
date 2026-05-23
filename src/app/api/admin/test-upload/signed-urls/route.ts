import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getSupabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

const MAX_IMAGE_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);

function sanitizeFileName(fileName: string) {
  const normalized = fileName.trim().replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
  return normalized || `${crypto.randomUUID()}.bin`;
}

type UploadFileInput = {
  name?: unknown;
  type?: unknown;
  size?: unknown;
};

export async function POST(req: Request) {
  try {
    await requireAdmin();

    const body = await req.json().catch(() => null) as { files?: UploadFileInput[] } | null;
    const files = Array.isArray(body?.files) ? body.files : [];

    if (files.length === 0) {
      return NextResponse.json({ error: 'No image files provided' }, { status: 400 });
    }

    const testId = crypto.randomUUID();
    const supabase = getSupabaseAdmin();

    const uploads = await Promise.all(files.map(async (file) => {
      const name = typeof file.name === 'string' ? file.name : '';
      const type = typeof file.type === 'string' ? file.type : '';
      const size = typeof file.size === 'number' ? file.size : 0;

      if (!name || size <= 0 || size > MAX_IMAGE_FILE_SIZE || !ALLOWED_IMAGE_TYPES.has(type)) {
        throw new Error(`Invalid image file: ${name || 'unknown'}`);
      }

      const path = `${testId}/${sanitizeFileName(name)}`;
      const { data, error } = await supabase.storage
        .from('questions')
        .createSignedUploadUrl(path, { upsert: true });

      if (error) {
        throw new Error(`Could not create upload URL for ${name}: ${error.message}`);
      }

      const { data: { publicUrl } } = supabase.storage
        .from('questions')
        .getPublicUrl(path);

      return {
        name,
        path,
        token: data.token,
        signedUrl: data.signedUrl,
        publicUrl,
      };
    }));

    return NextResponse.json({ testId, uploads });
  } catch (error: unknown) {
    console.error('Signed test upload URL failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not prepare image uploads' },
      { status: 500 }
    );
  }
}
