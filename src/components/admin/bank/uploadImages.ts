/**
 * Puts an import's images straight into storage from the browser, through
 * signed URLs from /api/admin/test-upload/signed-urls, so a 40-image test
 * never passes through a server action's body limit. Shared by the course's
 * test upload (`scope: 'test'`, a folder named by the test id the server will
 * create the test under) and the bank's upload (`scope: 'bank'`).
 */

type PreparedUpload = {
  name: string;
  path: string;
  token: string;
  signedUrl: string;
  publicUrl: string;
};

export type UploadedImage = { name: string; publicUrl: string };

/** Uploads run in parallel, but only a few at a time so nothing times out in a queue. */
const IMAGE_UPLOAD_CONCURRENCY = 4;
const IMAGE_UPLOAD_TIMEOUT_MS = 60_000;
const MAX_LISTED_FAILED_UPLOADS = 10;

function describeFailedUploads(failed: string[], total: number) {
  const listed = failed.slice(0, MAX_LISTED_FAILED_UPLOADS).join(', ');
  const rest = failed.length - MAX_LISTED_FAILED_UPLOADS;

  return `Could not upload ${failed.length} of ${total} images: ${listed}${
    rest > 0 ? ` and ${rest} more` : ''
  }. Nothing was saved. Check them and try again.`;
}

async function uploadToSignedUrl(file: File, upload: PreparedUpload) {
  const body = new FormData();
  body.append('cacheControl', '3600');
  body.append('', file);

  const response = await fetch(upload.signedUrl, {
    method: 'PUT',
    body,
    signal: AbortSignal.timeout(IMAGE_UPLOAD_TIMEOUT_MS),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => '');
    throw new Error(`Image upload failed for ${file.name}: ${message || response.statusText}`);
  }
}

export async function uploadQuestionImages(
  files: File[],
  scope: 'test' | 'bank',
  onProgress: (done: number, total: number) => void,
): Promise<{ folder: string; images: UploadedImage[] }> {
  const prepareResponse = await fetch('/api/admin/test-upload/signed-urls', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scope,
      files: files.map((file) => ({ name: file.name, type: file.type, size: file.size })),
    }),
  });
  const prepareData = await prepareResponse.json().catch(() => null) as {
    folder?: string;
    uploads?: PreparedUpload[];
    error?: string;
  } | null;

  if (!prepareResponse.ok || !prepareData?.uploads || !prepareData.folder) {
    throw new Error(prepareData?.error || 'Could not prepare image uploads');
  }

  onProgress(0, files.length);

  const uploadsByName = new Map(prepareData.uploads.map((upload) => [upload.name, upload]));
  const queue = [...files];
  const failed: string[] = [];
  let completed = 0;

  // Workers pull from a shared queue: a failing file is recorded and the rest
  // keep going, instead of Promise.all aborting the whole upload.
  await Promise.all(Array.from(
    { length: Math.min(IMAGE_UPLOAD_CONCURRENCY, queue.length) },
    async () => {
      for (let file = queue.shift(); file; file = queue.shift()) {
        const upload = uploadsByName.get(file.name);
        if (!upload) {
          failed.push(file.name);
          continue;
        }

        try {
          await uploadToSignedUrl(file, upload);
        } catch {
          failed.push(file.name);
          continue;
        }

        completed += 1;
        onProgress(completed, files.length);
      }
    }
  ));

  if (failed.length > 0) {
    throw new Error(describeFailedUploads(failed, files.length));
  }

  return {
    folder: prepareData.folder,
    images: prepareData.uploads.map((upload) => ({ name: upload.name, publicUrl: upload.publicUrl })),
  };
}
