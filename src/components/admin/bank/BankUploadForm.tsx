'use client';

import React, { useId, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, FileText, Image as ImageIcon, Loader2, Upload } from 'lucide-react';
import { uploadBankQuestions } from '@/app/admin/bank/actions';
import { FilePickBox } from '@/components/admin/bank/FilePickBox';
import { TexImportPreview, describeImportBlocker } from '@/components/admin/bank/TexImportPreview';
import { uploadQuestionImages } from '@/components/admin/bank/uploadImages';
import { findMissingImages, useTexCheck } from '@/components/admin/bank/useTexCheck';
import { Button, buttonClass } from '@/components/ui/Button';
import { CardBody, CardFooter, CardHeader, cardClass } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Feedback';
import { bankListHref, EMPTY_BANK_FILTERS } from '@/lib/questionBank';

/**
 * Adds a `.tex` file's questions to the bank alone, with no test: the same
 * check-and-tag preview as a course's test upload, then one save. The images
 * go into a `bank/<id>` folder of their own.
 */
export default function BankUploadForm() {
  const [texFile, setTexFile] = useState<File | null>(null);
  const [images, setImages] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [statusText, setStatusText] = useState('Adding questions…');
  const [result, setResult] = useState<
    { success: true; count: number; fileName: string } | { success: false; error: string } | null
  >(null);
  // Remounts the file inputs empty after a save: a file input cannot be
  // cleared by state.
  const [resetKey, setResetKey] = useState(0);
  const texCheck = useTexCheck();
  const fieldId = useId();

  const missingImages = findMissingImages(texCheck.questions, images.map((file) => file.name));
  const blocker = describeImportBlocker({ state: texCheck.state, untagged: texCheck.untagged, missingImages });
  const count = texCheck.questions?.length ?? 0;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (blocker || saving || !texFile) return;

    setSaving(true);
    setResult(null);

    try {
      // Only the files the questions ask for: a folder of spare pictures
      // would sit in storage with nothing showing them.
      const wanted = new Set(texCheck.questions?.map((question) => question.image).filter(Boolean));
      const files = images.filter((file) => wanted.has(file.name));
      const formData = new FormData();
      formData.set('texFile', texFile);
      formData.set('questionTags', JSON.stringify(texCheck.tags));

      if (files.length > 0) {
        setStatusText('Preparing image uploads…');
        const upload = await uploadQuestionImages(files, 'bank', (done, total) => {
          setStatusText(`Uploading images ${done}/${total}…`);
        });
        formData.set('folder', upload.folder);
        formData.set('uploadedImages', JSON.stringify(upload.images));
      }

      setStatusText('Adding questions…');
      const response = await uploadBankQuestions(formData);
      setResult(response);

      if (response.success) {
        setTexFile(null);
        setImages([]);
        texCheck.reset();
        setResetKey((key) => key + 1);
      }
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'The questions were not added. Try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={cardClass}>
      <CardHeader
        title="Upload questions"
        description="One .tex file and its images. The questions go into the bank only; build a test from them later."
      />

      <CardBody className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
        <FilePickBox
          key={`tex-${resetKey}`}
          id={`${fieldId}-tex`}
          name="texFile"
          label="LaTeX file (.tex)"
          accept=".tex"
          required
          disabled={saving}
          icon={<FileText />}
          summary={texFile?.name ?? null}
          placeholder="Select a .tex file"
          onFiles={(files) => {
            const file = files[0] ?? null;
            setTexFile(file);
            setResult(null);
            void texCheck.check(file);
          }}
        />

        <FilePickBox
          key={`images-${resetKey}`}
          id={`${fieldId}-images`}
          name="images"
          label="Images (.png, .jpg)"
          accept="image/*"
          multiple
          disabled={saving}
          icon={<ImageIcon />}
          summary={images.length > 0 ? `${images.length} ${images.length === 1 ? 'image' : 'images'} selected` : null}
          placeholder="Select the images it uses"
          onFiles={setImages}
        />

        {texCheck.state.status !== 'idle' && (
          <div className="sm:col-span-2">
            <TexImportPreview
              state={texCheck.state}
              tags={texCheck.tags}
              onTagsChange={texCheck.setTags}
              missingImages={missingImages}
              onRecheck={() => void texCheck.check(texFile)}
              disabled={saving}
            />
          </div>
        )}

        {result?.success && (
          <Alert
            tone="success"
            className="sm:col-span-2"
            action={
              <Link
                href={bankListHref({ ...EMPTY_BANK_FILTERS, q: result.fileName })}
                prefetch={false}
                className={buttonClass({ variant: 'secondary', size: 'sm' })}
              >
                Show them
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            }
          >
            {result.count === 1 ? '1 question' : `${result.count} questions`} from {result.fileName}
            {result.count === 1 ? ' is' : ' are'} in the bank.
            {' '}The form is ready for the next file.
          </Alert>
        )}

        {result && !result.success && (
          <Alert tone="danger" className="sm:col-span-2">
            {result.error}
          </Alert>
        )}
      </CardBody>

      <CardFooter>
        {blocker && !saving && <p className="mr-auto text-sm text-mist-500">{blocker}</p>}
        <Button type="submit" disabled={saving || blocker !== null}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {/* "Uploading images 3/12…" counts up: fixed-width digits keep the button still. */}
              <span className="tabular-nums">{statusText}</span>
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              {count > 0 ? `Add ${count} ${count === 1 ? 'question' : 'questions'} to the bank` : 'Add to the bank'}
            </>
          )}
        </Button>
      </CardFooter>
    </form>
  );
}
