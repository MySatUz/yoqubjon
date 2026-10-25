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

/**
 * Where one image of an upload is stored. The sanitized name alone was not
 * unique: 'Рис.png' and 'Фиг.png' both become '___.png', so the second file
 * replaced the first and two questions showed one picture. The position in
 * the request keeps every path apart; the original name stays the key the
 * form and the server pair a question's `\image{...}` with.
 */
function imagePath(folder: string, index: number, fileName: string) {
  return `${folder}/${index + 1}-${sanitizeFileName(fileName)}`;
}

type UploadFileInput = {
  name?: unknown;
  type?: unknown;
  size?: unknown;
};

/**
 * Where an upload's images go. A test's own folder is its id - the form
 * creates the test under that id afterwards, and deleting the test clears
 * the folder. A bank import (`scope: 'bank'`) has no test, so it gets a
 * folder under `bank/`, which no test deletion ever lists.
 */
function newUploadFolder(scope: unknown) {
  const id = crypto.randomUUID();
  return scope === 'bank' ? `bank/${id}` : id;
}

export async function POST(req: Request) {
  try {
    await requireAdmin();

    const body = await req.json().catch(() => null) as { files?: UploadFileInput[]; scope?: unknown } | null;
    const files = Array.isArray(body?.files) ? body.files : [];

    if (files.length === 0) {
      return NextResponse.json({ error: 'No image files provided' }, { status: 400 });
    }

    // A question names its image by file name, so two files with one name
    // cannot both be meant.
    const seenNames = new Set<string>();
    for (const file of files) {
      if (typeof file?.name !== 'string') continue;
      if (seenNames.has(file.name)) {
        return NextResponse.json(
          { error: `Two images are named ${file.name}. Rename one, then choose the images again.` },
          { status: 400 }
        );
      }
      seenNames.add(file.name);
    }

    const folder = newUploadFolder(body?.scope);
    const supabase = getSupabaseAdmin();

    const uploads = await Promise.all(files.map(async (file, index) => {
      const name = typeof file.name === 'string' ? file.name : '';
      const type = typeof file.type === 'string' ? file.type : '';
      const size = typeof file.size === 'number' ? file.size : 0;

      if (!name || size <= 0 || size > MAX_IMAGE_FILE_SIZE || !ALLOWED_IMAGE_TYPES.has(type)) {
        throw new Error(`Invalid image file: ${name || 'unknown'}`);
      }

      // No upsert: the folder is new and every path in it unique, so a
      // collision is a bug that should fail, not replace a picture.
      const path = imagePath(folder, index, name);
      const { data, error } = await supabase.storage
        .from('questions')
        .createSignedUploadUrl(path);

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

    // `testId` only for a test upload: the form sends it back to create the
    // test under the folder's id.
    return NextResponse.json({
      folder,
      ...(folder.startsWith('bank/') ? {} : { testId: folder }),
      uploads,
    });
  } catch (error: unknown) {
    console.error('Signed test upload URL failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not prepare image uploads' },
      { status: 500 }
    );
  }
}
