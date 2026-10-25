import type { Metadata } from 'next';
import { requireAdminPage } from '@/lib/admin';
import BankUploadForm from '@/components/admin/bank/BankUploadForm';
import { BackLink, Page, PageHeader } from '@/components/ui/Page';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Upload questions' };

/** Questions into the bank alone, with no test (BankUploadForm). */
export default async function BankUploadPage() {
  // Kept here on purpose: access must not depend on the segment layout.
  await requireAdminPage();

  return (
    <Page>
      <PageHeader
        back={<BackLink href="/admin/bank">Back to question bank</BackLink>}
        title="Upload questions"
        description="Each question needs a domain and a difficulty. Write them in the file as \domain{algebra} and \difficulty{2}, or pick them below once the file is checked."
      />
      <BankUploadForm />
    </Page>
  );
}
