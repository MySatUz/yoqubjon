import type { Metadata } from 'next';
import { requireAdminPage } from '@/lib/admin';
import { readBankId } from '@/lib/questionBank';
import BankUploadForm from '@/components/admin/bank/BankUploadForm';
import { BackLink, Page, PageHeader } from '@/components/ui/Page';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Upload questions' };

/**
 * Questions into one bank alone, with no test (BankUploadForm). Opened from
 * the official bank with `?bank=official`, it starts on that one.
 */
export default async function BankUploadPage({
  searchParams,
}: {
  searchParams: Promise<{ bank?: string | string[] }>;
}) {
  // Kept here on purpose: access must not depend on the segment layout.
  await requireAdminPage();
  const { bank } = await searchParams;
  const defaultBank = readBankId(Array.isArray(bank) ? bank[0] : bank);

  return (
    <Page>
      <PageHeader
        back={<BackLink href={defaultBank === 'official' ? '/admin/bank?bank=official' : '/admin/bank'}>Back to question bank</BackLink>}
        title="Upload questions"
        description="Each question needs a domain and a difficulty. Write them in the file as \domain{algebra} and \difficulty{2}, or pick them below once the file is checked."
      />
      <BankUploadForm defaultBank={defaultBank} />
    </Page>
  );
}
